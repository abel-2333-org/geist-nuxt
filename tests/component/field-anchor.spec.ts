import { defineComponent, onMounted, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import { useFieldAnchor } from '../../kits/api-docs/composables/useFieldAnchor'

afterEach(() => {
  history.replaceState(history.state, '', '/')
  delete (history as History & { scrollRestoration?: ScrollRestoration }).scrollRestoration
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useFieldAnchor', () => {
  it('preserves legacy navigate-on-copy while allowing clipboard-only callers', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0))
    const Host = defineComponent({
      setup() {
        const anchor = useFieldAnchor()
        return {
          copyLegacy: () => { void anchor.copyLink('legacy', 'Legacy link copied') },
          copyOnly: () => { void anchor.copyLink('pure', { navigate: false }) },
        }
      },
      template: `
        <button data-testid="copy-only" @click="copyOnly">Copy only</button>
        <button data-testid="copy-legacy" @click="copyLegacy">Copy legacy</button>
      `,
    })
    const wrapper = await mountSuspended(Host)

    await wrapper.find('[data-testid="copy-only"]').trigger('click')
    expect(location.hash).toBe('')

    await wrapper.find('[data-testid="copy-legacy"]').trigger('click')
    expect(location.hash).toBe('#legacy')
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
    expect(JSON.stringify(frames)).not.toMatch(/outline|borderRadius/)
    expect(options).toEqual({ duration: 300, easing: 'ease-out' })
    expect(readScrollHeight.mock.calls.length).toBeGreaterThanOrEqual(12)
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
