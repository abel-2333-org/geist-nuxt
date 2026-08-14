// useRafTask — the shared frame-coalescing scheduler extracted from SplitPane /
// CodeRail / EnumTable / SidebarScenarioTags. Covers the scheduling contract:
// same-frame coalescing with latest-args-win, re-scheduling from inside the
// task (frame id cleared before the run), idempotent explicit cancel, automatic
// cancellation on scope dispose (unmount), and the synchronous no-rAF fallback.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useRafTask, type UseRafTaskReturn } from '../../foundation/composables/useRafTask'

// Manual frame queue: frames only fire when the test says so, and callbacks
// scheduled while a frame runs land in the NEXT frame (browser semantics).
let frames = new Map<number, FrameRequestCallback>()
let rafSpy: ReturnType<typeof vi.fn>
let cafSpy: ReturnType<typeof vi.fn>

function stubRaf() {
  frames = new Map()
  let nextId = 1
  rafSpy = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId++
    frames.set(id, callback)
    return id
  })
  cafSpy = vi.fn((id: number) => {
    frames.delete(id)
  })
  vi.stubGlobal('requestAnimationFrame', rafSpy)
  vi.stubGlobal('cancelAnimationFrame', cafSpy)
}

function fireFrame() {
  const pending = [...frames.values()]
  frames.clear()
  for (const callback of pending) callback(0)
}

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function mountTask<Args extends unknown[]>(task: (...args: Args) => void) {
  let controls: UseRafTaskReturn<Args> | undefined
  const Host = defineComponent({
    setup() {
      controls = useRafTask(task)
      return () => h('div')
    },
  })
  wrapper = await mountSuspended(Host)
  if (!controls) throw new Error('useRafTask did not initialize')
  return controls
}

describe('useRafTask', () => {
  it('coalesces same-frame schedules into one run with the latest args', async () => {
    stubRaf()
    const task = vi.fn()
    const { schedule } = await mountTask<[string]>(task)

    schedule('a')
    schedule('b')
    schedule('c')
    expect(task).not.toHaveBeenCalled()

    fireFrame()
    expect(task).toHaveBeenCalledTimes(1)
    expect(task).toHaveBeenCalledWith('c')

    // A later burst schedules a fresh frame — coalescing never sticks.
    schedule('d')
    fireFrame()
    expect(task).toHaveBeenCalledTimes(2)
    expect(task).toHaveBeenLastCalledWith('d')
  })

  it('clears the frame id before the run so the task can re-schedule itself', async () => {
    stubRaf()
    let reentries = 0
    const controls = await mountTask(() => {
      if (reentries === 0) {
        reentries += 1
        controls.schedule()
      }
    })

    controls.schedule()
    fireFrame()
    expect(reentries).toBe(1)
    // The follow-up run is pending in the NEXT frame, not swallowed by the
    // cancel-on-reschedule of its own (already executed) frame.
    expect(frames.size).toBe(1)
    fireFrame()
    expect(frames.size).toBe(0)

    // After execution the frame id is stale — cancel() must be a no-op rather
    // than cancelling a frame it no longer owns.
    cafSpy.mockClear()
    controls.cancel()
    expect(cafSpy).not.toHaveBeenCalled()
  })

  it('cancel() drops the pending run and is idempotent', async () => {
    stubRaf()
    const task = vi.fn()
    const { schedule, cancel } = await mountTask(task)

    schedule()
    cancel()
    cancel()
    expect(cafSpy).toHaveBeenCalledTimes(1)

    fireFrame()
    expect(task).not.toHaveBeenCalled()
  })

  it('cancels the pending run on scope dispose (unmount)', async () => {
    stubRaf()
    const task = vi.fn()
    const { schedule } = await mountTask(task)

    schedule()
    wrapper!.unmount()
    wrapper = undefined

    expect(frames.size).toBe(0)
    fireFrame()
    expect(task).not.toHaveBeenCalled()
  })

  it('runs synchronously when requestAnimationFrame is unavailable', async () => {
    const task = vi.fn()
    const { schedule, cancel } = await mountTask<[number]>(task)

    vi.stubGlobal('requestAnimationFrame', undefined)
    schedule(42)
    expect(task).toHaveBeenCalledTimes(1)
    expect(task).toHaveBeenCalledWith(42)

    // Nothing is pending in this mode; cancel stays a safe no-op.
    cancel()
    expect(task).toHaveBeenCalledTimes(1)
  })
})
