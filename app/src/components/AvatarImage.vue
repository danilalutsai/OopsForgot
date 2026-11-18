<script setup lang="ts">
import { useAuth } from '../stores/auth'

defineProps<{ size?: 'sm' | 'lg' }>()
const auth = useAuth()
</script>

<template>
  <span
    :class="[
      'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-bold text-on-accent',
      size === 'lg' ? 'h-16 w-16 text-xl' : 'h-8 w-8 text-xs',
    ]"
  >
    <!-- a Google photo is fetched without telling Google which page asks -->
    <img
      v-if="auth.photoUrl"
      :src="auth.photoUrl"
      alt=""
      referrerpolicy="no-referrer"
      class="h-full w-full object-cover"
    />
    <template v-else>{{ auth.initials }}</template>
  </span>
</template>
