<template>
  <div id="app-layout">
    
    <div class="shell">
      <router-view />
    </div>

    <AppFooter />
    <ToastContainer />
  </div>
</template>

<script>
import AppFooter from "./components/AppFooter.vue";
import ToastContainer from "./components/ToastContainer.vue";

export default {
  name: "App",
  components: {
    AppFooter,
    ToastContainer
  },
};
</script>

<style>
html, body {
  height: 100%;
}

body {
  margin: 0;
  background: radial-gradient(1200px 600px at 15% 10%, rgba(120,160,255,0.18), transparent 60%),
              radial-gradient(900px 500px at 80% 0%, rgba(255,255,255,0.08), transparent 50%),
              #0b0f16;
  color: #e9eefc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  background-repeat: no-repeat;
  
  /* 2. Fixiert den Hintergrund am Fenster (er scrollt nicht mit weg) */
  background-attachment: fixed;
  
  /* 3. Stellt sicher, dass er immer den ganzen Screen deckt */
  background-size: cover;
}

/* Layout für Sticky Footer */
#app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh; 
}

.shell {
  flex: 1; 
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box; 
}
</style>