import { describe, expect, it, vi } from 'vitest'
import { startAppUpdates } from './appUpdate'

/** A page with a service worker, a visibility state, maybe an open sheet, and a reload to count. */
function page({ controlled = true, sheetOpen = false } = {}) {
  const sw = new EventTarget() as EventTarget & { controller: object | null; ready: Promise<{ update(): void }> }
  const update = vi.fn()
  sw.controller = controlled ? {} : null
  sw.ready = Promise.resolve({ update })
  const doc = new EventTarget() as EventTarget & { visibilityState: string; querySelector(s: string): unknown }
  doc.visibilityState = 'visible'
  const state = { sheetOpen }
  doc.querySelector = () => (state.sheetOpen ? {} : null)
  const reload = vi.fn()
  startAppUpdates(sw as never, doc as never, reload)
  const comeBack = async () => {
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
  }
  return { sw, update, reload, state, comeBack, newVersion: () => sw.dispatchEvent(new Event('controllerchange')) }
}

describe('startAppUpdates', () => {
  it('looks for a new version when the app opens and each time it comes back', async () => {
    const p = page()
    await Promise.resolve()
    expect(p.update).toHaveBeenCalledTimes(1)
    await p.comeBack()
    expect(p.update).toHaveBeenCalledTimes(2)
  })

  it('switches to a new version at once', () => {
    const p = page()
    p.newVersion()
    expect(p.reload).toHaveBeenCalledTimes(1)
  })

  it('never reloads in the middle of an open sheet: it waits until the app comes back', async () => {
    const p = page({ sheetOpen: true })
    p.newVersion()
    expect(p.reload).not.toHaveBeenCalled()
    p.state.sheetOpen = false
    await p.comeBack()
    expect(p.reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload on the very first visit, when the service worker first takes over', () => {
    const p = page({ controlled: false })
    p.newVersion()
    expect(p.reload).not.toHaveBeenCalled()
  })
})
