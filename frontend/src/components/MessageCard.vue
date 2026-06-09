<template>
  <article class="card">
    
    <div class="header">
      <div class="author-info">
        <code class="code">{{ message.authorName }}</code>
      </div>
      <div class="date">{{ formatDate(message.createdAt) }}</div>
    </div>

    <h3 class="title">{{ message.title }}</h3>

    <p class="body">{{ message.body }}</p>
    <div class="aiActions">
      <button class="aiBtn" @click="summarizeMessage" :disabled="summaryLoading">
        {{ summaryLoading ? "Wird zusammengefasst..." : "KI-Zusammenfassung" }}
      </button>
    </div>

    <div v-if="summary" class="summaryBox">
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
export default {
  name: "MessageCard",
  props: {
    message: { type: Object, required: true },
  },
  data() {
    return {
      summary: null,
      summaryLoading: false,
    };
  },
  methods: {
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
    this.summaryLoading = true;

    try {
      const response = await api.post(`/messages/${this.message.id}/summarize`);
      this.summary = response.data.summary;
    } catch (err) {
      console.error("Summary error:", err);
      this.summary = "Zusammenfassung konnte nicht erstellt werden.";
    } finally {
      this.summaryLoading = false;
    }
  },
  },
};
</script>

<style scoped src="../styles/MessageCard.css"></style>