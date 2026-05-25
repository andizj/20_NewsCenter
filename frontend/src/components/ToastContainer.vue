<template>
  <div class="toast-container">
    <transition-group name="toast-list">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="toast"
      >
        <div class="toast-content">
          <div class="toast-title">🔔 Neuer Post in #{{ toast.message.tags.join(', ') }}</div>
          <div class="toast-body">{{ toast.message.title }}</div>
        </div>
        <button class="toast-close" @click="removeToast(toast.id)">×</button>
      </div>
    </transition-group>
  </div>
</template>

<script>
import { notificationStore } from '../store/notifications';

export default {
  name: "ToastContainer",
  computed: {
    toasts() {
      return notificationStore.toasts;
    }
  },
  methods: {
    removeToast(id) {
      notificationStore.removeToast(id);
    }
  }
};
</script>

<style scoped src="../styles/ToastContainer.css"></style>
