import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import { queryClient } from './query'
import { router } from './router'
import './style.css'

createApp(App).use(createPinia()).use(router).use(VueQueryPlugin, { queryClient }).use(i18n).mount('#app')
