<script setup lang="ts">
import { CATEGORIES, type Category } from '@oopsforgot/shared'
import CategoryIcon from '../components/CategoryIcon.vue'

withDefaults(defineProps<{ legend: string; name: string; options?: readonly Category[] }>(), {
  options: () => CATEGORIES,
})
const model = defineModel<Category | null>({ required: true })
</script>

<template>
  <fieldset class="flex flex-col gap-2 text-sm">
    <legend class="mb-1 font-medium">{{ legend }}</legend>
    <div class="flex flex-wrap gap-2">
      <label
        v-for="c in options"
        :key="c"
        :class="[
          'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
          model === c ? 'border-accent bg-accent text-on-accent' : 'border-line',
        ]"
      >
        <input v-model="model" type="radio" :name="name" :value="c" class="sr-only" />
        <CategoryIcon :category="c" :size="16" :class="model !== c && 'text-muted'" />
        {{ $t(`categories.${c}`) }}
      </label>
    </div>
  </fieldset>
</template>
