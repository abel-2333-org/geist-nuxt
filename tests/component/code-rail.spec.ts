// CodeRail structural behavior — the content-priority reallocation the kit
// deliberately keeps OUT of the generic SplitPane. Covers the overflow budget
// split (short pane capped to natural height, slack donated to the other),
// the effective (post-reallocation) separator aria values, the natural-fit and
// stacked fallbacks, and re-attaching resize observation when a code card
// recreates its <pre> (empty panel ↔ real code surface).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CodeRail from '../../kits/api-docs/components/CodeRail.vue'
import SplitPaneHandle from '../../foundation/components/SplitPaneHandle.vue'

let observers: TestResizeObserver[] = []
let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0

class TestResizeObserver {
  readonly targets = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this)
  }

  observe(target: Element) {
    this.targets.add(target)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

let wrapper: VueWrapper | undefined

function stubViewport(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
}

beforeEach(() => {
  observers = []
  frames = new Map()
  nextFrame = 0
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
    frames.delete(id)
  }))
  stubViewport(true)
  // The test DOM lays out nothing: every element reports the height it
  // declares via `data-h`, so chrome/natural-height math runs on
  // deterministic numbers.
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return Number(this.dataset?.h ?? 0)
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { height: Number(this.dataset?.h ?? 0) } as DOMRect
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function runFrames() {
  const pending = [...frames.values()]
  frames.clear()
  for (const frame of pending) frame(0)
}

async function runMutationFrames() {
  await vi.waitFor(() => {
    expect(frames.size).toBeGreaterThan(0)
  })
  runFrames()
  await nextTick()
}

/** Mimics a kit code card: section chrome + capped scroll surface + full-height pre. */
function card(section: number, surface: number, pre: number, label: string) {
  return h('section', { 'data-h': String(section) }, [
    h('div', { 'class': 'code-surface', 'data-h': String(surface) }, [
      h('pre', { 'class': 'raw-pre', 'data-h': String(pre), 'data-pre': label }),
    ]),
  ])
}

/** Rail element + its ResizeObserver, resolved from the mounted wrapper.
 * mountSuspended clones the component definition, so type-based findComponent
 * misses direct mounts — walk up from the top card instead: pre → section →
 * pane wrapper → rail. */
function railParts(mounted: VueWrapper) {
  const topSection = mounted.get('[data-pre="top"]').element.closest('section')
  const rail = topSection?.parentElement?.parentElement as HTMLElement | null
  if (!rail) throw new Error('CodeRail rail element not found')
  const ro = observers.find(observer => observer.targets.has(rail))
  if (!ro) throw new Error('CodeRail did not observe its rail element')
  return { rail, ro }
}

async function resizeRail(mounted: VueWrapper, height: number) {
  const { rail, ro } = railParts(mounted)
  rail.dataset.h = String(height)
  ro.trigger()
  runFrames()
  await nextTick()
}

describe('CodeRail', () => {
  it('caps a short pane to natural height, donates slack, and reports effective aria bounds', async () => {
    wrapper = await mountSuspended(CodeRail, {
      props: { storageKey: 'code-rail-overflow' },
      slots: {
        // natTop = 320 - 300 + 480 = 500, chrome 20
        top: ({ maxHeight }: { maxHeight: string }) => [
          card(320, 300, 480, 'top'),
          h('output', { 'data-budget': 'top' }, maxHeight),
        ],
        // natBottom = 320 - 300 + 130 = 150, chrome 20
        bottom: ({ maxHeight }: { maxHeight: string }) => [
          card(320, 300, 130, 'bottom'),
          h('output', { 'data-budget': 'bottom' }, maxHeight),
        ],
      },
    })
    await nextTick()
    // H = 412 - 12 (handle) = 400 < 500 + 150 → overflow. Ratio 0.5 asks for
    // 200/200; the short bottom is capped to 150 and the slack goes up.
    await resizeRail(wrapper, 412)

    const { rail } = railParts(wrapper)
    const topPane = rail.children[0] as HTMLElement
    const bottomPane = rail.children[rail.children.length - 1] as HTMLElement
    expect(topPane.style.height).toBe('250px')
    expect(bottomPane.style.height).toBe('150px')
    expect(wrapper.get('[data-budget="top"]').text()).toBe('230px')
    expect(wrapper.get('[data-budget="bottom"]').text()).toBe('130px')

    // Aria reflects the EFFECTIVE separator (250/400 = 63%), not the stored
    // 50% ratio, and the reachable bounds account for natural-height capping
    // (Home can't shrink the top below the capped bottom's leftovers).
    const separator = wrapper.get('[role="separator"]')
    expect(separator.attributes('aria-valuenow')).toBe('63')
    expect(separator.attributes('aria-valuemin')).toBe('63')
    expect(separator.attributes('aria-valuemax')).toBe('70')
  })

  it('renders natural heights with an inert handle when both panes fit', async () => {
    wrapper = await mountSuspended(CodeRail, {
      props: { storageKey: 'code-rail-fit' },
      slots: {
        // natTop = 200, natBottom = 150 → 350 ≤ 400 → fit.
        top: ({ maxHeight }: { maxHeight: string }) => [
          card(220, 200, 180, 'top'),
          h('output', { 'data-budget': 'top' }, maxHeight),
        ],
        bottom: () => card(170, 150, 130, 'bottom'),
      },
    })
    await nextTick()
    await resizeRail(wrapper, 412)

    const { rail } = railParts(wrapper)
    expect((rail.children[0] as HTMLElement).style.height).toBe('')
    expect(wrapper.get('[data-budget="top"]').text()).toBe('none')
    // The handle stays as a disabled spacer: rendered, but no separator role.
    expect(wrapper.findComponent(SplitPaneHandle).exists()).toBe(true)
    expect(wrapper.find('[role="separator"]').exists()).toBe(false)
  })

  it('stacks below the breakpoint gate: no handle, self-scrolling cards', async () => {
    stubViewport(false)
    wrapper = await mountSuspended(CodeRail, {
      props: { storageKey: 'code-rail-stacked' },
      slots: {
        top: ({ maxHeight }: { maxHeight: string }) => [
          card(320, 300, 480, 'top'),
          h('output', { 'data-budget': 'top' }, maxHeight),
        ],
        bottom: () => card(170, 150, 130, 'bottom'),
      },
    })
    await nextTick()

    expect(wrapper.findComponent(SplitPaneHandle).exists()).toBe(false)
    expect(wrapper.get('[data-budget="top"]').text()).toBe('24rem')
  })

  it('remeasures and observes a recreated pre without a resize notification', async () => {
    const Host = defineComponent({
      props: { bottomHasCode: { type: Boolean, default: false } },
      setup(props) {
        return () => h(CodeRail, { storageKey: 'code-rail-reobserve' }, {
          top: () => card(320, 300, 480, 'top'),
          bottom: () => props.bottomHasCode
            ? card(170, 150, 130, 'bottom')
            : h('section', { 'data-h': '48' }, 'No response body'),
        })
      },
    })
    wrapper = await mountSuspended(Host)
    await nextTick()
    await resizeRail(wrapper, 412)

    const { ro } = railParts(wrapper)
    expect(ro.targets.has(wrapper.get('[data-pre="top"]').element)).toBe(true)
    expect(wrapper.find('[data-pre="bottom"]').exists()).toBe(false)

    const { rail } = railParts(wrapper)
    const bottomPane = rail.children[rail.children.length - 1] as HTMLElement
    expect(bottomPane.style.height).toBe('120px')

    // Overflow pins the wrapper, so no ResizeObserver notification is
    // guaranteed. The real DOM mutation must schedule the measurement itself.
    await wrapper.setProps({ bottomHasCode: true })
    await runMutationFrames()
    const { ro: after } = railParts(wrapper)

    expect(after.targets.has(wrapper.get('[data-pre="bottom"]').element)).toBe(true)
    expect(bottomPane.style.height).toBe('150px')
    expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('63')
  })

  it('uses a semantic body section instead of the pinned wrapper as its natural height', async () => {
    const Host = defineComponent({
      props: { bottomHasCode: { type: Boolean, default: true } },
      setup(props) {
        return () => h(CodeRail, { storageKey: 'code-rail-empty-natural' }, {
          top: () => card(320, 300, 480, 'top'),
          bottom: () => props.bottomHasCode
            ? card(170, 150, 130, 'bottom')
            : h('section', { 'data-h': '48' }, 'No response body'),
        })
      },
    })
    wrapper = await mountSuspended(Host)
    await nextTick()
    await resizeRail(wrapper, 412)

    const { rail } = railParts(wrapper)
    const bottomPane = rail.children[rail.children.length - 1] as HTMLElement
    expect(bottomPane.style.height).toBe('150px')

    // Model the browser's pinned wrapper box: after the code surface leaves,
    // its 150px budget is stale while the semantic section is naturally 48px.
    bottomPane.dataset.h = '150'
    await wrapper.setProps({ bottomHasCode: false })
    await runMutationFrames()

    expect(bottomPane.style.height).toBe('120px')
    expect(wrapper.find('[role="separator"]').exists()).toBe(false)
  })

  it('remeasures when one semantic body panel replaces another without creating a pre', async () => {
    const Host = defineComponent({
      props: { detailed: { type: Boolean, default: false } },
      setup(props) {
        return () => h(CodeRail, { storageKey: 'code-rail-semantic-swap' }, {
          top: () => card(320, 300, 480, 'top'),
          bottom: () => h('section', { 'data-h': props.detailed ? '150' : '48' }, [
            props.detailed
              ? h('article', { key: 'file' }, 'File response metadata')
              : h('p', { key: 'empty' }, 'No response body'),
          ]),
        })
      },
    })
    wrapper = await mountSuspended(Host)
    await nextTick()
    await resizeRail(wrapper, 412)

    const { rail, ro } = railParts(wrapper)
    const bottomPane = rail.children[rail.children.length - 1] as HTMLElement
    expect(bottomPane.style.height).toBe('120px')
    expect(wrapper.find('[data-pre="bottom"]').exists()).toBe(false)

    await wrapper.setProps({ detailed: true })
    await runMutationFrames()

    expect(bottomPane.style.height).toBe('150px')
    expect(wrapper.find('[data-pre="bottom"]').exists()).toBe(false)
    expect(ro.targets.has(bottomPane.querySelector('section')!)).toBe(true)
  })
})
