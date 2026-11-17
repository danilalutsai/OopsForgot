<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatDate } from '../format'
import { useToasts } from '../stores/toasts'
import { today } from '../today'
import { pushSupport, thisDeviceEndpoint, useRemoveDevice, usePushDevices, useTurnOnPush } from './devices'

const devices = usePushDevices()
const turnOn = useTurnOnPush()
const remove = useRemoveDevice()
const toasts = useToasts()
const support = ref(pushSupport())
const here = ref<string | null>(null)
const problem = ref<string | null>(null)
const setUp = !!import.meta.env.VITE_VAPID_PUBLIC_KEY

onMounted(async () => (here.value = await thisDeviceEndpoint()))

async function enable() {
  problem.value = null
  try {
    await turnOn.mutateAsync()
    here.value = await thisDeviceEndpoint()
    toasts.show('settings.saved')
  } catch (e) {
    support.value = pushSupport()
    problem.value = (e as Error).message === 'denied' ? 'push.denied' : 'push.failed'
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 px-3 py-2 text-sm">
    <section v-if="support === 'iphoneNotInstalled'" class="rounded-2xl border border-line bg-bg p-4">
      <h3 class="font-semibold">{{ $t('push.iphoneTitle') }}</h3>
      <ol class="mt-2 list-decimal space-y-1 pl-5">
        <li v-for="(step, i) in $tm('push.iphoneSteps')" :key="i">{{ $rt(step) }}</li>
      </ol>
      <p class="mt-2 text-muted">{{ $t('push.iphoneLater') }}</p>
    </section>

    <p v-if="!devices.data.value?.length" class="text-muted">{{ $t('push.none') }}</p>
    <ul v-else :aria-label="$t('push.devices')">
      <li v-for="d in devices.data.value" :key="d.id" class="flex items-center gap-3 border-b border-line py-2">
        <div class="min-w-0 flex-1">
          <p class="font-medium">
            {{ d.label || $t('push.thisDevice') }}
            <span v-if="d.endpoint === here" class="text-muted">· {{ $t('push.thisDevice') }}</span>
          </p>
          <p class="text-muted">{{ $t('push.added', { date: formatDate(d.created_at.slice(0, 10), today) }) }}</p>
        </div>
        <button
          type="button"
          class="rounded-full border border-line px-3 py-1 font-semibold"
          :disabled="remove.isPending.value"
          @click="remove.mutate(d)"
        >
          {{ $t('push.remove') }}
        </button>
      </li>
    </ul>

    <template
      v-if="support !== 'iphoneNotInstalled' && !(here && devices.data.value?.some((d) => d.endpoint === here))"
    >
      <p v-if="!setUp" class="text-muted">{{ $t('push.notSetUp') }}</p>
      <p v-else-if="support === 'unsupported'" class="text-muted">{{ $t('push.unsupported') }}</p>
      <p v-else-if="support === 'blocked'" class="font-medium text-urgent-yellow-text">{{ $t('push.denied') }}</p>
      <div v-else class="flex items-center gap-3">
        <button
          type="button"
          class="rounded-full bg-accent px-4 py-1.5 font-semibold text-on-accent disabled:opacity-50"
          :disabled="turnOn.isPending.value"
          @click="enable"
        >
          {{ $t('push.turnOn') }}
        </button>
        <span class="text-muted">{{ $t('push.turnOnHint') }}</span>
      </div>
    </template>
    <p v-if="problem" role="alert" class="font-medium text-urgent-red">{{ $t(problem) }}</p>
  </div>
</template>
