import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { UCollapsible } from '#components'
import { vCollapseFocus } from '../../kits/api-docs/internal/collapseFocus'

let frames: Map<number, FrameRequestCallback>
let sequence: number
let wrapper: VueWrapper | undefined
let host: HTMLElement | undefined

beforeEach(() => {
  frames = new Map()
  sequence = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++sequence
    frames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  host?.remove()
  host = undefined
  vi.unstubAllGlobals()
})

async function flushFrames() {
  let iterations = 0
  while (frames.size) {
    if (++iterations > 100) throw new Error('Animation frames did not settle')
    const [id, callback] = frames.entries().next().value!
    frames.delete(id)
    callback(performance.now())
    // Flush between callbacks: batching all Reka toggles can hide the regression.
    await nextTick()
    await nextTick()
  }
}

async function render(initial: boolean[]) {
  const updates = initial.map(() => [] as boolean[])
  const Fixture = defineComponent({
    setup() {
      const open = ref([...initial])
      const level = (index: number): ReturnType<typeof h> => h(UCollapsible, {
        'data-test': `collapse-${index}`,
        open: open.value[index],
        unmountOnHide: false,
        'onUpdate:open': (value: boolean) => {
          updates[index]!.push(value)
          open.value[index] = value
        },
      }, {
        default: () => h('button', { 'data-test': `trigger-${index}` }, `Toggle ${index}`),
        content: () => withDirectives(h('div', { 'data-test': `region-${index}` }, [
          index + 1 < initial.length ? level(index + 1) : h('span', 'Native find target'),
        ]), [[vCollapseFocus, open.value[index]]]),
      })
      return () => level(0)
    },
  })
  host = document.createElement('div')
  document.body.append(host)
  wrapper = await mountSuspended(Fixture, { attachTo: host })
  await flushFrames()
  const content = (index: number) => wrapper!.get<HTMLElement>(`[data-test="region-${index}"]`).element.parentElement!
  const states = (expected: boolean[]) => expected.forEach((open, index) => {
    expect(wrapper!.get(`[data-test="trigger-${index}"]`).attributes('aria-expanded')).toBe(String(open))
    expect(content(index).getAttribute('data-state')).toBe(open ? 'open' : 'closed')
    expect(content(index).hasAttribute('hidden')).toBe(!open)
  })
  const reveal = (index: number) => {
    const element = content(index)
    expect(element.hasAttribute('hidden')).toBe(true)
    // happy-dom normalizes Vue's hidden IDL assignment to boolean. Supply the
    // browser state/provenance at this unit boundary; this is not native Find.
    element.setAttribute('hidden', 'until-found')
    const event = new Event('beforematch', { bubbles: true })
    Object.defineProperty(event, 'isTrusted', { value: true })
    element.dispatchEvent(event)
  }
  return { updates, content, states, reveal }
}

describe('native discovery through actual Nuxt UI Collapsible', () => {
  it.each([2, 3])('opens %i initially closed layers once for inner-to-outer discovery', async (depth) => {
    const view = await render(Array.from({ length: depth }, () => false))
    view.states(Array.from({ length: depth }, () => false))
    for (let index = depth - 1; index >= 0; index--) view.reveal(index)
    await flushFrames()
    view.states(Array.from({ length: depth }, () => true))
    expect(view.updates).toEqual(Array.from({ length: depth }, () => [true]))
  })

  it('keeps an open parent open when its closed child is found', async () => {
    const view = await render([true, false])
    view.reveal(1)
    await flushFrames()
    view.states([true, true])
    expect(view.updates).toEqual([[], [true]])
  })

  it('can close normally and discover the nested content again', async () => {
    const view = await render([false, false])
    view.reveal(1)
    view.reveal(0)
    await flushFrames()
    view.states([true, true])
    await wrapper!.get('[data-test="trigger-1"]').trigger('click')
    await flushFrames()
    await wrapper!.get('[data-test="trigger-0"]').trigger('click')
    await flushFrames()
    view.states([false, false])
    view.reveal(1)
    view.reveal(0)
    await flushFrames()
    view.states([true, true])
    expect(view.updates).toEqual([[true, false, true], [true, false, true]])
  })
})
