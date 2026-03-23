<template>
  <section class="panel">
    <div class="panelHeader">
      <div>
        <div class="panelTitle">Latest messages</div>
        <div class="panelSub">
          Showing: <strong>{{ selectedTag ?? "All" }}</strong>
        </div>
      </div>

      <button class="btn" @click="$emit('reload')" :disabled="loading">
        {{ loading ? "Loading…" : "Reload" }}
      </button>
    </div>

    <div v-if="loading" class="hint">Loading messages…</div>
    <div v-else-if="error" class="error">Failed to load messages: {{ error }}</div>

    <div v-else class="grid">
      <MessageCard v-for="m in messages" :key="m.id" :message="m" />
    </div>

    <div v-if="!loading && !error && messages.length === 0" class="hint">
      No messages found.
    </div>
  </section>
</template>

<script>
import MessageCard from "./MessageCard.vue";

export default {
  name: "MessageList",
  components: { MessageCard },
  props: {
    messages: { type: Array, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String, default: null },
    selectedTag: { type: [String, null], default: null },
  },
};
</script>

<style scoped>
.panel {
  border: 1px solid #2a2f3a;
  border-radius: 16px;
  padding: 14px;
  background: rgba(255,255,255,0.03);
}
.panelHeader { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
.panelTitle { font-weight: 800; }
.panelSub { font-size: 12px; color: #a9b1c3; margin-top: 2px; }
.btn {
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid #3a4354;
  background: rgba(255,255,255,0.05);
  color: inherit;
  cursor: pointer;
}
.btn:hover { background: rgba(255,255,255,0.08); }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.grid { display: grid; gap: 12px; margin-top: 12px; }
.hint { margin-top: 10px; color: #a9b1c3; font-size: 12px; }
.error { margin-top: 10px; color: #ff6b6b; font-size: 12px; }
</style>
