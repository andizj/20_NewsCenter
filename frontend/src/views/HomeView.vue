<template>
  <div class="page">
    <AppHeader
      @refresh="refreshAll"
      @mark-notification-read="onMessageMarkedRead"
      @mark-notifications-read="markSubscribedNewNotificationsRead"
      @notification-selected="goToNotificationMessage"
    />

    <div class="layout">
      <TagFilter
        ref="tagFilter"
        :tags="tags"
        :selected="selectedTag"
        :loading="tagsLoading"
        :error="tagsError"
        @select="onSelectTag"
        @reload="loadTags"
        @subscriptions-changed="onSubscriptionsChanged"
      />

      <main class="main">
        <CreateMessageForm
          :loading="createLoading"
          :error="createError"
          :success="createSuccess"
          :availableTags="tags"
          @submit="onCreateMessage"
        />

        <div class="feed-controls">
          <div class="searchBar">
            <input
                class="searchInput"
                v-model.trim="searchTerm"
                placeholder="Search..."
                @keyup.enter="searchMessages"
            />

            <button class="btn" @click="searchMessages">
              Search
            </button>

            <button class="btn" @click="clearSearch" v-if="searchTerm">
              Clear
            </button>
          </div>
          
          <div class="filter-toggle">
            <button 
              class="toggle-btn" 
              :class="{ active: feedFilter === 'all' }" 
              @click="setFeedFilter('all')"
            >
              Alle
            </button>
            <button 
              class="toggle-btn" 
              :class="{ active: feedFilter === 'subscribed' }" 
              @click="setFeedFilter('subscribed')"
            >
              Abonniert
            </button>
          </div>
        </div>

        <div class="read-filter-bar">
          <span class="read-filter-label">Statusfilter:</span>
          <button
            class="toggle-btn read-filter-btn"
            :class="{ active: showUnread }"
            @click="toggleReadFilter('unread')"
          >
            Ungelesen
          </button>
          <button
            class="toggle-btn read-filter-btn"
            :class="{ active: showRead }"
            @click="toggleReadFilter('read')"
          >
            Gelesen
          </button>
        </div>

        <MessageList
          :messages="visibleMessages"
          :loading="messagesLoading"
          :error="messagesError"
          :selectedTag="selectedTag"
          :showUnread="showUnread"
          :showRead="showRead"
          @reload="loadMessages"
          @marked-read="onMessageMarkedRead"
          @toggle-read-filter="toggleReadFilter"
        />
      </main>
    </div>
  </div>
</template>

<script>
import AppHeader from "../components/AppHeader.vue";
import TagFilter from "../components/TagFilter.vue";
import MessageList from "../components/MessageList.vue";
import CreateMessageForm from "../components/CreateMessageForm.vue";

import api from "../services/api";
import { getTags } from "../services/tagsService";
import { getSubscriptions } from "../services/subscriptionService";
import sseService from "../services/sseService";
import { notificationStore } from "../store/notifications";

const UNREAD_STORAGE_PREFIX = "newscenter_unread_";
const NEW_MESSAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

export default {
  name: "HomeView",
  components: { AppHeader, TagFilter, MessageList, CreateMessageForm },

  data() {
    return {
      searchTerm: "",
      tags: [],
      tagsLoading: true,
      tagsError: null,

      messages: [],
      messagesLoading: true,
      messagesError: null,

      selectedTag: null,
      feedFilter: "all",
      showUnread: true,
      showRead: true,
      subscriptions: [],
      newMessageRefreshTimer: null,

      createLoading: false,
      createError: null,
      createSuccess: null,
    };
  },

  async mounted() {
    await Promise.all([this.loadTags(), this.loadSubscriptions()]);
    await this.loadMessages();
    if (this.$route.query.message) {
      await this.goToNotificationMessage(this.$route.query.message);
    }
    this.newMessageRefreshTimer = setInterval(this.refreshMessageState, 60000);

    // Connect to the SSE live feed – server pushes a notification on every new message.
    sseService.connect();
    sseService.onMessage((data) => {
      this.markMessageUnread(data.id);

      try {
        // 1. Check if we should show a push notification
        // We read the current subscriptions from the TagFilter component
        if (this.$refs.tagFilter && data.tags) {
          const subscriptions = this.subscriptions;
          const subIds = subscriptions.map((subscription) => subscription.id);
          const subNames = this.tags
            .filter((t) => subIds.includes(t.id))
            .map((t) => t.name);
            
          const matchesSub = data.tags.some((tag) => subNames.includes(tag));
          if (matchesSub) {
            notificationStore.addNotification(data);
            notificationStore.addToast(data);
          }
        }
      } catch (e) {
        console.error("Notification error:", e);
      }

      // 2. Silently refresh the feed without showing a loading spinner.
      if (this.searchTerm) {
        this.searchMessages(true);
      } else {
        this.loadMessages(true);
      }
    });
  },

  beforeUnmount() {
    if (this.newMessageRefreshTimer) {
      clearInterval(this.newMessageRefreshTimer);
    }
    sseService.disconnect();
  },

  computed: {
    visibleMessages() {
      return this.messages.filter((message) => {
        const isUnread = message.isUnread === true;
        return (isUnread && this.showUnread) || (!isUnread && this.showRead);
      });
    },
  },

  methods: {
    async goToNotificationMessage(messageId) {
      if (!messageId) return;

      this.searchTerm = "";
      this.selectedTag = null;
      this.feedFilter = "all";
      this.showUnread = true;
      this.showRead = true;

      await this.loadMessages();
      await this.$nextTick();

      const target = document.getElementById(`message-${messageId}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },

    unreadStorageKey(messageId) {
      return `${UNREAD_STORAGE_PREFIX}${messageId}`;
    },

    isMessageNew(message) {
      const createdAt = new Date(message.createdAt).getTime();
      if (Number.isNaN(createdAt)) return false;

      const age = Date.now() - createdAt;
      return age >= 0 && age <= NEW_MESSAGE_WINDOW_MS;
    },

    messageHasSubscribedTag(message) {
      const subscribedTagNames = this.subscriptions.map((subscription) => subscription.name);
      return (message.tags || []).some((tag) => subscribedTagNames.includes(tag));
    },

    getMessageUnreadState(message, isSubscribedNew) {
      const storedValue = localStorage.getItem(this.unreadStorageKey(message.id));
      if (!this.isMessageNew(message)) return false;
      if (storedValue === "true") return true;
      if (storedValue === "false") return false;
      return isSubscribedNew;
    },

    withMessageState(messages) {
      return messages.map((message) => {
        const isNew = this.isMessageNew(message);
        const isSubscribedNew = isNew && this.messageHasSubscribedTag(message);

        return {
          ...message,
          isNew,
          isSubscribedNew,
          isUnread: this.getMessageUnreadState(message, isSubscribedNew),
        };
      });
    },

    refreshMessageState() {
      this.messages = this.withMessageState(this.messages);
      this.syncNotifications();
    },

    syncNotifications() {
      notificationStore.setNewSubscribed(
        this.messages.filter((message) => message.isSubscribedNew)
      );
    },

    markMessageUnread(messageId) {
      if (localStorage.getItem(this.unreadStorageKey(messageId)) === "false") return;

      localStorage.setItem(this.unreadStorageKey(messageId), "true");
      this.messages = this.messages.map((message) => (
        message.id === messageId ? { ...message, isUnread: true } : message
      ));
      this.syncNotifications();
    },

    async searchMessages(isBackground = false) {
      if (!isBackground) {
        this.messagesLoading = true;
      }

      this.messagesError = null;

      try {
        if (!this.searchTerm) {
          await this.loadMessages(isBackground);
          return;
        }

        const response = await api.get(
            `/messages/search?q=${encodeURIComponent(this.searchTerm)}`
        );

        this.messages = this.withMessageState(response.data);
        this.syncNotifications();
      } catch (e) {
        if (!isBackground) {
          this.messagesError = e?.response?.data?.error || e?.message || String(e);
        } else {
          console.error("Search polling error:", e);
        }
      } finally {
        this.messagesLoading = false;
      }
    },

    async clearSearch() {
      this.searchTerm = "";
      await this.loadMessages();
    },

    async refreshAll() {
      await Promise.all([this.loadTags(), this.loadSubscriptions()]);
      await this.loadMessages();
    },

    async loadSubscriptions() {
      try {
        this.subscriptions = await getSubscriptions();
      } catch (e) {
        console.error("Subscription loading error:", e);
        this.subscriptions = [];
      }
    },

    onSubscriptionsChanged(subscriptions) {
      this.subscriptions = subscriptions;
      this.refreshMessageState();
    },

    onSelectTag(tagName) {
      this.selectedTag = tagName;
      this.loadMessages(); 
    },

    setFeedFilter(filter) {
      this.feedFilter = filter;
      this.loadMessages();
    },

    toggleReadFilter(filter) {
      if (filter === "unread") {
        if (this.showUnread && !this.showRead) return;
        this.showUnread = !this.showUnread;
        return;
      }

      if (this.showRead && !this.showUnread) return;
      this.showRead = !this.showRead;
    },

    async loadTags(isBackground = false) {
      if (!isBackground) {
        this.tagsLoading = true;
      }
      this.tagsError = null;
      try {
        this.tags = await getTags();
      } catch (e) {
        // Fehler im Hintergrund nur loggen, nicht dem User zeigen
        if (!isBackground) {
           this.tagsError = e?.message || String(e);
        } else {
           console.error("Tag polling error:", e);
        }
      } finally {
        this.tagsLoading = false;
      }
    },

    async loadMessages(isBackground = false) {
      // Nur Ladebalken zeigen, wenn es KEIN Hintergrund-Update ist
      if (!isBackground) {
        this.messagesLoading = true;
      }
      
      this.messagesError = null;
      try {
        let url = `/messages?filter=${this.feedFilter}`;
        
        if (this.selectedTag) {
          url += `&tag=${encodeURIComponent(this.selectedTag)}`;
        }

        const response = await api.get(url);
        this.messages = this.withMessageState(response.data);
        this.syncNotifications();

      } catch (e) {
        if (!isBackground) {
            this.messagesError = e?.message || String(e);
        } else {
            console.error("Polling error:", e);
        }
      } finally {
        this.messagesLoading = false;
      }
    },

    async onCreateMessage(payload) {
      this.createLoading = true;
      this.createError = null;
      this.createSuccess = null;

      try {
        if (!payload.title || !payload.body || !payload.tagId || !payload.targetRole) {
          throw new Error("Bitte Titel, Text, Thema und Zielgruppe wählen.");
        }

        const msgResponse = await api.post('/messages', {
          title: payload.title,
          body: payload.body,
          targetRole: payload.targetRole
        });
        
        const newMessageId = msgResponse.data.id;

        await api.post(`/messages/${newMessageId}/tags`, {
          tagId: payload.tagId
        });

        this.markMessageUnread(newMessageId);

        this.createSuccess = "Nachricht erfolgreich veröffentlicht!";
        
        // Feed neu laden
        await this.loadMessages();

      } catch (e) {
        this.createError = e?.response?.data?.error || e?.message || String(e);
      } finally {
        this.createLoading = false;
        if (this.createSuccess) {
          setTimeout(() => (this.createSuccess = null), 3000);
        }
      }
    },

    onMessageMarkedRead(messageId) {
      localStorage.setItem(this.unreadStorageKey(messageId), "false");
      this.messages = this.messages.map((message) => (
        message.id === messageId ? { ...message, isUnread: false } : message
      ));
      this.syncNotifications();
    },

    markSubscribedNewNotificationsRead() {
      this.messages
        .filter((message) => message.isSubscribedNew)
        .forEach((message) => {
          localStorage.setItem(this.unreadStorageKey(message.id), "false");
        });

      this.messages = this.messages.map((message) => (
        message.isSubscribedNew ? { ...message, isUnread: false } : message
      ));
      notificationStore.markAllRead();
    },
  },
};
</script>

<style scoped src="../styles/HomeView.css"></style>
