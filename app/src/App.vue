<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AppLogo from './components/AppLogo.vue'
import ToastBar from './components/ToastBar.vue'

const route = useRoute()
const inApp = computed(() => !route.meta.public)

const tabs = [
  // a checklist and a wallet, drawn so they read the same in every font
  { to: '/', label: 'nav.items', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
  {
    to: '/money',
    label: 'nav.money',
    icon: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5M16 14h.01',
  },
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
        <svg
          viewBox="0 0 24 24"
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path :d="tab.icon" />
        </svg>
        {{ $t(tab.label) }}
      </RouterLink>
    </nav>
    <ToastBar />
  </div>
</template>
