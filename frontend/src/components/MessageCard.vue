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
export default {
  name: "MessageCard",
  props: {
    message: { type: Object, required: true },
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
    }
  },
};
</script>

<style scoped src="../styles/MessageCard.css"></style>