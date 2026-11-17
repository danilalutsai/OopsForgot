<script setup lang="ts">
import { CATEGORIES, CATEGORY_ICONS, type Category } from '@oopsproof/shared'

defineProps<{ legend: string; name: string }>()
const model = defineModel<Category | null>({ required: true })
</script>

<template>
  <fieldset class="flex flex-col gap-2 text-sm">
    <legend class="mb-1 font-medium">{{ legend }}</legend>
    <div class="flex flex-wrap gap-2">
      <label
        v-for="c in CATEGORIES"
        :key="c"
        :class="[
          'cursor-pointer rounded-full border px-3 py-1.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
          model === c ? 'border-accent bg-accent text-on-accent' : 'border-line',
        ]"
      >
        <input v-model="model" type="radio" :name="name" :value="c" class="sr-only" />
        {{ CATEGORY_ICONS[c] }} {{ $t(`categories.${c}`) }}
      </label>
    </div>
  </fieldset>
</template>
