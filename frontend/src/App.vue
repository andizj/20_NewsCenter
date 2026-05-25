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

<style src="./styles/App.css"></style>