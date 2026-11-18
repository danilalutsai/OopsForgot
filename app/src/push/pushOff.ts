import { computed } from 'vue'
import { usePushDevices } from './devices'

/** True once we know no device gets push: Reminders can't reach the person. */
export function usePushOff() {
  const devices = usePushDevices()
  return computed(() => devices.isSuccess.value && devices.data.value?.length === 0)
}
