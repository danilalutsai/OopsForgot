<script setup lang="ts">
import type { Countdown } from '@oopsforgot/shared'

defineProps<{ countdown: Countdown }>()
</script>

<template>
  <template v-if="countdown.kind === 'dueToday'">{{ $t('items.countdown.dueToday') }}</template>
  <template v-else-if="countdown.kind === 'dueIn' && countdown.days === 1">{{ $t('items.countdown.tomorrow') }}</template>
  <template v-else>{{ $t(`items.countdown.${countdown.kind}`, { days: countdown.days }, countdown.days) }}</template>
</template>
