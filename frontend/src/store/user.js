import { reactive } from 'vue';

function storedUser() {
  try {
    const user = JSON.parse(sessionStorage.getItem('user'));
    return user && typeof user === 'object' && !Array.isArray(user) ? user : null;
  } catch { return null; }
}

// Same-tab sessionStorage changes are not reactive and do not emit storage events.
// Keep the header and settings synchronized with login/profile responses.
export const userStore = reactive({
  user: storedUser(),

  setUser(user) {
    const account = {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? '',
      role: user.role,
    };
    sessionStorage.setItem('user', JSON.stringify(account));
    this.user = account;
  },

  updateFromProfile(profile) {
    // Ignore a late response belonging to an earlier session/account.
    if (!this.user || this.user.id !== profile.id) return;
    this.setUser({ ...this.user, displayName: profile.displayName });
  },

  clear() {
    sessionStorage.removeItem('user');
    this.user = null;
  },
});
