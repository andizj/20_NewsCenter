<template>
  <div class="landing-container">
    <div class="hero-content">
      <img src="@/assets/logo.png" alt="NewsCenter Logo" class="logo" />

      <h1 class="title">Willkommen im <span class="highlight">NewsCenter</span></h1>
      <p class="subtitle">
        Die zentrale Plattform für alle News, Updates und Events.
        Bleib informiert, filtere nach deinen Interessen und verpasse nichts mehr.
      </p>
      
      <div class="actions">
        <button @click="openLogin" class="btn primary">Einloggen</button>
        <button @click="openRegister" class="btn secondary">Konto erstellen</button>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      
      <div v-if="activeForm === 'login'" class="modal-card">
        <button class="close-btn" @click="closeModal">×</button>
        <h2>Anmelden</h2>
        
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label>E-Mail</label>
            <input v-model="email" type="email" placeholder="name@example.com" required />
          </div>
          <div class="form-group">
            <label>Passwort</label>
            <input v-model="password" type="password" placeholder="Dein Passwort" required />
          </div>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
          
          <button type="submit" :disabled="isLoading" class="btn-submit">
            {{ isLoading ? 'Lädt...' : 'Einloggen' }}
          </button>

          <p class="switch-mode">
            Neu hier? <a @click.prevent="openRegister" href="#">Konto erstellen</a>
          </p>
        </form>
      </div>

      <div v-if="activeForm === 'register'" class="modal-card">
        <button class="close-btn" @click="closeModal">×</button>
        <h2>Registrieren</h2>
        
        <form @submit.prevent="handleRegister">
          <div class="form-group">
            <label>Name</label>
            <input v-model="displayName" type="text" placeholder="Dein Name" required />
          </div>
          <div class="form-group">
            <label>E-Mail</label>
            <input v-model="email" type="email" placeholder="name@example.com" required />
          </div>
          <div class="form-group">
            <label>Passwort (min. 8 Zeichen)</label>
            <input v-model="password" type="password" placeholder="Passwort wählen" required minlength="8"/>
          </div>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
          <div v-if="successMessage" class="success-message">{{ successMessage }}</div>

          <button type="submit" :disabled="isLoading" class="btn-submit">
            {{ isLoading ? 'Lädt...' : 'Registrieren' }}
          </button>

          <p class="switch-mode">
            Schon dabei? <a @click.prevent="openLogin" href="#">Hier einloggen</a>
          </p>
        </form>
      </div>

    </div>
  </div>
</template>

<script>
import api from '../services/api';

export default {
  name: 'LandingView',
  data() {
    return {
      showModal: false,
      activeForm: 'login', // 'login' oder 'register'
      
      // Form Data
      email: '',
      password: '',
      displayName: '',
      
      // Status
      isLoading: false,
      errorMessage: '',
      successMessage: ''
    };
  },
  methods: {
    openLogin() {
      this.resetForm();
      this.activeForm = 'login';
      this.showModal = true;
    },
    openRegister() {
      this.resetForm();
      this.activeForm = 'register';
      this.showModal = true;
    },
    closeModal() {
      this.showModal = false;
    },
    resetForm() {
      this.email = '';
      this.password = '';
      this.displayName = '';
      this.errorMessage = '';
      this.successMessage = '';
    },
    
    // --- LOGIK VOM LOGIN VIEW ---
    async handleLogin() {
      this.isLoading = true;
      this.errorMessage = '';
      try {
        const response = await api.post('/users/login', {
          email: this.email,
          password: this.password
        });
        
        const { token, user } = response.data;
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));
        
        // Nach erfolgreichem Login: Weiter zum Feed
        this.$router.push('/feed');
        
      } catch (error) {
        this.errorMessage = error.response?.data?.error || 'Login fehlgeschlagen.';
      } finally {
        this.isLoading = false;
      }
    },

    // --- LOGIK VOM REGISTER VIEW ---
    async handleRegister() {
      this.isLoading = true;
      this.errorMessage = '';
      try {
        await api.post('/users', {
          displayName: this.displayName,
          email: this.email,
          password: this.password
        });
        
        this.successMessage = 'Konto erstellt! Bitte einloggen...';
        setTimeout(() => {
          this.openLogin(); // Wechselt automatisch zum Login-Popup
          this.successMessage = ''; // Reset message for clean login state
        }, 1500);
        
      } catch (error) {
        this.errorMessage = error.response?.data?.error || 'Registrierung fehlgeschlagen.';
      } finally {
        this.isLoading = false;
      }
    }
  }
};
</script>

<style scoped src="../styles/LandingView.css"></style>