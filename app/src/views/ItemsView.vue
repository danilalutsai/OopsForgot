<script setup lang="ts">
import { dashboardGroup, type DashboardGroup } from '@oopsforgot/shared'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, ArrowUp, Plus } from '@lucide/vue'
import TopBar from '../components/TopBar.vue'
import { useItemActions } from '../items/actions'
import AddItemSheet from '../items/AddItemSheet.vue'
import CalendarView from '../items/CalendarView.vue'
import { dueDateOf, expiredNow, handledNow, questionOf, useItems } from '../items/api'
import ItemRow from '../items/ItemRow.vue'
import ItemSheet from '../items/ItemSheet.vue'
import ListBanners from '../items/ListBanners.vue'
import { useAuth } from '../stores/auth'
import { useToasts } from '../stores/toasts'
import { reducedMotion } from '../motion'
import { nowLocal, today } from '../today'

const auth = useAuth()
const items = useItems()
const actions = useItemActions()
const toasts = useToasts()
const adding = ref(false)
/** The day a new Item starts on when added from the calendar. */
const addingOn = ref<string>()
function addOn(day?: string) {
  addingOn.value = day
  adding.value = true
}
const mode = ref<'list' | 'calendar'>('list')
const tabs: Partial<Record<'list' | 'calendar', HTMLElement>> = {}
/** Arrow keys move between the two tabs, as the tab pattern expects. */
function switchMode() {
  mode.value = mode.value === 'list' ? 'calendar' : 'list'
  tabs[mode.value]?.focus()
}
const openId = ref<string | null>(null)
const openItem = computed(() => items.data.value?.find((i) => i.id === openId.value) ?? null)

// A push Reminder opens the app at /?item=<id>: show that Item, then tidy the address. The copy saved
// on the device may be older than the Item: until the fresh list is in, keep waiting for it.
const route = useRoute()
const router = useRouter()
watch(
  () => [route.query.item, items.data.value, items.isFetching.value] as const,
  ([id, list, fetching]) => {
    if (typeof id !== 'string' || !list) return
    const found = list.some((i) => i.id === id)
    if (!found && fetching) return
    if (found) openId.value = id
    const { item: _opened, ...rest } = route.query
    void router.replace({ query: rest })
  },
  { immediate: true },
)

const all = computed(() => items.data.value ?? [])

/**
 * Each Item with the Due date it is on today, whether it is Handled and whether it is Expired, worked
 * out once, in pure Due-date order (no-time Items last). Handled Items keep their place.
 */
const rows = computed(() =>
  all.value
    .map((item) => {
      const due = dueDateOf(item, today.value)
      return {
        item,
        due,
        handled: handledNow(item, today.value, due),
        question: questionOf(item, nowLocal.value, due),
        expired: expiredNow(item, nowLocal.value),
      }
    })
    .sort(
      (a, b) =>
        a.due.localeCompare(b.due) ||
        (a.item.due_time ?? '99').localeCompare(b.item.due_time ?? '99') ||
        (a.item.finish_time ?? '99').localeCompare(b.item.finish_time ?? '99'),
    ),
)

/** Expired Items, oldest first: the most recent sits right above Today. */
const expired = computed(() => rows.value.filter((r) => r.expired))

// Expired sits right above Today and is always on the page, so scrolling up into it is plain
// scrolling. The list opens at Today (the Expired rows are just out of sight above it); the top bar
// stays pinned. "↑ Expired" glides to the newest Expired; "↓ Hide" glides back to Today.
const pinned = ref<HTMLElement>()
const expiredSection = ref<HTMLElement>()
const listStart = ref<HTMLElement>()
const smooth = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth')
const pinnedHeight = () => pinned.value?.offsetHeight ?? 0
function showNewestExpired() {
  expiredSection.value?.scrollIntoView({ block: 'end', behavior: smooth() })
}
function backToToday() {
  if (!listStart.value) return
  const top = listStart.value.getBoundingClientRect().top + window.scrollY - pinnedHeight()
  window.scrollTo({ top, behavior: smooth() })
}

// The pinned bar's height, for the sticky section headers right under it.
let pinnedWatch: ResizeObserver | undefined
// When the Expired rows grow or shrink (they first appear, one expires, one is deleted) while the
// person is at or below Today, the page moves by as much, so what is on screen stays still. Done by
// hand, the same in every browser (Safari has no scroll anchoring of its own).
let expiredWatch: ResizeObserver | undefined
let expiredHeight = 0
function followExpired(height: number) {
  const section = expiredSection.value
  const delta = height - expiredHeight
  if (section && delta) {
    const bottomBefore = section.getBoundingClientRect().top + window.scrollY + expiredHeight
    if (window.scrollY + pinnedHeight() >= bottomBefore - 1) window.scrollBy({ top: delta, behavior: 'instant' })
  }
  expiredHeight = height
}
watch(expiredSection, (section, before) => {
  if (before) expiredWatch?.unobserve(before)
  expiredHeight = 0
  if (section) expiredWatch?.observe(section)
})
// back on the list from the calendar: at Today again
watch(mode, async (m) => {
  if (m !== 'list') return
  window.scrollTo({ top: 0, behavior: 'instant' })
})
onMounted(() => {
  // the browser's own anchoring would move the page a second time
  document.documentElement.style.overflowAnchor = 'none'
  pinnedWatch = new ResizeObserver(() =>
    document.documentElement.style.setProperty('--list-top', `${pinnedHeight()}px`),
  )
  if (pinned.value) pinnedWatch.observe(pinned.value)
  expiredWatch = new ResizeObserver((entries) => followExpired(entries.at(-1)!.target.getBoundingClientRect().height))
  if (expiredSection.value) expiredWatch.observe(expiredSection.value)
})
onUnmounted(() => {
  document.documentElement.style.overflowAnchor = ''
  pinnedWatch?.disconnect()
  expiredWatch?.disconnect()
})

const GROUPS: DashboardGroup[] = ['today', 'thisWeek', 'later']
/** A section's header bar: it stays at the top while its rows scroll under it. */
const GROUP_BAR = 'sticky top-[var(--list-top,0px)] z-[1] flex items-center justify-between bg-bg px-4 pt-5 pb-2'
const GROUP_TITLE = 'text-[13px] leading-5 font-semibold tracking-wide text-muted uppercase'
/**
 * "↑ Expired" and "↓ Hide" read like the header's title, on the same line; the negative margin gives
 * them a 44px tap area without making the bar taller.
 */
const HEADER_BUTTON = `${GROUP_TITLE} -my-3 -mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-accent`
const groups = computed(() =>
  GROUPS.map((g) => ({
    key: g,
    rows: rows.value.filter((r) => !r.expired && dashboardGroup(r.due, today.value) === g),
  })).filter((g) => g.rows.length),
)
</script>

<template>
  <!-- pinned: the Events scroll under it, Expired included -->
  <div ref="pinned" class="sticky top-0 z-[2] bg-bg">
    <TopBar>
      <template #actions>
        <button
          type="button"
          class="mr-2 hidden rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent md:block"
          @click="addOn()"
        >
          <Plus :size="16" :stroke-width="2.5" class="-mt-0.5 mr-0.5 inline" aria-hidden="true" />{{ $t('items.add') }}
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
  </div>

  <p v-if="items.isError.value" role="alert" class="px-6 py-10 text-center text-urgent-red">
    {{ $t('items.loadError') }}
  </p>
  <div v-else :id="`panel-${mode}`" role="tabpanel" :aria-labelledby="`tab-${mode}`">
    <div v-if="items.isSuccess.value && !all.length" class="px-6 py-10 text-center">
      <p v-if="auth.profile" class="mb-2 text-lg font-semibold">
        {{ $t('items.welcome', { name: auth.profile.name }) }}
      </p>
      <p class="text-muted">{{ $t('items.empty') }}</p>
    </div>
    <ListBanners v-if="mode === 'calendar'" :updated-at="items.dataUpdatedAt.value" />
    <CalendarView v-if="mode === 'calendar'" :items="all" @open="(id) => (openId = id)" @add="addOn" />
    <template v-else>
      <section
        v-if="expired.length"
        id="expired"
        ref="expiredSection"
        aria-labelledby="group-expired"
        class="scroll-mt-[var(--list-top,0px)] scroll-mb-[var(--tab-bar)] md:scroll-mb-0"
      >
        <div :class="GROUP_BAR">
          <h2 id="group-expired" :class="GROUP_TITLE">{{ $t('items.groups.expired') }}</h2>
          <button type="button" :class="HEADER_BUTTON" @click="backToToday">
            <ArrowDown :size="14" aria-hidden="true" />{{ $t('items.hideExpired') }}
          </button>
        </div>
        <ul>
          <ItemRow
            v-for="r in expired"
            :key="r.item.id"
            :item="r.item"
            :due="r.due"
            :handled="r.handled"
            :question="r.question"
            expired
            :remove="() => actions.delete(r.item)"
            @open="openId = r.item.id"
            @toggle-handled="actions.toggleHandled(r.item, r.due)"
          />
        </ul>
      </section>
      <!-- where the list opens: Today (and the notes above it) at the top, under the pinned bar;
           tall enough to get there even with few Events -->
      <div
        ref="listStart"
        class="min-h-[calc(100dvh-var(--list-top,0px)-var(--tab-bar))] md:min-h-[calc(100dvh-var(--list-top,0px))]"
      >
        <ListBanners :updated-at="items.dataUpdatedAt.value" />
        <!-- with nothing but Expired Events, the button still needs a place -->
        <div v-if="expired.length && !groups.length" :class="[GROUP_BAR, '!justify-end']">
          <button type="button" :class="HEADER_BUTTON" aria-controls="expired" @click="showNewestExpired">
            <ArrowUp :size="14" aria-hidden="true" />{{ $t('items.expiredButton') }}
          </button>
        </div>
        <section v-for="(g, i) in groups" :key="g.key" :aria-labelledby="`group-${g.key}`">
          <div :class="GROUP_BAR">
            <h2 :id="`group-${g.key}`" :class="GROUP_TITLE">{{ $t(`items.groups.${g.key}`) }}</h2>
            <!-- next to the first header (Today, when there is something today) -->
            <button
              v-if="i === 0 && expired.length"
              type="button"
              :class="HEADER_BUTTON"
              aria-controls="expired"
              @click="showNewestExpired"
            >
              <ArrowUp :size="14" aria-hidden="true" />{{ $t('items.expiredButton') }}
            </button>
          </div>
          <ul>
            <ItemRow
              v-for="r in g.rows"
              :key="r.item.id"
              :item="r.item"
              :due="r.due"
              :handled="r.handled"
              :question="r.question"
              :remove="() => actions.delete(r.item)"
              @open="openId = r.item.id"
              @toggle-handled="actions.toggleHandled(r.item, r.due)"
            />
          </ul>
        </section>
      </div>
    </template>
  </div>

  <!-- room to scroll the last row above the floating + button on phones -->
  <div class="h-28 shrink-0 md:hidden" aria-hidden="true" />

  <button
    type="button"
    class="fixed right-5 bottom-[calc(var(--tab-bar)+1.25rem)] z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl text-on-accent shadow-lg md:hidden"
    :aria-label="$t('items.add')"
    @click="addOn()"
  >
    <Plus :size="28" :stroke-width="2.25" aria-hidden="true" />
  </button>
  <AddItemSheet v-model:open="adding" :date="addingOn" @saved="toasts.show('itemForm.saved')" />
  <ItemSheet :item="openItem" @close="openId = null" />
</template>
