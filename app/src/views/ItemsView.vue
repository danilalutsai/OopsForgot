<script setup lang="ts">
import { dashboardGroup, type DashboardGroup } from '@oopsforgot/shared'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, ArrowUp, Plus } from '@lucide/vue'
import TopBar from '../components/TopBar.vue'
import { useItemActions } from '../items/actions'
import AddItemSheet from '../items/AddItemSheet.vue'
import CalendarView from '../items/CalendarView.vue'
import { dueDateOf, expiredNow, handledNow, questionOf, useItems } from '../items/api'
import ItemRow from '../items/ItemRow.vue'
import ItemSheet from '../items/ItemSheet.vue'
import { formatDateTime } from '../format'
import { online } from '../online'
import { usePushOff } from '../push/pushOff'
import { useAuth } from '../stores/auth'
import { useToasts } from '../stores/toasts'
import { reducedMotion } from '../motion'
import { nowLocal, today } from '../today'

const auth = useAuth()
const items = useItems()
const actions = useItemActions()
const toasts = useToasts()
const pushOff = usePushOff()
const lastUpdated = computed(() => formatDateTime(items.dataUpdatedAt.value))
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

// Expired waits above Today, hidden: the list opens at Today. "↑ Expired" or pulling the list down
// past its top shows it, at the newest (right above Today); "↓ Hide" puts the list back at its start.
const showExpired = ref(false)
const expiredSection = ref<HTMLElement>()
const smooth = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth')
async function openExpired() {
  showExpired.value = true
  await nextTick()
  const section = expiredSection.value
  if (!section) return
  // the rows go in above what is on screen, out of sight, so nothing jumps and no old rows flash…
  window.scrollBy({ top: section.offsetHeight, behavior: 'instant' })
  // …then the newest slides into view; older ones are further up
  section.scrollIntoView({ block: 'end', behavior: smooth() })
}
async function hideExpired() {
  const height = expiredSection.value?.offsetHeight ?? 0
  showExpired.value = false
  await nextTick()
  // keep what is on screen still as the rows go, then glide back to the start of the list
  window.scrollBy({ top: -height, behavior: 'instant' })
  window.scrollTo({ top: 0, behavior: smooth() })
}
/** Only on the list, at the very top of the page, with something Expired to show. */
const canPull = () => mode.value === 'list' && !showExpired.value && expired.value.length > 0 && window.scrollY <= 0
/** How far a finger (or the wheel) must go past the top. */
const PULL = 70
let touchStart: number | null = null
let wheel = 0
function onTouchStart(e: TouchEvent) {
  touchStart = canPull() ? e.touches[0]!.clientY : null
}
function onTouchMove(e: TouchEvent) {
  if (touchStart === null || !canPull()) return
  if (e.touches[0]!.clientY - touchStart > PULL) {
    touchStart = null
    void openExpired()
  }
}
function onWheel(e: WheelEvent) {
  if (!canPull() || e.deltaY >= 0) return void (wheel = 0)
  wheel -= e.deltaY
  if (wheel > PULL) {
    wheel = 0
    void openExpired()
  }
}
onMounted(() => {
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: true })
  window.addEventListener('wheel', onWheel, { passive: true })
})
onUnmounted(() => {
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('wheel', onWheel)
})

const GROUPS: DashboardGroup[] = ['today', 'thisWeek', 'later']
/** A section's header bar: it stays at the top while its rows scroll under it. */
const GROUP_BAR = 'sticky top-0 z-[1] flex items-center justify-between bg-bg px-4 pt-5 pb-2'
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
    <div v-if="items.isSuccess.value && !all.length" class="px-6 py-10 text-center">
      <p v-if="auth.profile" class="mb-2 text-lg font-semibold">
        {{ $t('items.welcome', { name: auth.profile.name }) }}
      </p>
      <p class="text-muted">{{ $t('items.empty') }}</p>
    </div>
    <CalendarView v-if="mode === 'calendar'" :items="all" @open="(id) => (openId = id)" @add="addOn" />
    <template v-else>
      <section
        v-if="showExpired"
        id="expired"
        ref="expiredSection"
        aria-labelledby="group-expired"
        class="scroll-mb-[var(--tab-bar)] md:scroll-mb-0"
      >
        <div :class="GROUP_BAR">
          <h2 id="group-expired" :class="GROUP_TITLE">{{ $t('items.groups.expired') }}</h2>
          <button type="button" :class="HEADER_BUTTON" aria-controls="expired" @click="hideExpired">
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
      <!-- with nothing but Expired Events, the button still needs a place -->
      <div v-if="expired.length && !groups.length && !showExpired" :class="[GROUP_BAR, '!justify-end']">
        <button type="button" :class="HEADER_BUTTON" aria-expanded="false" @click="openExpired">
          <ArrowUp :size="14" aria-hidden="true" />{{ $t('items.expiredButton') }}
        </button>
      </div>
      <section v-for="(g, i) in groups" :key="g.key" :aria-labelledby="`group-${g.key}`">
        <div :class="GROUP_BAR">
          <h2 :id="`group-${g.key}`" :class="GROUP_TITLE">{{ $t(`items.groups.${g.key}`) }}</h2>
          <!-- next to the first header (Today, when there is something today) -->
          <button
            v-if="i === 0 && expired.length && !showExpired"
            type="button"
            :class="HEADER_BUTTON"
            aria-expanded="false"
            @click="openExpired"
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
