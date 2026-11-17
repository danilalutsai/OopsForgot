import { createRouter, createWebHistory } from 'vue-router'
import ItemsView from './views/ItemsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'items', component: ItemsView },
    { path: '/money', name: 'money', component: () => import('./views/MoneyView.vue') },
  ],
})
