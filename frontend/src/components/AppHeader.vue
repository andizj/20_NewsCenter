<template>
  <header class="header">
    <div class="brand">
      <img src="@/assets/logo2.png" alt="NewsCenter Logo" class="logo" />
      <div>
        <div class="title">NewsCenter</div>
        <div class="subtitle">Internal news & announcements</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn logout-btn" @click="logout">Logout</button>
    </div>
  </header>
</template>

<script>
export default {
  name: "AppHeader",
  computed: {
    apiDocsUrl() {
      return (process.env.VUE_APP_API_URL || "http://localhost:3000") + "/api-docs";
    },
  },
  methods: {
    logout() {
      localStorage.removeItem("user");
      localStorage.removeItem("token"); 
      this.$router.push("/");
    }
  }
};
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 18px 18px;
  border: 1px solid #2a2f3a;
  border-radius: 16px;
  background: rgba(255,255,255,0.03);
}
.brand { display: flex; align-items: center; gap: 12px; }
.logo {
  width: 44px; height: 44px;
  border-radius: 14px;
  display: grid; place-items: center;
  font-weight: 800;
  border: 1px solid #3a4354;
  background: rgba(255,255,255,0.04);
}
.title { font-size: 18px; font-weight: 800; letter-spacing: 0.2px; }
.subtitle { font-size: 12px; color: #a9b1c3; margin-top: 2px; }
.actions { display: flex; align-items: center; gap: 10px; }
.link {
  font-size: 13px;
  color: #cfd6e6;
  text-decoration: none;
  border: 1px solid #3a4354;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255,255,255,0.02);
}
.link:hover { background: rgba(255,255,255,0.05); }
.btn {
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid #3a4354;
  background: rgba(255,255,255,0.05);
  color: inherit;
  cursor: pointer;
}
.btn:hover { background: rgba(255,255,255,0.08); }

/* Rötlicher Hover-Effekt für den Logout-Button */
.logout-btn:hover {
  background: rgba(255, 80, 80, 0.15);
  border-color: rgba(255, 80, 80, 0.4);
}
.logo {
  height: 60px; /* Oder wie groß du es haben willst */
  width: 70px;  /* Damit das Seitenverhältnis stimmt */
  margin-right: 5px; /* Abstand zum Text */
}
</style>