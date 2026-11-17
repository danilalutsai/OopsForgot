<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AppLogo from './components/AppLogo.vue'
import ToastBar from './components/ToastBar.vue'

const route = useRoute()
const inApp = computed(() => !route.meta.public)
</script>

<template>
  <div class="flex min-h-dvh">
    <!-- computer: slim left sidebar -->
    <nav v-if="inApp" class="hidden w-52 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex">
      <AppLogo class="mb-6" />
      <RouterLink to="/" class="rounded-lg px-3 py-2" active-class="bg-bg font-semibold text-accent">
        {{ $t('nav.items') }}
      </RouterLink>
      <RouterLink to="/money" class="rounded-lg px-3 py-2" active-class="bg-bg font-semibold text-accent">
        {{ $t('nav.money') }}
      </RouterLink>
    </nav>
    <main :class="['flex min-w-0 flex-1 flex-col', inApp && 'pb-16 md:pb-0']">
      <RouterView />
    </main>
    <!-- phone: bottom tab bar -->
    <nav
      v-if="inApp"
      class="fixed inset-x-0 bottom-0 grid grid-cols-2 border-t border-line bg-surface text-center text-xs md:hidden"
    >
      <RouterLink to="/" class="py-3 text-muted" exact-active-class="font-semibold !text-accent">
        {{ $t('nav.items') }}
      </RouterLink>
      <RouterLink to="/money" class="py-3 text-muted" exact-active-class="font-semibold !text-accent">
        {{ $t('nav.money') }}
      </RouterLink>
    </nav>
    <ToastBar />
  </div>
</template>
