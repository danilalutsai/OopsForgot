<script setup lang="ts">
import { dashboardGroup, type DashboardGroup } from '@oopsproof/shared'
import { computed, onBeforeUnmount, ref } from 'vue'
import TopBar from '../components/TopBar.vue'
import AddItemSheet from '../items/AddItemSheet.vue'
import { useItems } from '../items/api'
import ItemRow from '../items/ItemRow.vue'
import { useAuth } from '../stores/auth'
import { today } from '../today'

const auth = useAuth()
const items = useItems()
const adding = ref(false)
const toast = ref<string | null>(null)

const GROUPS: DashboardGroup[] = ['today', 'thisWeek', 'later']
const groups = computed(() =>
  GROUPS.map((g) => ({
    key: g,
    items: (items.data.value ?? []).filter((i) => dashboardGroup(i.due_date, today.value) === g),
  })).filter((g) => g.items.length),
)

let toastTimer: ReturnType<typeof setTimeout> | undefined
function saved() {
  clearTimeout(toastTimer)
  toast.value = 'itemForm.saved'
  toastTimer = setTimeout(() => (toast.value = null), 2500)
}
onBeforeUnmount(() => clearTimeout(toastTimer))
</script>

<template>
  <TopBar>
    <template #actions>
      <button
        type="button"
        class="mr-2 hidden rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent md:block"
        @click="adding = true"
      >
        + {{ $t('items.add') }}
      </button>
    </template>
  </TopBar>
  <div class="mx-4 mb-2 grid grid-cols-2 rounded-xl border border-line bg-bg p-1 text-sm" role="tablist">
    <span role="tab" aria-selected="true" class="rounded-lg bg-surface py-1.5 text-center font-semibold shadow-sm">
      {{ $t('items.list') }}
    </span>
    <span role="tab" aria-selected="false" class="py-1.5 text-center text-muted">{{ $t('items.calendar') }}</span>
  </div>

  <p v-if="items.isError.value" role="alert" class="px-6 py-10 text-center text-urgent-red">
    {{ $t('items.loadError') }}
  </p>
  <div v-else-if="items.isSuccess.value && !groups.length" class="px-6 py-10 text-center">
    <p v-if="auth.profile" class="mb-2 text-lg font-semibold">{{ $t('items.welcome', { name: auth.profile.name }) }}</p>
    <p class="text-muted">{{ $t('items.empty') }}</p>
  </div>
  <section v-for="g in groups" :key="g.key" :aria-labelledby="`group-${g.key}`">
    <h2 :id="`group-${g.key}`" class="px-4 pt-4 pb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
      {{ $t(`items.groups.${g.key}`) }}
    </h2>
    <ul>
      <ItemRow v-for="item in g.items" :key="item.id" :item="item" />
    </ul>
  </section>

  <button
    type="button"
    class="fixed right-5 bottom-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl text-on-accent shadow-lg md:hidden"
    :aria-label="$t('items.add')"
    @click="adding = true"
  >
    +
  </button>
  <AddItemSheet v-model:open="adding" @saved="saved" />
  <p
    v-if="toast"
    role="status"
    class="fixed bottom-36 left-1/2 -translate-x-1/2 rounded-full bg-text px-4 py-2 text-sm text-bg shadow-lg md:bottom-8"
  >
    {{ $t(toast) }}
  </p>
</template>
