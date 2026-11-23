<script setup lang="ts">
import { useAuth } from '../stores/auth'

defineProps<{ size?: 'xs' | 'sm' | 'lg' }>()
const auth = useAuth()
</script>

<template>
  <span
    :class="[
      'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-bold text-on-accent',
      // bigger on phones, where it is tapped with a finger
      size === 'lg'
        ? 'h-16 w-16 text-xl'
        : size === 'xs'
          ? 'h-6 w-6 text-[10px]'
          : 'h-10 w-10 text-sm md:h-8 md:w-8 md:text-xs',
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
