import { reactive } from 'vue';

export const notificationStore = reactive({
  unread: [],
  
  addNotification(message) {
    // Avoid duplicates
    if (!this.unread.find(n => n.id === message.id)) {
      this.unread.push(message);
    }
  },

  clearAll() {
    this.unread = [];
  },
  
  removeNotification(id) {
    this.unread = this.unread.filter(n => n.id !== id);
  },

  toasts: [],
  
  addToast(message) {
    const toastId = Date.now() + Math.random();
    this.toasts.push({ id: toastId, message });
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      this.removeToast(toastId);
    }, 4000);
  },
  
  removeToast(id) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
});
