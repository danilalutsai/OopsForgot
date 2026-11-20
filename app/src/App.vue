<script setup lang="ts">
import { List, Wallet } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AppLogo from './components/AppLogo.vue'
import ToastBar from './components/ToastBar.vue'

const route = useRoute()
const inApp = computed(() => !route.meta.public)

const tabs = [
  // a checklist and a wallet
  { to: '/', label: 'nav.items', icon: List },
  { to: '/money', label: 'nav.money', icon: Wallet },
]
// the current tab: accent colour, bold, and a bar along its top edge
const TAB = 'relative flex flex-col items-center justify-center gap-0.5 font-medium text-text'
const TAB_ON =
  '!font-bold !text-accent before:absolute before:inset-x-8 before:top-0 before:h-0.5 before:rounded-full before:bg-accent'
</script>

<template>
  <div class="flex min-h-dvh">
    <!-- computer: slim left sidebar -->
    <nav
      v-if="inApp"
      :aria-label="$t('nav.main')"
      class="hidden w-52 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex"
    >
      <AppLogo class="mb-6" />
      <RouterLink to="/" class="rounded-lg px-3 py-2" active-class="bg-bg font-semibold text-accent">
        {{ $t('nav.items') }}
      </RouterLink>
      <RouterLink to="/money" class="rounded-lg px-3 py-2" active-class="bg-bg font-semibold text-accent">
        {{ $t('nav.money') }}
      </RouterLink>
    </nav>
    <main :class="['flex min-w-0 flex-1 flex-col', inApp && 'pb-[var(--tab-bar)] md:pb-0']">
      <RouterView />
    </main>
    <!-- phone: bottom tab bar -->
    <nav
      v-if="inApp"
      :aria-label="$t('nav.main')"
      class="fixed inset-x-0 bottom-0 grid h-[var(--tab-bar)] grid-cols-2 border-t border-line bg-surface pb-[calc(var(--tab-bar-lift)+env(safe-area-inset-bottom,0px))] text-[13px] md:hidden"
    >
      <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to" :class="TAB" :exact-active-class="TAB_ON">
        <component :is="tab.icon" :size="20" aria-hidden="true" />
        {{ $t(tab.label) }}
      </RouterLink>
    </nav>
    <ToastBar />
  </div>
</template>
