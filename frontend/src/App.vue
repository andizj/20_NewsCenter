<template>
  <div id="app-layout">
    
    <div class="shell">
      <router-view />
    </div>

    <AppFooter />
  </div>
</template>

<script>
// Importieren des Footers
import AppFooter from "./components/AppFooter.vue";

export default {
  name: "App",
  components: {
    AppFooter, // Registrieren
  },
};
</script>

<style>
/* Globale Einstellungen */
html, body {
  height: 100%;
}

body {
  margin: 0;
  /* Dein schöner Hintergrund */
  background: radial-gradient(1200px 600px at 15% 10%, rgba(120,160,255,0.18), transparent 60%),
              radial-gradient(900px 500px at 80% 0%, rgba(255,255,255,0.08), transparent 50%),
              #0b0f16;
  color: #e9eefc;
  /* Deine neue Schriftart */
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
  min-height: 100vh; /* Mindestens so hoch wie der Bildschirm */
}

.shell {
  flex: 1; /* Dieser Bereich wächst und drückt den Footer nach unten */
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box; /* Verhindert, dass Padding die Breite sprengt */
}
</style>