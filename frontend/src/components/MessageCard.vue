<template>
  <article class="card">
    <div class="top">
      <h3 class="title">{{ message.title }}</h3>
      <div class="date">{{ formatDate(message.createdAt) }}</div>
    </div>

    <p class="body">{{ message.body }}</p>

    <div class="meta">
      <span class="pill">author</span>
      <code class="code">{{ message.authorName }}</code>
    </div>
  </article>
</template>

<script>
export default {
  name: "MessageCard",
  props: {
    message: { type: Object, required: true },
  },
  methods: {
    formatDate(iso) {
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    },
  },
};
</script>

<style scoped>
.card {
  border: 1px solid #2a2f3a;
  border-radius: 16px;
  padding: 14px;
  background: rgba(255,255,255,0.03);
}
.top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.title { margin: 0; font-size: 16px; font-weight: 800; }
.date { font-size: 12px; color: #a9b1c3; white-space: nowrap; }
.body { margin: 10px 0 12px; color: #dbe2f2; line-height: 1.35; }
.meta { display: flex; align-items: center; gap: 10px; color: #a9b1c3; font-size: 12px; }
.pill {
  border: 1px solid #3a4354;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.02);
}
.code {
  color: #cfd6e6;
  background: rgba(0,0,0,0.25);
  border: 1px solid #3a4354;
  padding: 3px 8px;
  border-radius: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
