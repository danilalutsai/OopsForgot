import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../supabase'

export interface PushDevice {
  id: string
  endpoint: string
  label: string
  created_at: string
}

export function usePushDevices() {
  return useQuery({
    queryKey: ['push_devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('push_devices')
        .select('id, endpoint, label, created_at')
        .order('created_at')
      if (error) throw error
      return data as PushDevice[]
    },
  })
}

/** What can happen on this device. */
export type PushSupport = 'ready' | 'iphoneNotInstalled' | 'blocked' | 'unsupported'

const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function pushSupport(): PushSupport {
  // iPhone push only works in the app added to the Home Screen
  if (isIos() && !isInstalled()) return 'iphoneNotInstalled'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return 'ready'
}

/** A short name for this device, like "Chrome on Mac". */
export function deviceLabel(ua = navigator.userAgent): string {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : ''
  return os ? `${browser} on ${os}` : browser
}

/** The push subscription of this browser, if it has one. */
export async function thisDeviceEndpoint(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription())?.endpoint ?? null
}

function keyBytes(base64url: string): Uint8Array {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export function useTurnOnPush() {
  const queryClient = useQueryClient()
  return useMutation({
    /** Asks the browser, subscribes this device and saves it. Throws 'denied' when the person says no. */
    mutationFn: async () => {
      const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!key) throw new Error('Push is not set up')
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('denied')
      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(key).buffer as ArrayBuffer,
        }))
      const json = sub.toJSON()
      const { error } = await supabase.from('push_devices').upsert(
        {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
          label: deviceLabel(),
        },
        { onConflict: 'endpoint', ignoreDuplicates: true },
      )
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['push_devices'] }),
  })
}

export function useRemoveDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (device: PushDevice) => {
      const { error } = await supabase.from('push_devices').delete().eq('id', device.id)
      if (error) throw error
      // removing this very device also stops its browser subscription
      if ((await thisDeviceEndpoint()) === device.endpoint) {
        const reg = await navigator.serviceWorker.getRegistration()
        await (await reg?.pushManager.getSubscription())?.unsubscribe()
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['push_devices'] }),
  })
}
