<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <section
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-message-title"
    >
      <div class="panelHeader">
        <div>
          <div id="create-message-title" class="panelTitle">Veröffentlichen</div>
          <div class="panelSub">Neue Nachricht erstellen</div>
        </div>

        <button class="close-btn" type="button" aria-label="Schließen" @click="close">×</button>
      </div>

      <form class="form" @submit.prevent="submit">

      <label class="label">
          Thema
          <select class="input" v-model="form.tagId" @change="onTopicChange" required>
            <option value="" disabled>Thema auswählen…</option>
            <option v-if="selectedNewTag" :value="newTagValue">
              # {{ selectedNewTag }} (neuer Tag)
            </option>
            <option v-for="tag in availableTags" :key="tag.id" :value="tag.id">
              # {{ tag.name }}
            </option>
          </select>
        </label>

        <label class="label">
          Zielgruppe
          <select class="input" v-model="form.targetRole" required>
            <option value="ALL">Alle</option>
            <option value="STUDENT">Studenten</option>
            <option value="EMPLOYEE">Mitarbeiter</option>
          </select>
        </label>

        <label class="label">
          Titel
          <input ref="titleInput" class="input" v-model.trim="form.title" placeholder="Titel…" required />
        </label>

        <label class="label">
          Nachricht  
          <textarea class="input textarea" v-model.trim="form.body" placeholder="Nachricht…" required></textarea>
        </label>

        <div v-if="showSuggestions" class="suggestions">
          <div class="suggestionsHead">
            <span class="suggestionsTitle">Passende Themenvorschläge</span>
            <span v-if="suggestionsLoading" class="suggestionsMeta">Suche…</span>
          </div>

          <template v-if="suggestions.length">
            <div v-if="existingSuggestions.length" class="suggestionGroup">
              <span class="suggestionGroupLabel">Bestehende Themen</span>
              <div class="suggestionList">
                <button
                  v-for="tag in existingSuggestions"
                  :key="tag.id"
                  type="button"
                  class="suggestionChip"
                  :class="{ active: isSelectedSuggestion(tag) }"
                  :title="tag.reason"
                  @click="applySuggestion(tag)"
                >
                  <span class="suggestionName"># {{ tag.name }}</span>
                  <span class="suggestionCount">· {{ subscriberLabel(tag.subscriberCount) }}</span>
                </button>
              </div>
            </div>

            <div v-if="newSuggestions.length" class="suggestionGroup">
              <span class="suggestionGroupLabel">Neue Vorschläge</span>
              <div class="suggestionList">
                <button
                  v-for="tag in newSuggestions"
                  :key="'new-' + tag.name"
                  type="button"
                  class="suggestionChip isNew"
                  :class="{ active: isSelectedSuggestion(tag) }"
                  :title="tag.reason"
                  @click="applySuggestion(tag)"
                >
                  <span class="suggestionName"># {{ tag.name }}</span>
                  <span class="suggestionCount">· Neuer Vorschlag</span>
                </button>
              </div>
            </div>

            <div class="suggestionsHint">
              Klicke einen Vorschlag, um ihn als Thema zu verwenden – die manuelle Auswahl ist weiterhin möglich.
            </div>
          </template>

          <div v-else-if="suggestionsLoading" class="suggestionsHint">
            Suche passende Themen …
          </div>

          <div v-else-if="suggestionsSearched" class="suggestionsHint">
            Keine passenden Themenvorschläge gefunden.
          </div>
        </div>

        <div class="row">
          <button class="btnPrimary" type="submit" :disabled="loading">
            {{ loading ? "Veröffentliche…" : "Veröffentlichen" }}
          </button>

          <button class="btn" type="button" @click="reset" :disabled="loading">
            Zurücksetzen
          </button>
        </div>

        <div v-if="error" class="error">Erstellen fehlgeschlagen: {{ error }}</div>
        <div v-if="success" class="success">{{ success }}</div>

      </form>
    </section>
  </div>
</template>

<script>
import { getTagSuggestions } from "../services/messagesService";
import { isAutoTaggingEnabled, onAutoTaggingChange } from "../services/agentSettings";

const SUGGESTION_DEBOUNCE_MS = 600;
const MIN_TITLE_LENGTH = 3;
const MIN_BODY_LENGTH = 10;
// Placeholder value for the topic <select> while a NEW suggestion is selected.
const NEW_TAG_VALUE = "__new_tag__";

export default {
  name: "CreateMessageForm",
  props: {
    visible: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    error: { type: String, default: null },
    success: { type: String, default: null },
    availableTags: { type: Array, default: () => []}
  },
  emits: ["submit", "close"],
  data() {
    return {
      form: {
        tagId: "",
        targetRole: "ALL",
        title: "",
        body: "",
      },
      autoTagging: isAutoTaggingEnabled(),
      newTagValue: NEW_TAG_VALUE,
      selectedNewTag: null,
      suggestions: [],
      suggestionsLoading: false,
      suggestionsSearched: false,
      suggestionTimer: null,
      suggestionRequestId: 0,
      modalBound: false,
    };
  },
  computed: {
    // Only query the publish agent when there is a meaningful amount of text.
    hasEnoughContent() {
      const title = this.form.title.trim();
      const body = this.form.body.trim();
      return title.length >= MIN_TITLE_LENGTH || body.length >= MIN_BODY_LENGTH;
    },
    showSuggestions() {
      return this.autoTagging && this.hasEnoughContent;
    },
    existingSuggestions() {
      return this.suggestions.filter((tag) => tag.type !== "new");
    },
    newSuggestions() {
      return this.suggestions.filter((tag) => tag.type === "new");
    },
  },
  watch: {
    "form.title": "onDraftChanged",
    "form.body": "onDraftChanged",
    visible: {
      immediate: true,
      handler(isOpen) {
        if (isOpen) {
          this.bindModal();
          this.$nextTick(() => this.$refs.titleInput?.focus());
        } else {
          this.releaseModal();
          this.reset();
        }
      },
    },
  },
  mounted() {
    this.stopAutoTaggingListener = onAutoTaggingChange(this.onAutoTaggingChanged);
  },
  beforeUnmount() {
    this.cancelSuggestionRequest();
    this.releaseModal();
    if (typeof this.stopAutoTaggingListener === "function") {
      this.stopAutoTaggingListener();
    }
  },
  methods: {
    reset() {
      this.form.tagId = "";
      this.form.targetRole = "ALL";
      this.form.title = "";
      this.form.body = "";
      this.selectedNewTag = null;
      this.clearSuggestions();
    },

    close() {
      if (this.loading) return;
      this.$emit("close");
    },

    onEscape(event) {
      if (event.key === "Escape") this.close();
    },

    bindModal() {
      if (typeof document === "undefined" || this.modalBound) return;
      this.modalBound = true;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", this.onEscape);
    },

    releaseModal() {
      if (typeof document === "undefined" || !this.modalBound) return;
      this.modalBound = false;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", this.onEscape);
    },

    submit() {
      const isNewTag = this.selectedNewTag && this.form.tagId === NEW_TAG_VALUE;
      // Sendet title, body, Zielgruppe und Topic ans Eltern-Element (HomeView)
      this.$emit("submit", {
        ...this.form,
        tagId: isNewTag ? "" : this.form.tagId,
        newTagName: isNewTag ? this.selectedNewTag : null,
      });
    },

    // --- Publish agent: tag suggestions while typing (debounced) ---
    onDraftChanged() {
      this.cancelSuggestionRequest();

      if (!this.showSuggestions) {
        this.clearSuggestions();
        return;
      }

      this.suggestionsLoading = true;
      this.suggestionTimer = setTimeout(() => {
        this.suggestionTimer = null;
        this.fetchSuggestions();
      }, SUGGESTION_DEBOUNCE_MS);
    },

    onAutoTaggingChanged() {
      this.autoTagging = isAutoTaggingEnabled();
      if (this.autoTagging) {
        this.onDraftChanged();
      } else {
        this.cancelSuggestionRequest();
        this.clearSuggestions();
      }
    },

    cancelSuggestionRequest() {
      if (this.suggestionTimer) {
        clearTimeout(this.suggestionTimer);
        this.suggestionTimer = null;
      }
    },

    clearSuggestions() {
      this.suggestionRequestId += 1;
      this.suggestions = [];
      this.suggestionsLoading = false;
      this.suggestionsSearched = false;
    },

    async fetchSuggestions() {
      const title = this.form.title.trim();
      const body = this.form.body.trim();

      // Keine Anfrage wenn Titel und Body leer bzw. zu kurz sind
      if (!this.showSuggestions) {
        this.clearSuggestions();
        return;
      }

      const requestId = ++this.suggestionRequestId;
      this.suggestionsLoading = true;

      try {
        const suggestions = await getTagSuggestions({ title, body });
        if (requestId !== this.suggestionRequestId) return;
        this.suggestions = suggestions;
        this.suggestionsSearched = true;
      } catch (e) {
        if (requestId !== this.suggestionRequestId) return;
        console.error("Tag suggestion error:", e);
        this.suggestions = [];
        this.suggestionsSearched = true;
      } finally {
        if (requestId === this.suggestionRequestId) {
          this.suggestionsLoading = false;
        }
      }
    },

    applySuggestion(tag) {
      if (tag.type === "new") {
        this.selectedNewTag = tag.name;
        this.form.tagId = NEW_TAG_VALUE;
        return;
      }

      this.selectedNewTag = null;
      this.form.tagId = tag.id;
    },

    // Manual topic selection stays consistent with the suggestions.
    onTopicChange() {
      if (this.form.tagId !== NEW_TAG_VALUE) {
        this.selectedNewTag = null;
      }
    },

    isSelectedSuggestion(tag) {
      if (tag.type === "new") {
        return this.selectedNewTag === tag.name && this.form.tagId === NEW_TAG_VALUE;
      }
      return this.form.tagId === tag.id;
    },

    subscriberLabel(count) {
      const value = Number(count) || 0;
      return `${value} Sub${value === 1 ? "" : "s"}`;
    },
  },
};
</script>

<style scoped src="../styles/CreateMessageForm.css"></style>