import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import LandingView from './views/LandingView.vue'
import SettingsView from './views/SettingsView.vue'

const routes = [
    { 
      path: '/', 
      component: LandingView,
      meta: { guestOnly: true, title: 'Willkommen - NewsCenter' }
    },
    { 
      path: '/feed', 
      component: HomeView,
      meta: { requiresAuth: true, title: 'Feed - NewsCenter' }
    },
    {
      path: '/settings',
      component: SettingsView,
      meta: { requiresAuth: true, title: 'Einstellungen - NewsCenter' }
    },
  ]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
    const isAuthenticated = sessionStorage.getItem('user') !== null;

    if (to.meta.requiresAuth && !isAuthenticated) {
      next('/'); 
    } 
    else if (to.meta.guestOnly && isAuthenticated) {
      next('/feed'); 
    } 
    else {
      next();
    }
  });
  router.afterEach((to) => {
    const defaultTitle = 'NewsCenter';
    if (to.meta.title) {
      document.title = to.meta.title;
    } else {
      document.title = defaultTitle;
    }
  });
  
  export default router;