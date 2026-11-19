<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { INPUT } from '../items/ui'

/**
 * A date or time field that reads clearly empty: with no value, and while not being edited, it shows
 * a muted placeholder instead of the browser's grey example value (iOS) or "--:--" (computers).
 * Give it an aria-label: the placeholder sits inside any wrapping <label>, and would join its text.
 * A class sizes the field (it goes on the wrapper); other attributes (aria-label, min, max) go to the input.
 */
defineOptions({ inheritAttrs: false })
defineProps<{ type: 'date' | 'time'; placeholder: string }>()
const value = defineModel<string>({ default: '' })
const attrs = useAttrs()
const inputAttrs = computed(() => ({ ...attrs, class: undefined }))
</script>

<template>
  <span :class="['relative block min-w-0', attrs.class]">
    <input
      v-model="value"
      :type="type"
      v-bind="inputAttrs"
      :data-empty="!value || undefined"
      :class="[INPUT, 'peer']"
    />
    <span
      v-if="!value"
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted peer-focus:hidden"
    >
      {{ placeholder }}
    </span>
  </span>
</template>
