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
    { path: '/welcome', name: 'welcome', component: () => import('./views/auth/WelcomeView.vue') },
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
  // a Google signup says they are 16 or older before using the app (the Privacy notice stays readable)
  if (auth.loggedIn) await auth.profileLoaded()
  if (auth.loggedIn && auth.needsWelcome && to.name !== 'welcome' && to.name !== 'privacy')
    return { name: 'welcome', query: to.fullPath === '/' ? {} : { next: to.fullPath } }
  if (to.name === 'welcome' && !auth.needsWelcome) return { name: 'items' }
})
