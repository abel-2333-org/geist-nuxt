import { defineComponent, onMounted, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import { useFieldAnchor } from '../../kits/api-docs/composables/useFieldAnchor'

// Cases that need to observe restoration redefine `history.scrollRestoration`
// as a configurable own property. Restore the original descriptor afterwards
// instead of deleting the key: deleting it removes the native property, so a
// later case that does NOT redefine it would read `undefined` and silently skip
// the `'scrollRestoration' in history` branch it means to exercise.
const nativeScrollRestoration = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(history),
  'scrollRestoration',
)

afterEach(() => {
  history.replaceState(history.state, '', '/')
  if (Object.getOwnPropertyDescriptor(history, 'scrollRestoration')) {
    delete (history as History & { scrollRestoration?: ScrollRestoration }).scrollRestoration
  }
  if (nativeScrollRestoration && !('scrollRestoration' in history)) {
    Object.defineProperty(Object.getPrototypeOf(history), 'scrollRestoration', nativeScrollRestoration)
  }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useFieldAnchor', () => {
  it('never navigates when copying a field link', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0))
    const Host = defineComponent({
      setup() {
        const anchor = useFieldAnchor()
        return {
          active: anchor.active,
          copyOptions: () => { void anchor.copyLink('pure', { successMessage: 'Copied' }) },
        }
      },
      template: `
        <button data-testid="copy-options" @click="copyOptions">Copy options</button>
      `,
    })
    const wrapper = await mountSuspended(Host)

    // Copy is clipboard-only: no hash write and no active-row change, so the
    // reader is never yanked away.
    await wrapper.find('[data-testid="copy-options"]').trigger('click')
    expect(location.hash).toBe('')
    expect(wrapper.vm.active).toBe('')
    wrapper.unmount()
  })

  it('restores native scroll restoration when its component scope is disposed', async () => {
    Object.defineProperty(history, 'scrollRestoration', {
      configurable: true,
      writable: true,
      value: 'auto',
    })
    history.replaceState(history.state, '', '/#amount')
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0))

    const Host = defineComponent({
      setup() {
        const anchor = useFieldAnchor()
        onMounted(() => anchor.initFromHash())
      },
      template: '<div id="amount">Amount</div>',
    })
    const wrapper = await mountSuspended(Host, { attachTo: document.body })

    expect(history.scrollRestoration).toBe('manual')
    wrapper.unmount()
    expect(history.scrollRestoration).toBe('auto')
  })

  it('restores native scroll restoration when the hash target never mounts', async () => {
    Object.defineProperty(history, 'scrollRestoration', {
      configurable: true,
      writable: true,
      value: 'auto',
    })
    history.replaceState(history.state, '', '/#missing')
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => {
      now += 1001
      return now
    })
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }))

    const Host = defineComponent({
      setup() {
        const anchor = useFieldAnchor()
        onMounted(() => anchor.initFromHash())
      },
      template: '<div>No matching field</div>',
    })
    const wrapper = await mountSuspended(Host, { attachTo: document.body })

    await vi.waitFor(() => expect(history.scrollRestoration).toBe('auto'))
    wrapper.unmount()
  })

  it('rejects an empty path instead of throwing on an invalid selector', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0))
    let goTo!: ReturnType<typeof useFieldAnchor>['goTo']
    const Host = defineComponent({
      setup() {
        const anchor = useFieldAnchor()
        goTo = anchor.goTo
        return { active: anchor.active }
      },
      template: '<div id="amount">Amount</div>',
    })
    const wrapper = await mountSuspended(Host, { attachTo: document.body })

    // `goTo` is public API, so a consumer outside this repo can pass an empty
    // path. It must be a no-op rather than a crash: `'#' + CSS.escape('')` is
    // `'#'`, an invalid selector that makes querySelectorAll throw a
    // SyntaxError (verified in a real browser).
    // Snapshot before/after rather than comparing against '': the contract is
    // "goTo changed nothing". Pinning absolute values would instead depend on
    // leftovers from earlier cases — `active` is a Nuxt `useState`, so it is
    // shared across this file, and an earlier `#missing` case leaves it set.
    const hashBefore = location.hash
    const activeBefore = wrapper.vm.active
    await expect(goTo('')).resolves.toBeUndefined()
    expect(wrapper.vm.active).toBe(activeBefore)
    expect(location.hash).toBe(hashBefore)
    wrapper.unmount()
  })

  it('keeps manual restoration when a hash navigation is superseded', async () => {
    Object.defineProperty(history, 'scrollRestoration', {
      configurable: true,
      writable: true,
      value: 'auto',
    })
    history.replaceState(history.state, '', '/#missing')
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))

    let goTo!: ReturnType<typeof useFieldAnchor>['goTo']
    const Host = defineComponent({
      setup() {
        const anchor = useFieldAnchor()
        goTo = anchor.goTo
        onMounted(() => anchor.initFromHash())
      },
      template: '<div id="amount">Amount</div>',
    })
    const wrapper = await mountSuspended(Host, { attachTo: document.body })
    const target = wrapper.find('#amount').element as HTMLElement
    target.getBoundingClientRect = vi.fn(() => ({
      bottom: 120,
      height: 20,
      left: 0,
      right: 100,
      top: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    }))
    target.scrollIntoView = vi.fn()

    expect(history.scrollRestoration).toBe('manual')
    const direct = goTo('amount', { updateHash: false })
    await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0))

    // Resolve the stale hash poll after the direct navigation owns the token.
    // That is an abort, not proof that the hash target is missing.
    frames.shift()!(0)
    await Promise.resolve()
    expect(history.scrollRestoration).toBe('manual')

    while (frames.length) {
      frames.shift()!(0)
      await Promise.resolve()
    }
    await direct
    expect(history.scrollRestoration).toBe('manual')

    wrapper.unmount()
    expect(history.scrollRestoration).toBe('auto')
  })

  it('cancels the previous cue and never animates the focus outline', async () => {
    const heights = [100, 100, 200, 200, 200, 200, 200, 200]
    const readScrollHeight = vi
      .spyOn(document.documentElement, 'scrollHeight', 'get')
      .mockImplementation(() => heights.shift() ?? 200)
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }))
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))

    let goTo!: ReturnType<typeof useFieldAnchor>['goTo']
    const Host = defineComponent({
      setup() {
        goTo = useFieldAnchor().goTo
      },
      template: '<div id="amount">Amount</div>',
    })
    const wrapper = await mountSuspended(Host, { attachTo: document.body })
    const target = wrapper.find('#amount').element as HTMLElement
    target.getBoundingClientRect = vi.fn(() => ({
      bottom: 120,
      height: 20,
      left: 0,
      right: 100,
      top: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    }))
    target.scrollIntoView = vi.fn()

    const first = fakeAnimation()
    const second = fakeAnimation()
    const animate = vi.fn()
      .mockReturnValueOnce(first.animation)
      .mockReturnValueOnce(second.animation)
    Object.defineProperty(target, 'animate', { configurable: true, value: animate })

    await goTo('amount', { updateHash: false })
    await goTo('amount', { updateHash: false })

    expect(first.cancel).toHaveBeenCalledOnce()
    expect(animate).toHaveBeenCalledTimes(2)
    const [frames, options] = animate.mock.calls[0]!
    // Outline belongs to the persistent focus ring, so the cue must never
    // animate it (a cue passing through transparent would blink a keyboard
    // user's focus indicator out).
    expect(JSON.stringify(frames)).not.toMatch(/outline|borderRadius/)
    // It breathes: the cue alternates off → on → … → off within one pass rather
    // than ending lit, so both ends must rest transparent.
    expect(frames.length).toBeGreaterThan(2)
    expect(JSON.stringify(frames[0])).toMatch(/transparent/)
    expect(JSON.stringify(frames.at(-1))).toMatch(/transparent/)
    // Discriminate on boxShadow, not the whole frame: a lit frame's background
    // is a `color-mix(… , transparent)`, so matching "transparent" anywhere
    // would count every frame as unlit.
    const peaks = frames
      .filter((frame: Keyframe) => !/transparent/.test(String(frame.boxShadow)))
      .map((frame: Keyframe) => frame.offset as number)
    expect(peaks).toHaveLength(3)
    // Each of the three peaks sits at its breath's midpoint, keeping every rise
    // and fall symmetric while still catching an off-centre peak.
    peaks.forEach((offset, i) => {
      expect(offset).toBeCloseTo((i + 0.5) / peaks.length, 5)
    })
    expect(options).toMatchObject({ duration: 4200, easing: 'ease-in-out' })
    // The height changes from 100 → 200, then the algorithm observes five
    // identical 200 samples: one baseline plus four consecutive stable frames.
    const observedHeights = readScrollHeight.mock.results.map(result => result.value)
    expect(observedHeights).toContain(100)
    expect(observedHeights.slice(-5)).toEqual([200, 200, 200, 200, 200])
    // Instant — no `behavior` is requested, so smooth is never opted into. The
    // re-settle pass is asserted in the deep-link test below.
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    second.finish()
    wrapper.unmount()
  })

  it('does not let an old route scope cancel the new route owner', async () => {
    Object.defineProperty(history, 'scrollRestoration', {
      configurable: true,
      writable: true,
      value: 'auto',
    })
    history.replaceState(history.state, '', '/#amount')
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }))
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))

    const first = fakeAnimation()
    const second = fakeAnimation()
    const firstAnimate = vi.fn(() => first.animation)
    const secondAnimate = vi.fn(() => second.animation)
    const scrollMocks: ReturnType<typeof vi.fn>[] = []
    const makeHost = (animate: () => Animation) => defineComponent({
      setup() {
        const target = shallowRef<HTMLElement>()
        const anchor = useFieldAnchor()
        onMounted(() => {
          const el = target.value!
          el.getBoundingClientRect = vi.fn(() => ({
            bottom: 120,
            height: 20,
            left: 0,
            right: 100,
            top: 100,
            width: 100,
            x: 0,
            y: 100,
            toJSON: () => ({}),
          }))
          el.scrollIntoView = vi.fn()
          scrollMocks.push(el.scrollIntoView as ReturnType<typeof vi.fn>)
          Object.defineProperty(el, 'animate', { configurable: true, value: animate })
          anchor.initFromHash()
        })
        return { target }
      },
      template: '<div id="amount" ref="target">Amount</div>',
    })

    const oldRoute = await mountSuspended(makeHost(firstAnimate), { attachTo: document.body })
    const newRoute = await mountSuspended(makeHost(secondAnimate), { attachTo: document.body })
    await vi.waitFor(() => expect(secondAnimate).toHaveBeenCalledOnce())
    expect(firstAnimate).toHaveBeenCalledOnce()
    expect(first.cancel).toHaveBeenCalledOnce()
    expect(history.scrollRestoration).toBe('manual')
    // A hash arrival lands instantly and then re-settles on the next frame:
    // animating it would drift the page down from the top, the very symptom the
    // manual restoration claim prevents.
    expect(scrollMocks[0]).toHaveBeenCalledWith({ block: 'start' })
    await vi.waitFor(() => expect(scrollMocks[0]).toHaveBeenCalledTimes(2))

    oldRoute.unmount()
    expect(second.cancel).not.toHaveBeenCalled()
    expect(history.scrollRestoration).toBe('manual')

    newRoute.unmount()
    expect(second.cancel).toHaveBeenCalledOnce()
    expect(history.scrollRestoration).toBe('auto')
  })
})

describe('FieldItem field anchor', () => {
  it('keeps focus visible, wraps long names, and copies without navigation', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'an_uninterrupted_field_name_that_must_wrap_on_mobile',
        path: 'body_long_name',
        type: 'string',
      },
    })

    const row = wrapper.find('#body_long_name')
    expect(row.classes()).toContain('outline-hidden')
    expect(row.classes()).toContain('focus-visible:outline-solid')
    expect(row.classes()).toContain('focus-visible:outline-primary')
    expect(row.classes()).not.toContain('outline-none')
    expect(row.find('code').classes()).toContain('wrap-anywhere')

    await row.find('button').trigger('click')
    expect(location.hash).toBe('')
  })
})

function fakeAnimation() {
  const listeners = new Map<string, EventListener>()
  const cancel = vi.fn(() => listeners.get('cancel')?.(new Event('cancel')))
  const finish = vi.fn(() => listeners.get('finish')?.(new Event('finish')))
  const animation = {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener)
    }),
    cancel,
  } as unknown as Animation
  return { animation, cancel, finish }
}
