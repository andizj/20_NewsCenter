<template>
  <section class="panel">
    <div class="panelHeader">
      <div>
        <div class="panelTitle">Aktuelle Nachrichten</div>
        <div class="panelSub">
          Anzeige: <strong>{{ selectedTag ?? "Alle" }}</strong>
        </div>
        <div class="panelReadFilters">
          <span>Status:</span>
          <button
            class="readFilterBtn"
            :class="{ active: showUnread }"
            @click="$emit('toggle-read-filter', 'unread')"
          >
            Ungelesen
          </button>
          <button
            class="readFilterBtn"
            :class="{ active: showRead }"
            @click="$emit('toggle-read-filter', 'read')"
          >
            Gelesen
          </button>
        </div>
      </div>

      <button class="btn" @click="$emit('reload')" :disabled="loading">
        {{ loading ? "Loading…" : "Reload" }}
      </button>
    </div>

    <div v-if="loading" class="hint">Nachrichten werden geladen…</div>
    <div v-else-if="error" class="error">Fehler beim Laden der Nachrichten: {{ error }}</div>

    <div v-else class="grid">
      <MessageCard
        v-for="m in messages"
        :key="m.id"
        :message="m"
        :autoSummarize="autoSummarize"
        @marked-read="$emit('marked-read', $event)"
      />
    </div>

    <div v-if="!loading && !error && messages.length === 0" class="hint">
      Keine Nachrichten gefunden.
    </div>
  </section>
</template>

<script>
import MessageCard from "./MessageCard.vue";

export default {
  name: "MessageList",
  components: { MessageCard },
  emits: ["reload", "marked-read", "toggle-read-filter"],
  props: {
    messages: { type: Array, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String, default: null },
    selectedTag: { type: [String, null], default: null },
    showUnread: { type: Boolean, default: true },
    showRead: { type: Boolean, default: true },
    autoSummarize: { type: Boolean, default: false },
  },
};
</script>

<style scoped src="../styles/MessageList.css"></style>
