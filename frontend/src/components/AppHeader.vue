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
        <button
          class="btn bell-btn"
          @click="toggleDropdown"
        >
          🔔
          <span v-if="unreadCount > 0" class="badge">{{ unreadCount }}</span>
        </button>
        
        <div v-if="showDropdown" class="dropdown">
          <div class="dropdown-header">
            <strong>Neue Nachrichten</strong>
            <button v-if="unreadCount > 0" class="mini" @click="markAllRead">Alle lesen</button>
          </div>
          <div v-if="newNotifications.length === 0" class="dropdown-empty">
            Keine neuen Nachrichten.
          </div>
          <div class="dropdown-list" v-else>
            <div
              v-for="notif in newNotifications"
              :key="notif.id"
              class="dropdown-item"
              :class="{ unread: notif.isUnread }"
              @click="selectNotification(notif.id)"
            >
              <div class="notif-title">{{ notif.title }}</div>
              <div class="notif-status" :class="{ unread: notif.isUnread }">
                {{ notif.isUnread ? "Ungelesen" : "Gelesen" }}
              </div>
              <div class="notif-tags">Tag: {{ notif.tags.join(', ') }}</div>
              <button class="mini close" @click.stop="dismissNotif(notif.id)">×</button>
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
  emits: ["refresh", "mark-notification-read", "mark-notifications-read", "notification-selected"],
  data() {
    return {
      showDropdown: false
    }
  },
  computed: {
    newNotifications() {
      return notificationStore.newSubscribed;
    },
    unreadCount() {
      return notificationStore.unread.length;
    }
  },
  methods: {
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    selectNotification(id) {
      this.showDropdown = false;
      this.$router.push({ path: "/feed", query: { message: id } }).catch(() => {});
      this.$emit("notification-selected", id);
    },
    markAllRead() {
      this.$emit("mark-notifications-read");
      notificationStore.markAllRead();
    },
    dismissNotif(id) {
      this.$emit("mark-notification-read", id);
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
