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
        // Wir zwingen das Format auf Deutsch und blenden die Sekunden aus
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

<style scoped>
.card {
  border: 1px solid #2a2f3a;
  border-radius: 16px;
  padding: 16px;
  background: rgba(255,255,255,0.03);
  display: flex;
  flex-direction: column;
  gap: 12px; /* Sorgt für schöne, gleichmäßige Abstände zwischen den Bereichen */
}

/* NEU: Header-Bereich für Autor und Datum */
.header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
}
.author-info { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
}

.title { 
  margin: 0; 
  font-size: 18px; 
  font-weight: 800; 
  color: #ffffff;
}

.body { 
  margin: 0; 
  color: #dbe2f2; 
  line-height: 1.45; 
}

.date { 
  font-size: 12px; 
  color: #a9b1c3; 
  white-space: nowrap; 
}

/* Tags Styling */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.tag {
  background: rgba(100, 160, 255, 0.1);
  color: #82aaff;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: lowercase;
}

/* Badges & Pills */
.pill {
  border: 1px solid #3a4354;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.02);
  font-size: 11px;
  color: #a9b1c3;
}
.code {
  color: #cfd6e6;
  background: rgba(0,0,0,0.25);
  border: 1px solid #3a4354;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 12px;
}
.roleBadge {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.roleBadge.student { background: rgba(100, 150, 255, 0.15); color: #6ea8ff; }
.roleBadge.employee { background: rgba(255, 180, 100, 0.15); color: #ffb464; }
.roleBadge.all { background: rgba(150, 150, 150, 0.15); color: #ccc; }
</style>