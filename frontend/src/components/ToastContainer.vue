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

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 9999;
  pointer-events: none; /* Let clicks pass through empty space */
}

.toast {
  pointer-events: auto; /* Re-enable clicks on the toast itself */
  background: rgba(30, 36, 48, 0.95);
  border: 1px solid rgba(120, 160, 255, 0.4);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 14px 18px;
  min-width: 280px;
  max-width: 350px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  color: #fff;
}

.toast-content {
  flex: 1;
}

.toast-title {
  font-size: 11px;
  color: #78a0ff;
  font-weight: 700;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toast-body {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  color: #a9b1c3;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.toast-close:hover {
  color: #ff6b6b;
}

/* Transitions */
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.4s ease;
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateX(50px) scale(0.9);
}

.toast-list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
