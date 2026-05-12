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
      <div class="notification-wrapper">
        <button class="btn bell-btn" @click="toggleDropdown">
          🔔
          <span v-if="unreadCount > 0" class="badge">{{ unreadCount }}</span>
        </button>
        
        <div v-if="showDropdown" class="dropdown">
          <div class="dropdown-header">
            <strong>Benachrichtigungen</strong>
            <button v-if="unreadCount > 0" class="mini" @click="clearAll">Alle lesen</button>
          </div>
          <div v-if="unreadCount === 0" class="dropdown-empty">
            Keine neuen Nachrichten.
          </div>
          <div class="dropdown-list" v-else>
            <div v-for="notif in unreadNotifications" :key="notif.id" class="dropdown-item">
              <div class="notif-title">{{ notif.title }}</div>
              <div class="notif-tags">Tag: {{ notif.tags.join(', ') }}</div>
              <button class="mini close" @click="dismissNotif(notif.id)">×</button>
            </div>
          </div>
        </div>
      </div>
      
      <button class="btn logout-btn" @click="logout">Logout</button>
    </div>
  </header>
</template>

<script>
import { notificationStore } from '../store/notifications';

export default {
  name: "AppHeader",
  data() {
    return {
      showDropdown: false
    }
  },
  computed: {
    unreadNotifications() {
      return notificationStore.unread;
    },
    unreadCount() {
      return notificationStore.unread.length;
    }
  },
  methods: {
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    clearAll() {
      notificationStore.clearAll();
      this.showDropdown = false;
    },
    dismissNotif(id) {
      notificationStore.removeNotification(id);
    },
    logout() {
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("token"); 
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

.logout-btn:hover {
  background: rgba(255, 80, 80, 0.15);
  border-color: rgba(255, 80, 80, 0.4);
}
.logo {
  height: 60px; 
  width: 70px;  
  margin-right: 5px; 
}

/* Notifications */
.notification-wrapper {
  position: relative;
}
.bell-btn {
  position: relative;
  font-size: 16px;
}
.badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ff6b6b;
  color: white;
  border-radius: 50%;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: bold;
}
.dropdown {
  position: absolute;
  top: 120%;
  right: 0;
  width: 300px;
  background: #1a1f2b;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  z-index: 100;
  display: flex;
  flex-direction: column;
}
.dropdown-header {
  padding: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.dropdown-empty {
  padding: 20px;
  text-align: center;
  color: #a9b1c3;
  font-size: 12px;
}
.dropdown-list {
  max-height: 300px;
  overflow-y: auto;
}
.dropdown-item {
  padding: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  position: relative;
}
.dropdown-item:last-child {
  border-bottom: none;
}
.notif-title {
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 4px;
  padding-right: 20px;
}
.notif-tags {
  font-size: 11px;
  color: #a9b1c3;
}
.mini {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #3a4354;
  background: rgba(255,255,255,0.05);
  cursor: pointer;
  color: inherit;
  font-size: 11px;
}
.mini:hover { background: rgba(255,255,255,0.1); }
.mini.close {
  position: absolute;
  top: 10px;
  right: 10px;
  border: none;
  background: transparent;
  font-size: 14px;
}
.mini.close:hover { color: #ff6b6b; }
</style>