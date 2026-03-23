import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import LandingView from './views/LandingView.vue'

const routes = [
    { 
      path: '/', 
      component: LandingView,   // Diese Route ist NUR für Gäste (wer eingeloggt ist, braucht kein Login)
      meta: { guestOnly: true, title: 'Willkommen - NewsCenter' }
    },
    { 
      path: '/feed', 
      component: HomeView,
      meta: { requiresAuth: true, title: 'Feed - NewsCenter' } // Diese Route braucht einen Login
    },
  ]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
    const isAuthenticated = localStorage.getItem('user') !== null;

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