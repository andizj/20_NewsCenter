<template>
  <aside class="panel">
    <div class="panelHeader">
      <div>
        <div class="panelTitle">Themen</div>
        <div class="panelSub">Filtere & Abonniere Tags</div>
      </div>
      <button class="mini" @click="refreshData">Reload</button>
    </div>

    <div v-if="loading" class="hint">Lade Tags…</div>
    <div v-else-if="error" class="error">Fehler: {{ error }}</div>

    <div v-else class="tag-list">
      
      <div 
        class="tag-row"
        :class="{ active: selected === null }"
        @click="$emit('select', null)"
      >
        <span class="tag-name">Alle Nachrichten</span>
      </div>

      <div 
        v-for="t in tags" 
        :key="t.id" 
        class="tag-row"
        :class="{ active: selected === t.name }"
        @click="$emit('select', t.name)"
      >
        <span class="tag-name"># {{ t.name }}</span>
        
        <button 
          class="star-btn"
          :class="{ subscribed: isSubscribed(t.id) }"
          @click.stop="toggleSubscription(t)"
          title="Abonnieren"
        >
          <span v-if="isSubscribed(t.id)">★</span>
          <span v-else>☆</span>
        </button>
      </div>
    </div>

    <div class="add-tag-wrapper">
      <input 
        v-model="newTagName" 
        @keyup.enter="addTag"
        placeholder="Neuer Tag..." 
        class="input-mini"
      />
      <button class="btn-mini-add" @click="addTag" :disabled="!newTagName">+</button>
    </div>

    <div class="footer">
      Filter: <strong>{{ selected ?? "Alle" }}</strong>
    </div>
  </aside>
</template>

<script>
import { getSubscriptions, subscribe, unsubscribe } from '../services/subscriptionService';
// NEU: createTag importieren
import { createTag } from '../services/tagsService';

export default {
  name: "TagFilter",
  props: {
    tags: { type: Array, required: true },
    selected: { type: [String, null], default: null },
    loading: Boolean,
    error: String,
  },
  emits: ["select", "reload"],
  
  data() {
    return {
      mySubscriptions: [],
      newTagName: "" // Für das Eingabefeld
    };
  },

  async mounted() {
    await this.loadSubscriptions();
  },

  methods: {
    async loadSubscriptions() {
      try {
        const subs = await getSubscriptions();
        this.mySubscriptions = subs.map(s => s.id); 
      } catch (e) {
        console.error("Konnte Abos nicht laden", e);
      }
    },

    isSubscribed(tagId) {
      return this.mySubscriptions.includes(tagId);
    },

    async toggleSubscription(tag) {
      const id = tag.id;
      if (this.isSubscribed(id)) {
        this.mySubscriptions = this.mySubscriptions.filter(subId => subId !== id);
        try { await unsubscribe(id); } catch (e) { this.mySubscriptions.push(id); }
      } else {
        this.mySubscriptions.push(id);
        try { await subscribe(id); } catch (e) { this.mySubscriptions = this.mySubscriptions.filter(subId => subId !== id); }
      }
    },

    refreshData() {
      this.$emit('reload'); 
      this.loadSubscriptions(); 
    },

    // NEU: Tag an das Backend senden
    async addTag() {
      if (!this.newTagName.trim()) return;
      
      try {
        await createTag(this.newTagName);
        this.newTagName = ""; // Feld leeren
        this.$emit('reload'); // Liste neu laden, damit der neue Tag erscheint
      } catch (e) {
        alert("Fehler: " + (e.response?.data?.error || e.message));
      }
    }
  }
};
</script>

<style scoped>
/* Bestehende Styles */
.panel {
  border: 1px solid #2a2f3a;
  border-radius: 16px;
  padding: 14px;
  background: rgba(255,255,255,0.03);
  position: sticky;
  top: 14px;
}
.panelHeader { display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 12px; }
.panelTitle { font-weight: 800; }
.panelSub { font-size: 12px; color: #a9b1c3; margin-top: 2px; }

.tag-list { display: flex; flex-direction: column; gap: 4px; }

.tag-row {
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: #a9b1c3;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.tag-row:hover { background: rgba(255,255,255,0.06); color: #e9eefc; }
.tag-row.active { background: rgba(120, 160, 255, 0.1); border-color: rgba(120, 160, 255, 0.3); color: #fff; }
.tag-name { font-size: 13px; font-weight: 500; }

.star-btn {
  background: none; border: none; cursor: pointer; font-size: 1.2rem;
  color: #4a5568; line-height: 1; padding: 4px; border-radius: 4px;
  transition: transform 0.2s;
}
.star-btn:hover { background: rgba(255,255,255,0.1); transform: scale(1.1); }
.star-btn.subscribed { color: #f1c40f; }

.mini { padding: 6px 10px; border-radius: 8px; border: 1px solid #3a4354; background: rgba(255,255,255,0.05); cursor: pointer; color: inherit; font-size: 11px; }
.hint { margin-top: 10px; color: #a9b1c3; font-size: 12px; }
.error { margin-top: 10px; color: #ff6b6b; font-size: 12px; }
.footer { margin-top: 14px; font-size: 12px; color: #a9b1c3; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;}

/* --- NEU: Styles für das Eingabefeld --- */
.add-tag-wrapper {
  margin-top: 15px;
  display: flex;
  gap: 5px;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 10px;
}
.input-mini {
  flex: 1;
  background: rgba(0,0,0,0.2);
  border: 1px solid #3a4354;
  border-radius: 8px;
  padding: 6px 10px;
  color: #fff;
  font-size: 12px;
}
.btn-mini-add {
  background: rgba(120,160,255,0.18);
  border: 1px solid #4b5a78;
  color: #e9eefc;
  border-radius: 8px;
  width: 30px;
  cursor: pointer;
  font-weight: bold;
}
.btn-mini-add:hover { background: rgba(120,160,255,0.3); }

@media (max-width: 900px) {
  .panel {
    position: static; 
    margin-bottom: 20px; 
  }
}
</style>