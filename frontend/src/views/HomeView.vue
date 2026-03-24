<template>
  <div class="page">
    <AppHeader @refresh="refreshAll" />

    <div class="layout">
      <TagFilter
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

      createLoading: false,
      createError: null,
      createSuccess: null,
      
      pollingInterval: null, 
    };
  },

  async mounted() {
    await Promise.all([this.loadTags(), this.loadMessages()]);

    this.pollingInterval = setInterval(() => {
      if (this.searchTerm) {
        this.searchMessages(true);
      } else {
        this.loadMessages(true);
      }
      this.loadTags(true);
    }, 10000);
  },

  beforeUnmount() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
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
        let url = '/messages';
        
        if (this.selectedTag) {
          url += `?tag=${encodeURIComponent(this.selectedTag)}`;
        }

        const response = await api.get(url);
        this.messages = response.data;

      } catch (e) {
        // Fehler im Hintergrund ignorieren wir meistens, oder loggen sie nur
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

<style scoped>

.btn {
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid #3a4354;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  cursor: pointer;
}

.searchBar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.searchInput {
  flex: 1;
  border: 1px solid #3a4354;
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(0,0,0,0.25);
  color: #e9eefc;
}

.page { display: grid; gap: 14px; }
.layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 14px;
  align-items: start;
}
.main { display: grid; gap: 14px; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
}
</style>