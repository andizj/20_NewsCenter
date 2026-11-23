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
          <div id="create-message-title" class="panelTitle">Nachricht erstellen</div>
          <div class="panelSub">Erstelle eine neue Ankündigung für das NewsCenter</div>
        </div>

        <button class="close-btn" type="button" aria-label="Schließen" @click="close">×</button>
      </div>

      <form class="form" @submit.prevent="submit">

      <div class="label">
          <span>Themen ({{ selectedTags.length }}/{{ maxTags }})</span>

          <div v-if="selectedTags.length" class="selectedTags">
            <span
              v-for="tag in selectedTags"
              :key="tagKey(tag)"
              class="selectedTag"
              :class="{ isNew: tag.isNew }"
            >
              # {{ tag.name }}<template v-if="tag.isNew"> (neu)</template>
              <button
                type="button"
                class="removeTag"
                :aria-label="`Thema ${tag.name} entfernen`"
                :disabled="loading"
                @click="removeTag(tag)"
              >×</button>
            </span>
          </div>

          <select
            class="input"
            v-model="topicPick"
            :disabled="isTagLimitReached || !selectableTags.length"
            aria-label="Thema hinzufügen"
            @change="onTopicPick"
          >
            <option value="" disabled>
              {{ isTagLimitReached ? `Maximal ${maxTags} Themen ausgewählt` : "Thema hinzufügen…" }}
            </option>
            <option v-for="tag in selectableTags" :key="tag.id" :value="tag.id">
              # {{ tag.name }}
            </option>
          </select>

          <span v-if="topicError" class="error">{{ topicError }}</span>
        </div>

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
                  :disabled="isSuggestionDisabled(tag)"
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
                  :disabled="isSuggestionDisabled(tag)"
                  @click="applySuggestion(tag)"
                >
                  <span class="suggestionName"># {{ tag.name }}</span>
                  <span class="suggestionCount">· Neuer Vorschlag</span>
                </button>
              </div>
            </div>

            <div class="suggestionsHint">
              Klicke Vorschläge an, um sie als Thema hinzuzufügen oder wieder zu entfernen (max. {{ maxTags }}) – die manuelle Auswahl ist weiterhin möglich.
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
// Muss zum Backend-Limit passen (messageService.MAX_TAGS_PER_MESSAGE).
const MAX_TAGS = 3;

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
        targetRole: "ALL",
        title: "",
        body: "",
      },
      // Ausgewählte Themen: { id, name, isNew } – neue Vorschläge haben id = null.
      selectedTags: [],
      topicPick: "",
      topicError: null,
      maxTags: MAX_TAGS,
      autoTagging: isAutoTaggingEnabled(),
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
    isTagLimitReached() {
      return this.selectedTags.length >= MAX_TAGS;
    },
    // Bereits gewählte Themen nicht noch einmal im Dropdown anbieten.
    selectableTags() {
      return this.availableTags.filter((tag) => !this.findSelected(tag));
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
      this.form.targetRole = "ALL";
      this.form.title = "";
      this.form.body = "";
      this.selectedTags = [];
      this.topicPick = "";
      this.topicError = null;
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
      if (!this.selectedTags.length) {
        this.topicError = "Bitte mindestens ein Thema auswählen.";
        return;
      }
      // Sendet title, body, Zielgruppe und Themen ans Eltern-Element (HomeView)
      this.$emit("submit", {
        ...this.form,
        tagIds: this.selectedTags.filter((tag) => !tag.isNew).map((tag) => tag.id),
        newTagNames: this.selectedTags.filter((tag) => tag.isNew).map((tag) => tag.name),
      });
    },

    // --- Themen-Auswahl (max. MAX_TAGS) ---
    tagKey(tag) {
      return tag.isNew ? `new-${tag.name.toLowerCase()}` : tag.id;
    },

    // Ein Thema gilt als gewählt, wenn die ID passt – oder bei neuen Vorschlägen der Name.
    findSelected(tag) {
      const isNew = tag.type === "new" || tag.isNew;
      return this.selectedTags.find((selected) =>
        isNew
          ? selected.isNew && selected.name.toLowerCase() === tag.name.toLowerCase()
          : !selected.isNew && selected.id === tag.id
      );
    },

    addTag(tag) {
      if (this.findSelected(tag)) return;
      if (this.isTagLimitReached) {
        this.topicError = `Es können maximal ${MAX_TAGS} Themen ausgewählt werden.`;
        return;
      }
      const isNew = tag.type === "new";
      this.selectedTags.push({ id: isNew ? null : tag.id, name: tag.name, isNew });
      this.topicError = null;
    },

    removeTag(tag) {
      const selected = this.findSelected(tag);
      this.selectedTags = this.selectedTags.filter((entry) => entry !== selected);
      this.topicError = null;
    },

    onTopicPick() {
      const tag = this.availableTags.find((entry) => entry.id === this.topicPick);
      if (tag) this.addTag(tag);
      this.topicPick = "";
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

    // Vorschläge funktionieren als Umschalter: anklicken = hinzufügen/entfernen.
    applySuggestion(tag) {
      if (this.findSelected(tag)) this.removeTag(tag);
      else this.addTag(tag);
    },

    isSelectedSuggestion(tag) {
      return Boolean(this.findSelected(tag));
    },

    isSuggestionDisabled(tag) {
      return this.isTagLimitReached && !this.findSelected(tag);
    },

    subscriberLabel(count) {
      const value = Number(count) || 0;
      return `${value} Sub${value === 1 ? "" : "s"}`;
    },
  },
};
</script>

<style scoped src="../styles/CreateMessageForm.css"></style>