<script setup lang="ts">
import { CATEGORY_ICONS, dashboardGroup, type DashboardGroup } from '@oopsproof/shared'
import { computed, ref } from 'vue'
import TopBar from '../components/TopBar.vue'
import { useItemActions } from '../items/actions'
import AddItemSheet from '../items/AddItemSheet.vue'
import { dueDateOf, handledNow, useItems } from '../items/api'
import ItemRow from '../items/ItemRow.vue'
import ItemSheet from '../items/ItemSheet.vue'
import { useAuth } from '../stores/auth'
import { useToasts } from '../stores/toasts'
import { today } from '../today'

const auth = useAuth()
const items = useItems()
const actions = useItemActions()
const toasts = useToasts()
const adding = ref(false)
const showArchived = ref(false)
const openId = ref<string | null>(null)
const openItem = computed(() => items.data.value?.find((i) => i.id === openId.value) ?? null)

const active = computed(() => (items.data.value ?? []).filter((i) => !i.archived_at))
const archived = computed(() => (items.data.value ?? []).filter((i) => i.archived_at))

/**
 * Each active Item with the Due date it is on today and whether it is Handled, worked out once,
 * in pure Due-date order (no-time Items last). Handled Items keep their place.
 */
const rows = computed(() =>
  active.value
    .map((item) => {
      const due = dueDateOf(item, today.value)
      return { item, due, handled: handledNow(item, today.value, due) }
    })
    .sort((a, b) => a.due.localeCompare(b.due) || (a.item.due_time ?? '99').localeCompare(b.item.due_time ?? '99')),
)

const GROUPS: DashboardGroup[] = ['today', 'thisWeek', 'later']
const groups = computed(() =>
  GROUPS.map((g) => ({
    key: g,
    rows: rows.value.filter((r) => dashboardGroup(r.due, today.value) === g),
  })).filter((g) => g.rows.length),
)
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
      <ItemRow
        v-for="r in g.rows"
        :key="r.item.id"
        :item="r.item"
        :due="r.due"
        :handled="r.handled"
        @open="openId = r.item.id"
        @toggle-handled="actions.toggleHandled(r.item, r.due)"
        :archive="() => actions.archive(r.item)"
      />
    </ul>
  </section>

  <div v-if="archived.length" class="px-4 pt-6 pb-24">
    <button
      type="button"
      class="text-sm font-semibold text-accent"
      :aria-expanded="showArchived"
      @click="showArchived = !showArchived"
    >
      {{ showArchived ? $t('items.hideArchived') : $t('items.archivedCount', { n: archived.length }) }}
    </button>
    <ul v-if="showArchived" class="mt-2" :aria-label="$t('items.archivedCount', { n: archived.length })">
      <li v-for="item in archived" :key="item.id" class="flex items-center gap-3 border-b border-line py-3">
        <span class="text-xl" aria-hidden="true">{{ CATEGORY_ICONS[item.category] }}</span>
        <span class="flex-1 truncate text-muted">{{ item.name }}</span>
        <button
          type="button"
          class="rounded-full border border-line px-3 py-1 text-sm font-semibold"
          @click="actions.restore(item)"
        >
          {{ $t('items.restore') }}
        </button>
      </li>
    </ul>
  </div>

  <button
    type="button"
    class="fixed right-5 bottom-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl text-on-accent shadow-lg md:hidden"
    :aria-label="$t('items.add')"
    @click="adding = true"
  >
    +
  </button>
  <AddItemSheet v-model:open="adding" @saved="toasts.show('itemForm.saved')" />
  <ItemSheet :item="openItem" @close="openId = null" />
</template>
