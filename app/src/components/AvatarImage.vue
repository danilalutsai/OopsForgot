<script setup lang="ts">
import { initials } from '@oopsproof/shared'
import { computed, ref, watch } from 'vue'
import { photoUrl } from '../settings/photo'
import { useAuth } from '../stores/auth'

defineProps<{ size?: 'sm' | 'lg' }>()
const auth = useAuth()
const letters = computed(() => (auth.profile ? initials(auth.profile.name, auth.profile.surname) : ''))
const url = ref<string | null>(null)

watch(
  () => auth.profile?.photo_path,
  async (path) => (url.value = path ? await photoUrl(path) : null),
  { immediate: true },
)
</script>

<template>
  <span
    :class="[
      'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-bold text-on-accent',
      size === 'lg' ? 'h-16 w-16 text-xl' : 'h-8 w-8 text-xs',
    ]"
  >
    <img v-if="url" :src="url" alt="" class="h-full w-full object-cover" />
    <template v-else>{{ letters }}</template>
  </span>
</template>
