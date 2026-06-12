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
import { useSubscriptions } from '../composables/useSubscriptions';
import { subscribe, unsubscribe } from '../services/subscriptionService';
import { createTag } from '../services/tagsService';

export default {
  name: "TagFilter",
  props: {
    tags: { type: Array, required: true },
    selected: { type: [String, null], default: null },
    loading: Boolean,
    error: String,
  },
  emits: ["select", "reload", "subscriptions-changed"],

  setup() {
    const { subscriptions, isSubscribed, load } = useSubscriptions();
    return { subscriptions, isSubscribed, load };
  },

  data() {
    return { newTagName: "" };
  },

  async mounted() {
    await this.load().catch(e => console.error("Konnte Abos nicht laden", e));
    this.$emit("subscriptions-changed", this.subscriptions);
  },

  methods: {
    async toggleSubscription(tag) {
      const id = tag.id;
      if (this.isSubscribed(id)) {
        this.subscriptions = this.subscriptions.filter(s => s.id !== id);
        try { await unsubscribe(id); }
        catch { await this.load(); }
      } else {
        this.subscriptions = [...this.subscriptions, tag];
        try { await subscribe(id); }
        catch { this.subscriptions = this.subscriptions.filter(s => s.id !== id); }
      }
      this.$emit("subscriptions-changed", this.subscriptions);
    },

    async refreshData() {
      this.$emit('reload');
      await this.load();
      this.$emit("subscriptions-changed", this.subscriptions);
    },

    async addTag() {
      if (!this.newTagName.trim()) return;
      try {
        await createTag(this.newTagName);
        this.newTagName = "";
        this.$emit('reload');
      } catch (e) {
        alert("Fehler: " + (e.response?.data?.error || e.message));
      }
    }
  }
};
</script>

<style scoped src="../styles/TagFilter.css"></style>
