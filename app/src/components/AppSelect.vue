<script setup lang="ts" generic="T extends string">
import { Check, ChevronDown } from '@lucide/vue'
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'
import { INPUT } from '../items/ui'

/**
 * A choice from a short list, in the app's look instead of the phone's own picker: a field like the
 * date and time fields that opens a list below it. Give it an aria-label; a class goes on the field.
 */
defineOptions({ inheritAttrs: false })
defineProps<{ options: readonly { value: T; label: string }[] }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <SelectRoot v-model="model">
    <SelectTrigger
      v-bind="$attrs"
      :class="[
        INPUT,
        'flex min-h-[2.875rem] items-center justify-between gap-2 text-left data-[state=open]:border-accent',
      ]"
    >
      <SelectValue class="truncate" />
      <ChevronDown :size="18" class="shrink-0 text-muted" aria-hidden="true" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="6"
        :collision-padding="12"
        class="z-50 max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) overflow-hidden rounded-2xl border border-line bg-raised p-1 text-text shadow-xl"
      >
        <SelectViewport>
          <SelectItem
            v-for="o in options"
            :key="o.value"
            :value="o.value"
            class="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-base outline-none select-none data-[highlighted]:bg-bg data-[state=checked]:font-semibold data-[state=checked]:text-accent"
          >
            <SelectItemText>{{ o.label }}</SelectItemText>
            <SelectItemIndicator><Check :size="16" aria-hidden="true" /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
