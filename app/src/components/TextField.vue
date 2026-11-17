<script setup lang="ts">
defineProps<{ label: string; type?: string; autocomplete?: string; hint?: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <label class="flex flex-col gap-1 text-sm">
    <span class="font-medium">{{ label }}</span>
    <input
      v-model="model"
      :type="type ?? 'text'"
      :autocomplete="autocomplete"
      class="rounded-xl border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-accent"
    />
    <span v-if="hint" class="text-muted">{{ hint }}</span>
  </label>
</template>
