import { reactive } from 'vue';

export const notificationStore = reactive({
  unread: [],
  newSubscribed: [],

  setNewSubscribed(messages) {
    this.newSubscribed = messages;
    this.unread = messages.filter(message => message.isUnread);
  },

  markAllRead() {
    this.unread = [];
    this.newSubscribed = this.newSubscribed.map(message => ({
      ...message,
      isUnread: false,
    }));
  },
  
  addNotification(message) {
    const notification = {
      ...message,
      isUnread: message.isUnread !== false,
    };

    // Avoid duplicates
    if (!this.unread.find(n => n.id === message.id)) {
      this.unread.push(notification);
    }
    if (!this.newSubscribed.find(n => n.id === message.id)) {
      this.newSubscribed.push(notification);
    }
  },

  clearAll() {
    this.markAllRead();
  },
  
  removeNotification(id) {
    this.unread = this.unread.filter(n => n.id !== id);
    this.newSubscribed = this.newSubscribed.filter(n => n.id !== id);
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
