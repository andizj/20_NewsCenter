<template>
  <article class="card">
    <div class="top">
      <h3 class="title">{{ message.title }}</h3>
      <div class="date">{{ formatDate(message.createdAt) }}</div>
    </div>

    <p class="body">{{ message.body }}</p>

    <div class="tags" v-if="message.tags && message.tags.length > 0">
      <span class="tag" v-for="(tag, index) in message.tags" :key="index">
        #{{ tag }}
      </span>
    </div>

    <div class="meta">
      <span class="pill">author</span>
      <code class="code">{{ message.authorName }}</code>
      <span class="roleBadge" :class="message.targetRole?.toLowerCase()">
        {{ formatRole(message.targetRole) }}
      </span>
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
    formatRole(role) {
      if (role === "STUDENT") return "🎓 Student";
      if (role === "EMPLOYEE") return "🏢 Employee";
      return "🌍 All";
    }
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

/* NEU: CSS für die Tags */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.tag {
  background: rgba(100, 160, 255, 0.1);
  color: #82aaff;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: lowercase;
}

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
.roleBadge {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 6px;
}
.roleBadge.student { background: rgba(100, 150, 255, 0.15); color: #6ea8ff; }
.roleBadge.employee { background: rgba(255, 180, 100, 0.15); color: #ffb464; }
.roleBadge.all { background: rgba(150, 150, 150, 0.15); color: #ccc; }
</style>