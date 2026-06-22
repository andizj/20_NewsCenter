<template>
  <article
    :id="`message-${message.id}`"
    class="card"
    :class="{ unread: message.isUnread }"
    @mouseenter="startMarkAsReadTimer"
    @mouseleave="clearMarkAsReadTimer"
  >
    
    <div class="header">
      <div class="author-info">
        <code class="code">{{ message.authorName }}</code>
      </div>
      <div class="meta">
        <span class="readStatus" :class="{ unread: message.isUnread }">
          {{ message.isUnread ? "Ungelesen" : "Gelesen" }}
        </span>
        <div class="date">{{ formatDate(message.createdAt) }}</div>
      </div>
    </div>

    <h3 class="title">{{ message.title }}</h3>

    <p class="body">{{ message.body }}</p>
    <div class="aiActions">
      <button v-if="summaryDisabled" class="aiBtn" @click="setSummaryDisabled(false)">
        🤖 Zusammenfassung aktivieren
      </button>

      <template v-else>
        <button v-if="!summary" class="aiBtn" @click="summarizeMessage" :disabled="summaryLoading">
          {{ summaryButtonLabel }}
        </button>
        <button
          v-if="autoSummarize || summary"
          class="aiBtn secondary"
          @click="setSummaryDisabled(true)"
        >
          🤖 Zusammenfassung deaktivieren
        </button>
      </template>
    </div>

    <div v-if="summary && !summaryDisabled" class="summaryBox">
      <strong>Zusammenfassung:</strong>
      <p>{{ summary }}</p>
    </div>
    
    <div class="tags" v-if="message.tags && message.tags.length > 0">
      <span class="roleBadge" :class="message.targetRole?.toLowerCase()">
          {{ formatRole(message.targetRole) }}
      </span>
      <span class="tag" v-for="(tag, index) in message.tags" :key="index">
        #{{ tag }}
      </span>
    </div>

  </article>
</template>

<script>
import api from "../services/api";

const MARK_AS_READ_DELAY_MS = 1500;
const SUMMARY_DISABLED_STORAGE_PREFIX = "newscenter_summary_disabled_";

export default {
  name: "MessageCard",
  emits: ["marked-read"],
  props: {
    message: { type: Object, required: true },
    autoSummarize: { type: Boolean, default: false },
  },
  data() {
    return {
      summary: null,
      summaryLoading: false,
      summaryDisabled: false,
      summaryRequestId: 0,
      markAsReadTimer: null,
    };
  },
  computed: {
    summaryButtonLabel() {
      if (this.summaryLoading) return "Wird zusammengefasst...";
      return "🤖 Zusammenfassung";
    },
  },
  watch: {
    autoSummarize() {
      this.summarizeIfEnabled();
    },
    "message.id"() {
      this.summary = null;
      this.summaryLoading = false;
      this.summaryRequestId += 1;
      this.loadSummaryDisabledState();
      this.summarizeIfEnabled();
    },
  },
  mounted() {
    this.loadSummaryDisabledState();
    this.summarizeIfEnabled();
  },
  beforeUnmount() {
    this.summaryRequestId += 1;
    this.clearMarkAsReadTimer();
  },
  methods: {
    summaryDisabledStorageKey() {
      return `${SUMMARY_DISABLED_STORAGE_PREFIX}${this.message.id}`;
    },

    loadSummaryDisabledState() {
      this.summaryDisabled = localStorage.getItem(this.summaryDisabledStorageKey()) === "true";
    },

    setSummaryDisabled(disabled) {
      this.summaryDisabled = disabled;

      if (disabled) {
        localStorage.setItem(this.summaryDisabledStorageKey(), "true");
        this.summaryRequestId += 1;
        this.summaryLoading = false;
        return;
      }

      localStorage.removeItem(this.summaryDisabledStorageKey());
      this.summarizeIfEnabled();
    },

    summarizeIfEnabled() {
      if (!this.autoSummarize || this.summary || this.summaryLoading || this.summaryDisabled) return;
      this.summarizeMessage();
    },

    startMarkAsReadTimer() {
      if (!this.message.isUnread || this.markAsReadTimer) return;

      this.markAsReadTimer = setTimeout(() => {
        this.markAsReadTimer = null;
        this.$emit("marked-read", this.message.id);
      }, MARK_AS_READ_DELAY_MS);
    },

    clearMarkAsReadTimer() {
      if (!this.markAsReadTimer) return;

      clearTimeout(this.markAsReadTimer);
      this.markAsReadTimer = null;
    },

    formatDate(iso) {
      try {
        const date = new Date(iso);
        return date.toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) + ' Uhr';
      } catch {
        return iso;
      }
    },
    formatRole(role) {
      if (role === "STUDENT") return "🎓 Student";
      if (role === "EMPLOYEE") return "🏢 Employee";
      return "🌍 All";
    },

    async summarizeMessage() {
      if (this.summaryLoading || this.summaryDisabled) return;

      const requestId = this.summaryRequestId + 1;
      this.summaryRequestId = requestId;
      this.summaryLoading = true;

      try {
        const response = await api.post(`/messages/${this.message.id}/summarize`);
        if (requestId === this.summaryRequestId && !this.summaryDisabled) {
          this.summary = response.data.summary;
        }
      } catch (err) {
        console.error("Summary error:", err);
        if (requestId === this.summaryRequestId && !this.summaryDisabled) {
          this.summary = "Zusammenfassung konnte nicht erstellt werden.";
        }
      } finally {
        if (requestId === this.summaryRequestId) {
          this.summaryLoading = false;
        }
      }
    },
  },
};
</script>

<style scoped src="../styles/MessageCard.css"></style>
