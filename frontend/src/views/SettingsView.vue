<template>
  <div class="page">
    <AppHeader />

    <div class="settings-layout">

      <!-- Page title -->
      <div class="page-header">
        <h1 class="page-title">⚙️ Einstellungen</h1>
        <p class="page-sub">Verwalte deine Agenten und Präferenzen</p>
      </div>

      <!-- ─────────────── Role Agent ─────────────── -->
      <section class="agent-card role-agent">
        <div class="agent-header">
          <span class="agent-icon">🛡️</span>
          <div>
            <div class="agent-title">Rollen Agent</div>
            <div class="agent-desc">Deine Systemrolle wird automatisch via LDAP vergeben und kann hier nicht geändert werden.</div>
          </div>
        </div>
        <div class="role-display">
          <span class="role-badge" :class="roleBadgeClass">{{ userRole }}</span>
          <span class="role-hint">Vergeben durch LDAP · Nur zur Anzeige</span>
        </div>
      </section>

      <!-- ─────────────── Two-column row ─────────────── -->
      <div class="agents-row">

        <!-- Tag Agent -->
        <section class="agent-card tag-agent">
          <div class="agent-header">
            <span class="agent-icon">🏷️</span>
            <div>
              <div class="agent-title">Tag Agent</div>
              <div class="agent-desc">Verwalte deine abonnierten Tags direkt hier.</div>
            </div>
          </div>

          <div v-if="subsLoading" class="agent-loading">Lade Abonnements…</div>
          <div v-else>
            <div class="tag-list">
              <div
                v-for="tag in subscribedTags"
                :key="tag.id"
                class="tag-row"
              >
                <span class="tag-name"># {{ tag.name }}</span>
                <button class="remove-btn" @click="removeSub(tag)" :disabled="removing === tag.id">
                  <span v-if="removing === tag.id">…</span>
                  <span v-else>✕</span>
                </button>
              </div>
              <div v-if="subscribedTags.length === 0" class="tag-empty">
                Noch keine Tags abonniert.
              </div>
            </div>

            <!-- Add tag -->
            <div class="add-tag-row">
              <select v-model="selectedNewTag" class="tag-select">
                <option value="">+ Tag hinzufügen…</option>
                <option
                  v-for="tag in availableTags"
                  :key="tag.id"
                  :value="tag.id"
                >
                  # {{ tag.name }}
                </option>
              </select>
              <button
                class="add-btn"
                :disabled="!selectedNewTag || adding"
                @click="addSub"
              >
                {{ adding ? '…' : 'Hinzufügen' }}
              </button>
            </div>

            <p v-if="subError" class="error-msg">{{ subError }}</p>
          </div>
        </section>

        <!-- Publish Agent -->
        <section class="agent-card publish-agent">
          <div class="agent-header">
            <span class="agent-icon">📢</span>
            <div>
              <div class="agent-title">Publish Agent</div>
              <div class="agent-desc">KI-gestützte Vorschläge beim Verfassen von Nachrichten.</div>
            </div>
          </div>

          <div class="toggle-row">
            <span class="toggle-label">Auto-Tagging Vorschläge</span>
            <button
              class="toggle-switch"
              :class="{ on: publishAgent.autoTagging }"
              @click="publishAgent.autoTagging = !publishAgent.autoTagging"
            >
              <span class="toggle-knob" />
            </button>
          </div>

          <div class="coming-soon">
            <span class="cs-badge">Bald verfügbar</span>
            KI schlägt passende Tags basierend auf deinem Text vor.
          </div>
        </section>
      </div>

      <!-- Message Agent -->
      <section class="agent-card message-agent">
        <div class="agent-header">
          <span class="agent-icon">🤖</span>
          <div>
            <div class="agent-title">Message Agent</div>
            <div class="agent-desc">KI-Funktionen für einzelne Nachrichten im Feed.</div>
          </div>
        </div>

        <div class="message-agent-grid">
          <div class="toggle-row">
            <div>
              <div class="toggle-label">Nachrichten zusammenfassen</div>
              <div class="toggle-sublabel">Zeigt eine KI-generierte Kurzzusammenfassung unterhalb jeder Nachricht an.</div>
            </div>
            <button
              class="toggle-switch"
              :class="{ on: messageAgent.summarize }"
              @click="toggleMessageSummaries"
            >
              <span class="toggle-knob" />
            </button>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Ähnliche Nachrichten anzeigen</div>
              <div class="toggle-sublabel">Zeigt semantisch ähnliche Nachrichten am Ende jedes Posts an.</div>
            </div>
            <button
              class="toggle-switch"
              :class="{ on: messageAgent.similarMessages }"
              @click="messageAgent.similarMessages = !messageAgent.similarMessages"
            >
              <span class="toggle-knob" />
            </button>
          </div>
        </div>

        <div class="coming-soon">
          <span class="cs-badge">Hinweis</span>
          Zusammenfassungen werden automatisch im Feed angezeigt. Ähnliche Nachrichten sind noch in Entwicklung.
        </div>
      </section>

    </div>
  </div>
</template>

<script>
import AppHeader from '../components/AppHeader.vue';
import { useSubscriptions } from '../composables/useSubscriptions';
import { getTags } from '../services/tagsService';

const SUMMARIZE_MESSAGES_STORAGE_KEY = 'newscenter_summarize_messages';

export default {
  name: 'SettingsView',
  components: { AppHeader },

  setup() {
    const { subscriptions, loading, load, addSubscription, removeSubscription } = useSubscriptions();
    return {
      subscribedTags: subscriptions,
      subsLoading: loading,
      loadSubscriptions: load,
      addSubscription,
      removeSubscription,
    };
  },

  data() {
    const userRaw = sessionStorage.getItem('user');
    let userRole = 'UNBEKANNT';
    try { userRole = JSON.parse(userRaw)?.role ?? 'UNBEKANNT'; } catch (e) { /* invalid JSON */ }

    return {
      userRole,
      allTags: [],
      subError: null,
      selectedNewTag: '',
      adding: false,
      removing: null,
      publishAgent: { autoTagging: true },
      messageAgent: {
        summarize: localStorage.getItem(SUMMARIZE_MESSAGES_STORAGE_KEY) === 'true',
        similarMessages: false,
      },
    };
  },

  computed: {
    roleBadgeClass() {
      const map = { STUDENT: 'role-student', EMPLOYEE: 'role-employee', ADMIN: 'role-admin' };
      return map[this.userRole] ?? 'role-default';
    },
    availableTags() {
      const subscribedIds = new Set(this.subscribedTags.map(t => t.id));
      return this.allTags.filter(t => !subscribedIds.has(t.id));
    },
  },

  async mounted() {
    await Promise.all([
      this.loadSubscriptions().catch(() => { this.subError = 'Abonnements konnten nicht geladen werden.'; }),
      this.loadAllTags(),
    ]);
  },

  methods: {
    async loadAllTags() {
      try { this.allTags = await getTags(); } catch (e) { /* tags unavailable */ }
    },

    toggleMessageSummaries() {
      this.messageAgent.summarize = !this.messageAgent.summarize;
      localStorage.setItem(SUMMARIZE_MESSAGES_STORAGE_KEY, String(this.messageAgent.summarize));
    },

    async addSub() {
      if (!this.selectedNewTag) return;
      this.adding = true;
      this.subError = null;
      try {
        await this.addSubscription(this.selectedNewTag);
        this.selectedNewTag = '';
      } catch {
        this.subError = 'Hinzufügen fehlgeschlagen.';
      } finally {
        this.adding = false;
      }
    },

    async removeSub(tag) {
      this.removing = tag.id;
      this.subError = null;
      try {
        await this.removeSubscription(tag.id);
      } catch {
        this.subError = 'Entfernen fehlgeschlagen.';
      } finally {
        this.removing = null;
      }
    },
  },
};
</script>

<style scoped src="../styles/SettingsView.css"></style>
