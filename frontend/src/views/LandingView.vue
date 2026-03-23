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
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
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

<style scoped>
/* --- BASIS STYLES (wie vorher) --- */
.landing-container {
  min-height: 80vh;
  display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 2rem;
}
.logo { width: 200px; height: auto; margin-bottom: -5rem; filter: drop-shadow(0 0 10px rgba(66, 185, 131, 0.3)); }
.title { font-size: 3rem; margin-bottom: 1rem; color: #e9eefc; font-weight: 800; }
.highlight { background: linear-gradient(135deg, #42b983 0%, #35495e 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { font-size: 1.2rem; color: #a0aec0; max-width: 600px; margin-bottom: 3rem; line-height: 1.6; margin: 0 auto 3rem auto;}
.actions { display: flex; gap: 20px; justify-content: center; }

/* Buttons */
.btn { padding: 12px 30px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; font-size: 1.1rem; transition: transform 0.2s; }
.btn:hover { transform: translateY(-3px); }
.primary { background: #42b983; color: white; box-shadow: 0 4px 14px rgba(66, 185, 131, 0.4); }
.secondary { background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); }

/* --- NEU: POPUP (MODAL) STYLES --- */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.7); /* Dunkler Hintergrund */
  backdrop-filter: blur(5px);      /* Weichzeichner-Effekt */
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
}

.modal-card {
  background: #1a1f2b; /* Dunkles Modal passend zum Design */
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2.5rem;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  position: relative;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  text-align: left;
  animation: fadeIn 0.3s ease-out;
}

.close-btn {
  position: absolute; top: 15px; right: 15px;
  background: none; border: none; color: #a0aec0; font-size: 1.5rem; cursor: pointer;
}
.close-btn:hover { color: white; }

h2 { margin-top: 0; color: #e9eefc; margin-bottom: 1.5rem; text-align: center;}
.form-group { margin-bottom: 1.2rem; }
label { display: block; color: #a0aec0; font-size: 0.9rem; margin-bottom: 0.4rem; }
input { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #3a4354; background: rgba(0,0,0,0.2); color: white; box-sizing: border-box;}
input:focus { outline: none; border-color: #42b983; }

.btn-submit { width: 100%; padding: 12px; background: #42b983; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
.btn-submit:hover { background: #3aa876; }

.switch-mode { text-align: center; margin-top: 15px; font-size: 0.9rem; color: #a0aec0; }
.switch-mode a { color: #42b983; text-decoration: none; font-weight: bold; }

.error-message { color: #ff6b6b; background: rgba(255,107,107,0.1); padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.9rem; text-align: center; }
.success-message { color: #2ecc71; background: rgba(46,204,113,0.1); padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.9rem; text-align: center; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>