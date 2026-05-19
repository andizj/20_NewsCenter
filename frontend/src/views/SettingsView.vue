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
              <div class="toggle-label">Nachricht zusammenfassen</div>
              <div class="toggle-sublabel">Zeigt eine KI-generierte Kurzzusammenfassung unterhalb jeder Nachricht an.</div>
            </div>
            <button
              class="toggle-switch"
              :class="{ on: messageAgent.summarize }"
              @click="messageAgent.summarize = !messageAgent.summarize"
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
          <span class="cs-badge">Bald verfügbar</span>
          Diese Funktionen sind in Entwicklung und noch nicht aktiv.
        </div>
      </section>

    </div>
  </div>
</template>

<script>
import AppHeader from '../components/AppHeader.vue';
import { getSubscriptions, subscribe, unsubscribe } from '../services/subscriptionService';
import { getTags } from '../services/tagsService';

export default {
  name: 'SettingsView',
  components: { AppHeader },

  data() {
    const userRaw = sessionStorage.getItem('user');
    let userRole = 'UNBEKANNT';
    try { userRole = JSON.parse(userRaw)?.role ?? 'UNBEKANNT'; } catch (e) { /* ignore */ }

    return {
      userRole,

      // Tag Agent
      subscribedTags: [],
      allTags: [],
      subsLoading: true,
      subError: null,
      selectedNewTag: '',
      adding: false,
      removing: null,

      // Publish Agent (UI only)
      publishAgent: {
        autoTagging: true,
      },

      // Message Agent (UI only)
      messageAgent: {
        summarize: false,
        similarMessages: false,
      },
    };
  },

  computed: {
    roleBadgeClass() {
      const map = {
        STUDENT: 'role-student',
        EMPLOYEE: 'role-employee',
        ADMIN: 'role-admin',
      };
      return map[this.userRole] ?? 'role-default';
    },

    availableTags() {
      const subscribedIds = new Set(this.subscribedTags.map(t => t.id));
      return this.allTags.filter(t => !subscribedIds.has(t.id));
    },
  },

  async mounted() {
    await Promise.all([this.loadSubscriptions(), this.loadAllTags()]);
  },

  methods: {
    async loadSubscriptions() {
      this.subsLoading = true;
      this.subError = null;
      try {
        this.subscribedTags = await getSubscriptions();
      } catch (e) {
        this.subError = 'Abonnements konnten nicht geladen werden.';
      } finally {
        this.subsLoading = false;
      }
    },

    async loadAllTags() {
      try {
        this.allTags = await getTags();
      } catch (e) { /* Tags optional – ignore */ }
    },

    async addSub() {
      if (!this.selectedNewTag) return;
      this.adding = true;
      this.subError = null;
      try {
        await subscribe(this.selectedNewTag);
        this.selectedNewTag = '';
        await this.loadSubscriptions();
      } catch (e) {
        this.subError = 'Hinzufügen fehlgeschlagen.';
      } finally {
        this.adding = false;
      }
    },

    async removeSub(tag) {
      this.removing = tag.id;
      this.subError = null;
      try {
        await unsubscribe(tag.id);
        this.subscribedTags = this.subscribedTags.filter(t => t.id !== tag.id);
      } catch (e) {
        this.subError = 'Entfernen fehlgeschlagen.';
      } finally {
        this.removing = null;
      }
    },
  },
};
</script>

<style scoped>
/* ── Layout ── */
.page { display: grid; gap: 14px; }

.settings-layout {
  display: grid;
  gap: 20px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.page-header { padding: 4px 0 8px; }
.page-title  { margin: 0; font-size: 22px; font-weight: 800; }
.page-sub    { margin: 4px 0 0; font-size: 13px; color: #a9b1c3; }

/* ── Agent card ── */
.agent-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid #2a2f3a;
  border-radius: 16px;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agent-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.agent-icon  { font-size: 24px; line-height: 1; margin-top: 2px; }
.agent-title { font-size: 15px; font-weight: 700; margin-bottom: 3px; }
.agent-desc  { font-size: 12px; color: #a9b1c3; line-height: 1.5; }

/* ── Role badge ── */
.role-display {
  display: flex;
  align-items: center;
  gap: 14px;
}
.role-badge {
  display: inline-block;
  padding: 7px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  border: 1px solid transparent;
}
.role-student  { background: rgba(120,160,255,0.12); border-color: rgba(120,160,255,0.35); color: #78a0ff; }
.role-employee { background: rgba(80,220,140,0.12);  border-color: rgba(80,220,140,0.35);  color: #50dc8c; }
.role-admin    { background: rgba(255,150,80,0.12);  border-color: rgba(255,150,80,0.35);  color: #ff9650; }
.role-default  { background: rgba(255,255,255,0.06); border-color: #3a4354;                color: #a9b1c3; }
.role-hint     { font-size: 11px; color: #6b7590; }

/* ── Two-column row ── */
.agents-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 720px) { .agents-row { grid-template-columns: 1fr; } }

/* ── Tag Agent ── */
.tag-list   { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.tag-row    { display: flex; justify-content: space-between; align-items: center;
              padding: 9px 12px; border-radius: 8px; background: rgba(255,255,255,0.04);
              border: 1px solid #2a2f3a; }
.tag-name   { font-size: 13px; font-weight: 500; color: #78a0ff; }
.tag-empty  { font-size: 12px; color: #6b7590; padding: 10px 0; }

.remove-btn {
  background: none; border: none; color: #6b7590; cursor: pointer;
  font-size: 13px; width: 24px; height: 24px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.remove-btn:hover { background: rgba(255,80,80,0.15); color: #ff6b6b; }
.remove-btn:disabled { opacity: 0.4; cursor: default; }

.add-tag-row { display: flex; gap: 8px; }
.tag-select {
  flex: 1;
  background: rgba(0,0,0,0.25);
  border: 1px solid #3a4354;
  border-radius: 8px;
  padding: 8px 10px;
  color: #e9eefc;
  font-size: 13px;
}
.tag-select option { background: #1a1f2b; }
.add-btn {
  padding: 8px 14px;
  background: rgba(120,160,255,0.15);
  border: 1px solid rgba(120,160,255,0.35);
  border-radius: 8px;
  color: #78a0ff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}
.add-btn:hover:not(:disabled) { background: rgba(120,160,255,0.25); }
.add-btn:disabled { opacity: 0.4; cursor: default; }

.agent-loading { font-size: 12px; color: #6b7590; }
.error-msg     { font-size: 12px; color: #ff6b6b; margin-top: 8px; }

/* ── Toggle switch ── */
.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.toggle-row:last-of-type { border-bottom: none; }

.toggle-label    { font-size: 13px; font-weight: 600; }
.toggle-sublabel { font-size: 11px; color: #a9b1c3; margin-top: 3px; line-height: 1.4; }

.toggle-switch {
  flex-shrink: 0;
  width: 44px; height: 24px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  background: rgba(255,255,255,0.1);
  position: relative;
  transition: background 0.25s;
  padding: 0;
}
.toggle-switch.on { background: rgba(120,160,255,0.5); }

.toggle-knob {
  position: absolute;
  top: 3px; left: 3px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.25s;
  display: block;
}
.toggle-switch.on .toggle-knob { transform: translateX(20px); }

/* Message agent 2-col grid on wider screens */
.message-agent-grid { display: flex; flex-direction: column; }

/* Coming-soon banner */
.coming-soon {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(255,200,80,0.05);
  border: 1px dashed rgba(255,200,80,0.25);
  font-size: 12px;
  color: #a9b1c3;
}
.cs-badge {
  flex-shrink: 0;
  background: rgba(255,200,80,0.15);
  color: #ffc850;
  border: 1px solid rgba(255,200,80,0.3);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
</style>
