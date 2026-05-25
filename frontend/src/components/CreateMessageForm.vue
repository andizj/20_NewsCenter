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

<style scoped src="../styles/CreateMessageForm.css"></style>