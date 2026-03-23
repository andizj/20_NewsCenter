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
        <select class="input" v-model="form.tagId" required>
          <option value="" disabled>Select a topic...</option>
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
    };
  },
  methods: {
    // fillDemoAuthor() ist komplett gelöscht, brauchen wir nicht mehr.
    
    reset() {
      this.form.tagId = "";
      this.form.targetRole = "ALL";
      this.form.title = "";
      this.form.body = "";
    },
    submit() {
      // Sendet nur noch title und body ans Eltern-Element (HomeView)
      this.$emit("submit", { ...this.form });
    },
  },
};
</script>

<style scoped>
.panel {
  border: 1px solid #2a2f3a;
  border-radius: 16px;
  padding: 14px;
  background: rgba(255,255,255,0.03);
}
.panelHeader { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
.panelTitle { font-weight: 800; }
.panelSub { font-size: 12px; color: #a9b1c3; margin-top: 2px; }
.form { display: grid; gap: 10px; margin-top: 12px; }
.label { display: grid; gap: 6px; font-size: 12px; color: #a9b1c3; }
.input {
  border: 1px solid #3a4354;
  border-radius: 12px;
  padding: 10px 10px;
  background: rgba(0,0,0,0.25);
  color: #e9eefc;
  font-family: inherit; /* Wichtig für Textareas */
}
.textarea { min-height: 90px; resize: vertical; }
.row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.btnPrimary {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #4b5a78;
  background: rgba(120,160,255,0.18);
  color: inherit;
  cursor: pointer;
  font-weight: 700;
}
.btnPrimary:hover { background: rgba(120,160,255,0.25); }
.btn {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #3a4354;
  background: rgba(255,255,255,0.05);
  color: inherit;
  cursor: pointer;
}
.btn:hover { background: rgba(255,255,255,0.08); }

.error { color: #ff6b6b; font-size: 12px; margin-top: 4px; }
.success { color: #2ecc71; font-size: 12px; margin-top: 4px; }
.hint { color: #a9b1c3; font-size: 12px; margin-top: 4px; }
select.input {
  appearance: none; /* Entfernt Standard-Browser-Pfeil (optional) */
  cursor: pointer;
}
</style>