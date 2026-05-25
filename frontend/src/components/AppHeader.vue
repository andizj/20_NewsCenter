<template>
  <header class="header">
    <router-link to="/feed" class="brand">
      <img src="@/assets/logo2.png" alt="NewsCenter Logo" class="logo" />
      <div>
        <div class="title">NewsCenter</div>
        <div class="subtitle">Internal news & announcements</div>
      </div>
    </router-link>

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

      <button class="btn settings-btn" @click="$router.push('/settings')" title="Einstellungen">
        ⚙️
      </button>
      
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

<style scoped src="../styles/AppHeader.css"></style>