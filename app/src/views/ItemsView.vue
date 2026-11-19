<script setup lang="ts">
import { CATEGORY_ICONS, dashboardGroup, type DashboardGroup } from '@oopsproof/shared'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopBar from '../components/TopBar.vue'
import { useItemActions } from '../items/actions'
import AddItemSheet from '../items/AddItemSheet.vue'
import CalendarView from '../items/CalendarView.vue'
import { dueDateOf, handledNow, questionOf, useItems } from '../items/api'
import ItemRow from '../items/ItemRow.vue'
import ItemSheet from '../items/ItemSheet.vue'
import { formatDateTime } from '../format'
import { online } from '../online'
import { usePushOff } from '../push/pushOff'
import { useAuth } from '../stores/auth'
import { useToasts } from '../stores/toasts'
import { today } from '../today'

const auth = useAuth()
const items = useItems()
const actions = useItemActions()
const toasts = useToasts()
const pushOff = usePushOff()
const lastUpdated = computed(() => formatDateTime(items.dataUpdatedAt.value))
const adding = ref(false)
const showArchived = ref(false)
const mode = ref<'list' | 'calendar'>('list')
const tabs: Partial<Record<'list' | 'calendar', HTMLElement>> = {}
/** Arrow keys move between the two tabs, as the tab pattern expects. */
function switchMode() {
  mode.value = mode.value === 'list' ? 'calendar' : 'list'
  tabs[mode.value]?.focus()
}
const openId = ref<string | null>(null)
const openItem = computed(() => items.data.value?.find((i) => i.id === openId.value) ?? null)

// A push Reminder opens the app at /?item=<id>: show that Item, then tidy the address.
const route = useRoute()
const router = useRouter()
watch(
  () => [route.query.item, items.data.value] as const,
  ([id, list]) => {
    if (typeof id !== 'string' || !list) return
    if (list.some((i) => i.id === id)) openId.value = id
    const { item: _opened, ...rest } = route.query
    void router.replace({ query: rest })
  },
  { immediate: true },
)

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
      return { item, due, handled: handledNow(item, today.value, due), question: questionOf(item, today.value, due) }
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
  <div
    class="mx-4 mb-2 grid grid-cols-2 rounded-xl border border-line bg-bg p-1 text-sm"
    role="tablist"
    @keydown.left.prevent="switchMode"
    @keydown.right.prevent="switchMode"
  >
    <button
      v-for="m in ['list', 'calendar'] as const"
      :id="`tab-${m}`"
      :ref="(el) => (tabs[m] = el as HTMLElement)"
      :key="m"
      type="button"
      role="tab"
      :aria-selected="mode === m"
      :aria-controls="`panel-${m}`"
      :tabindex="mode === m ? 0 : -1"
      :class="['rounded-lg py-1.5 text-center', mode === m ? 'bg-surface font-semibold shadow-sm' : 'text-muted']"
      @click="mode = m"
    >
      {{ $t(`items.${m}`) }}
    </button>
  </div>

  <p v-if="!online" role="status" class="mx-4 mb-2 rounded-xl bg-line px-3 py-2 text-sm">
    {{ items.dataUpdatedAt.value ? $t('offline.banner', { when: lastUpdated }) : $t('offline.bannerNever') }}
  </p>
  <p v-if="pushOff && online" class="mx-4 mb-2 rounded-xl bg-urgent-yellow/15 px-3 py-2 text-sm">
    {{ $t('push.offBanner') }}
    <RouterLink to="/settings" class="font-semibold text-accent underline">{{ $t('push.offBannerLink') }}</RouterLink>
  </p>

  <p v-if="items.isError.value" role="alert" class="px-6 py-10 text-center text-urgent-red">
    {{ $t('items.loadError') }}
  </p>
  <div v-else :id="`panel-${mode}`" role="tabpanel" :aria-labelledby="`tab-${mode}`">
    <div v-if="items.isSuccess.value && !active.length" class="px-6 py-10 text-center">
      <p v-if="auth.profile" class="mb-2 text-lg font-semibold">
        {{ $t('items.welcome', { name: auth.profile.name }) }}
      </p>
      <p class="text-muted">{{ $t('items.empty') }}</p>
    </div>
    <CalendarView v-if="mode === 'calendar'" :items="active" @open="(id) => (openId = id)" />
    <template v-else>
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
            :question="r.question"
            :archive="() => actions.archive(r.item)"
            @open="openId = r.item.id"
            @toggle-handled="actions.toggleHandled(r.item, r.due)"
          />
        </ul>
      </section>

      <div v-if="archived.length" class="px-4 pt-6 pb-6">
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
    </template>
  </div>


  <!-- room to scroll the last row above the floating + button on phones -->
  <div class="h-28 shrink-0 md:hidden" aria-hidden="true" />

  <button
    type="button"
    class="fixed right-5 bottom-[4.25rem] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl text-on-accent shadow-lg md:hidden"
    :aria-label="$t('items.add')"
    @click="adding = true"
  >
    +
  </button>
  <AddItemSheet v-model:open="adding" @saved="toasts.show('itemForm.saved')" />
  <ItemSheet :item="openItem" @close="openId = null" />
</template>
