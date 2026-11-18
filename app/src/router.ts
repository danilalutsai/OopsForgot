import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './stores/auth'
import ItemsView from './views/ItemsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'items', component: ItemsView },
    { path: '/money', name: 'money', component: () => import('./views/MoneyView.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/signup', name: 'signup', component: () => import('./views/auth/SignUpView.vue'), meta: { public: true } },
    { path: '/login', name: 'login', component: () => import('./views/auth/LogInView.vue'), meta: { public: true } },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('./views/auth/ForgotPasswordView.vue'),
      meta: { public: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('./views/auth/ResetPasswordView.vue'),
      meta: { public: true },
    },
    { path: '/privacy', name: 'privacy', component: () => import('./views/PrivacyView.vue'), meta: { public: true } },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuth()
  await auth.ready
  if (auth.recovering && to.name !== 'reset-password') return { name: 'reset-password' }
  // keep where the person was going (a Reminder link, say) to continue there after logging in
  if (!to.meta.public && !auth.loggedIn)
    return { name: 'login', query: to.fullPath === '/' ? {} : { next: to.fullPath } }
  if ((to.name === 'login' || to.name === 'signup') && auth.loggedIn) return { name: 'items' }
})
