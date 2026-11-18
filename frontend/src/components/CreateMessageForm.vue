<template>
  <section class="panel">
    <div class="panelHeader">
      <div>
        <div class="panelTitle">Publish</div>
        <div class="panelSub">Create a new announcement</div>
      </div>
    </div>

    <form class="form" @submit.prevent="submit">

    <label class="label">
        Topic
        <select class="input" v-model="form.tagId" @change="onTopicChange" required>
          <option value="" disabled>Select a topic...</option>
          <option v-if="selectedNewTag" :value="newTagValue">
            # {{ selectedNewTag }} (new tag)
          </option>
          <option v-for="tag in availableTags" :key="tag.id" :value="tag.id">
            # {{ tag.name }}
          </option>
        </select>
      </label>

      <label class="label">
        Target Audience
        <select class="input" v-model="form.targetRole" required>
          <option value="ALL">All</option>
          <option value="STUDENT">Student</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
      </label>

      <label class="label">
        Title
        <input class="input" v-model.trim="form.title" placeholder="Short headline…" required />
      </label>

      <label class="label">
        Body
        <textarea class="input textarea" v-model.trim="form.body" placeholder="Write the message…" required></textarea>
      </label>

      <div v-if="showSuggestions" class="suggestions">
        <div class="suggestionsHead">
          <span class="suggestionsTitle">Suggested tags</span>
          <span v-if="suggestionsLoading" class="suggestionsMeta">Searching…</span>
        </div>

        <template v-if="suggestions.length">
          <div v-if="existingSuggestions.length" class="suggestionGroup">
            <span class="suggestionGroupLabel">Existing</span>
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
            <span class="suggestionGroupLabel">New</span>
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
                <span class="suggestionCount">· new tag</span>
              </button>
            </div>
          </div>

          <div class="suggestionsHint">
            Click a suggestion to use it as topic – manual selection still works.
          </div>
        </template>

        <div v-else-if="suggestionsLoading" class="suggestionsHint">
          Looking for matching tags…
        </div>

        <div v-else-if="suggestionsSearched" class="suggestionsHint">
          No suitable tag suggestions found.
        </div>
      </div>

      <div class="row">
        <button class="btnPrimary" type="submit" :disabled="loading">
          {{ loading ? "Publishing…" : "Publish" }}
        </button>

        <button class="btn" type="button" @click="reset" :disabled="loading">
          Clear
        </button>
      </div>

      <div v-if="error" class="error">Create error: {{ error }}</div>
      <div v-if="success" class="success">{{ success }}</div>

    </form>
  </section>
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
    loading: { type: Boolean, default: false },
    error: { type: String, default: null },
    success: { type: String, default: null },
    availableTags: { type: Array, default: () => []}
  },
  emits: ["submit"],
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
  },
  mounted() {
    this.stopAutoTaggingListener = onAutoTaggingChange(this.onAutoTaggingChanged);
  },
  beforeUnmount() {
    this.cancelSuggestionRequest();
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