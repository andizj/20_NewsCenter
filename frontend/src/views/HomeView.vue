<template>
  <div class="page">
    <AppHeader @refresh="refreshAll" />

    <div class="layout">
      <TagFilter
        ref="tagFilter"
        :tags="tags"
        :selected="selectedTag"
        :loading="tagsLoading"
        :error="tagsError"
        @select="onSelectTag"
        @reload="loadTags"
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

        <MessageList
          :messages="messages"
          :loading="messagesLoading"
          :error="messagesError"
          :selectedTag="selectedTag"
          @reload="loadMessages"
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
import sseService from "../services/sseService";
import { notificationStore } from "../store/notifications";

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

      createLoading: false,
      createError: null,
      createSuccess: null,
    };
  },

  async mounted() {
    await Promise.all([this.loadTags(), this.loadMessages()]);

    // Connect to the SSE live feed – server pushes a notification on every new message.
    sseService.connect();
    sseService.onMessage((data) => {
      // 1. Check if we should show a push notification
      // We read the current subscriptions from the TagFilter component
      if (this.$refs.tagFilter && data.tags) {
        const subIds = this.$refs.tagFilter.mySubscriptions;
        const subNames = this.tags
          .filter((t) => subIds.includes(t.id))
          .map((t) => t.name);
          
        const matchesSub = data.tags.some((tag) => subNames.includes(tag));
        if (matchesSub) {
          notificationStore.addNotification(data);
          notificationStore.addToast(data);
        }
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
    sseService.disconnect();
  },

  methods: {
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

        this.messages = response.data;
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
      await Promise.all([this.loadTags(), this.loadMessages()]);
    },

    onSelectTag(tagName) {
      this.selectedTag = tagName;
      this.loadMessages(); 
    },

    setFeedFilter(filter) {
      this.feedFilter = filter;
      this.loadMessages();
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
        this.messages = response.data;

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
  },
};
</script>

<style scoped src="../styles/HomeView.css"></style>