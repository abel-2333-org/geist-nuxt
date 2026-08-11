import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useSplitPane } from '../../foundation/composables/useSplitPane'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

function pointer(type: string, pointerId: number, clientX: number): PointerEvent {
  let event: Event
  try {
    event = new PointerEvent(type, { pointerId, clientX, bubbles: true, cancelable: true })
  }
  catch {
    event = new Event(type, { bubbles: true, cancelable: true })
  }
  for (const [key, value] of Object.entries({ pointerId, clientX })) {
    if ((event as unknown as Record<string, unknown>)[key] !== value) {
      Object.defineProperty(event, key, { value })
    }
  }
  return event as PointerEvent
}

describe('useSplitPane pointer ownership', () => {
  it('keeps one pointer in control until its drag ends', async () => {
    let frame: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frame = callback
      return 1
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    let pane: ReturnType<typeof useSplitPane> | undefined
    const Host = defineComponent({
      setup() {
        pane = useSplitPane({ key: 'test-pointer-owner', default: 100 })
        return () => h('div')
      },
    })
    wrapper = await mountSuspended(Host)
    if (!pane) throw new Error('useSplitPane did not initialize')

    const first = pointer('pointerdown', 1, 100)
    pane.startDrag(first, { axis: 'x' })
    pane.startDrag(pointer('pointerdown', 2, 200), { axis: 'x' })

    window.dispatchEvent(pointer('pointermove', 2, 260))
    window.dispatchEvent(pointer('pointerup', 2, 260))
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(pane.dragging.value).toBe(true)
    expect(pane.value.value).toBe(100)

    window.dispatchEvent(pointer('pointermove', 1, 124))
    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    frame?.(0)
    expect(pane.value.value).toBe(124)

    window.dispatchEvent(pointer('pointerup', 1, 124))
    expect(pane.dragging.value).toBe(false)
    expect(document.body.style.userSelect).toBe('')
  })
})
