import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, withDirectives } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { vCollapseFocus } from '../../kits/api-docs/internal/collapseFocus'

// Exercise Vue's actual directive lifecycle on attached DOM. The fixture owns
// the primitive's hidden state so these tests do not simulate CSS animations.
const Fixture = defineComponent({
  props: {
    open: { type: Boolean, default: true },
    nestedOpen: { type: Boolean, default: true },
    nested: Boolean,
    controlRegion: Boolean,
  },
  setup(props) {
    return () => h('div', [
      h('button', { id: 'outside' }, 'Outside'),
      h('button', { id: 'trigger', 'aria-controls': props.controlRegion ? 'region' : 'content' }, 'Toggle'),
      h('div', { id: 'content', 'data-slot': 'content', 'data-state': props.open ? 'open' : 'closed' }, [
        withDirectives(h('div', { id: 'region', tabindex: -1 }, [
          h('button', { id: 'inside' }, 'Inside'),
          ...(props.nested ? [
            h('div', { id: 'nested-trigger-container', 'data-slot': 'content' }, [
              h('button', { id: 'nested-trigger', 'aria-controls': 'nested-content' }, 'Nested toggle'),
            ]),
            h('div', { id: 'nested-content', 'data-slot': 'content', 'data-state': props.nestedOpen ? 'open' : 'closed' }, [
              withDirectives(h('div', { id: 'nested-region' }, [
                h('button', { id: 'nested-inside' }, 'Nested inside'),
              ]), [[vCollapseFocus, props.nestedOpen]]),
            ]),
          ] : []),
        ]), [[vCollapseFocus, props.open]]),
      ]),
    ])
  },
})

let wrapper: VueWrapper | undefined
let host: HTMLElement | undefined

class ControlledResizeObserver implements ResizeObserver {
  static instances: ControlledResizeObserver[] = []
  observe = vi.fn<(target: Element) => void>()
  unobserve = vi.fn<(target: Element) => void>()
  disconnect = vi.fn()

  constructor(private callback: ResizeObserverCallback) {
    ControlledResizeObserver.instances.push(this)
  }

  deliver() {
    this.callback([], this)
  }
}

beforeEach(() => {
  ControlledResizeObserver.instances = []
  vi.stubGlobal('ResizeObserver', ControlledResizeObserver)
})

function resizeContent(clientHeight: number, regionHeight: number, scrollHeight = regionHeight) {
  const content = element('content')
  Object.defineProperties(content, {
    clientHeight: { configurable: true, get: () => clientHeight },
    scrollHeight: { configurable: true, get: () => scrollHeight },
  })
  Object.defineProperty(element('region'), 'offsetHeight', { configurable: true, get: () => regionHeight })
  const observer = ControlledResizeObserver.instances.find(instance =>
    instance.observe.mock.calls.some(([target]) => target === content))!
  observer.deliver()
  return observer
}

function render(props: Record<string, boolean> = {}) {
  host = document.createElement('div')
  document.body.append(host)
  wrapper = mount(Fixture, { attachTo: host, props })
  return wrapper
}

function element(id: string) {
  return wrapper!.get<HTMLElement>(`#${id}`).element
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  host?.remove()
  host = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('collapse focus lifecycle', () => {
  // Unit-level event provenance stub only. Real Chrome UI Find separately
  // verifies browser-issued isTrusted and first-match highlighting.
  function reveal(content: HTMLElement, trusted = true) {
    const event = new Event('beforematch', { bubbles: true })
    Object.defineProperty(event, 'isTrusted', { value: trusted })
    content.dispatchEvent(event)
  }

  it('keeps one native reveal discoverable, then restores ordinary animation and focus protection', async () => {
    const view = render({ open: false })
    const content = element('content')
    content.setAttribute('hidden', 'until-found')
    reveal(content)
    expect(content.classList.contains('animate-none!')).toBe(true)
    // An unrelated update while Reka's native-open RAF is pending must not
    // clear animation suppression yet leave the reveal permission live.
    await view.setProps({ controlRegion: true })
    expect(content.classList.contains('animate-none!')).toBe(true)
    content.removeAttribute('hidden')
    await view.setProps({ open: true })
    expect(content.hasAttribute('inert')).toBe(false)
    expect(content.classList.contains('animate-none!')).toBe(true)
    element('inside').focus()
    await view.setProps({ open: false })
    expect(document.activeElement).toBe(element('trigger'))
    expect(content.hasAttribute('inert')).toBe(true)
    expect(content.classList.contains('animate-none!')).toBe(false)
    await view.setProps({ open: true })
    expect(content.hasAttribute('inert')).toBe(true)
    resizeContent(100, 100)
    expect(content.hasAttribute('inert')).toBe(false)
  })

  it('ignores synthetic events and child events outside the revealed content identity', async () => {
    const view = render({ open: false })
    const content = element('content')
    content.setAttribute('hidden', 'until-found')
    reveal(content, false)
    reveal(element('inside'))
    expect(content.classList.contains('animate-none!')).toBe(false)
    await view.setProps({ open: true })
    expect(content.hasAttribute('inert')).toBe(true)
  })

  it('discards an unconsumed reveal and clears its listener on unmount', async () => {
    vi.useFakeTimers()
    const view = render({ open: false })
    const content = element('content')
    content.setAttribute('hidden', 'until-found')
    reveal(content)
    await vi.runAllTimersAsync()
    expect(content.classList.contains('animate-none!')).toBe(false)
    reveal(content)
    view.unmount()
    wrapper = undefined
    expect(content.classList.contains('animate-none!')).toBe(false)
    reveal(content)
    expect(content.classList.contains('animate-none!')).toBe(false)
    await vi.runAllTimersAsync()
  })

  it.each([false, true])('restores internal focus using the ARIA relation (region control: %s)', async (controlRegion) => {
    const view = render({ controlRegion })
    element('inside').focus()
    const trigger = element('trigger')
    const focus = vi.spyOn(trigger, 'focus')

    await view.setProps({ open: false })

    expect(document.activeElement).toBe(trigger)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(element('content').hasAttribute('inert')).toBe(true)
    expect(element('content').hasAttribute('hidden')).toBe(false)
  })

  it('does not steal external focus while making exiting content inert', async () => {
    const view = render()
    element('outside').focus()
    await view.setProps({ open: false })

    expect(document.activeElement).toBe(element('outside'))
    expect(element('content').hasAttribute('inert')).toBe(true)
  })

  it('restores focus when the region root itself was focused', async () => {
    const view = render()
    element('region').focus()
    expect(document.activeElement).toBe(element('region'))
    await view.setProps({ open: false })
    expect(document.activeElement).toBe(element('trigger'))
  })

  it('releases inert after hidden without changing hidden-until-found', async () => {
    const view = render()
    await view.setProps({ open: false })
    const content = element('content')
    expect(content.hasAttribute('inert')).toBe(true)

    content.setAttribute('hidden', 'until-found')
    await vi.waitFor(() => expect(content.hasAttribute('inert')).toBe(false))
    expect(content.getAttribute('hidden')).toBe('until-found')
  })

  it('keeps reversed exits inert until expansion is no longer clipped', async () => {
    const view = render()
    await view.setProps({ open: false })
    expect(element('content').hasAttribute('inert')).toBe(true)
    await view.setProps({ open: true })
    resizeContent(0, 0)
    expect(element('content').hasAttribute('inert')).toBe(true)
    resizeContent(0, 100)
    expect(element('content').hasAttribute('inert')).toBe(true)
    resizeContent(50, 100)
    expect(element('content').hasAttribute('inert')).toBe(true)
    resizeContent(100, 100)
    expect(element('content').hasAttribute('inert')).toBe(false)
  })

  it('keeps newly opened hidden content inert until visible and fully expanded', async () => {
    const view = render({ open: false })
    const content = element('content')
    content.setAttribute('hidden', 'until-found')
    await view.setProps({ open: true })
    resizeContent(100, 100)
    expect(content.hasAttribute('inert')).toBe(true)
    expect(content.getAttribute('hidden')).toBe('until-found')

    resizeContent(0, 100)
    content.removeAttribute('hidden')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(content.hasAttribute('inert')).toBe(true)
    resizeContent(120, 100)
    expect(content.hasAttribute('inert')).toBe(false)
  })

  it('releases fully expanded content despite decorative scroll overflow', async () => {
    const view = render({ open: false })
    await view.setProps({ open: true })
    resizeContent(200, 274, 278)
    expect(element('content').hasAttribute('inert')).toBe(true)

    resizeContent(274, 274, 278)
    expect(element('content').scrollHeight).toBeGreaterThan(element('region').offsetHeight)
    expect(element('content').hasAttribute('inert')).toBe(false)
  })

  it('does not let a stale expansion resize release content that is closing again', async () => {
    const view = render()
    await view.setProps({ open: false })
    await view.setProps({ open: true })
    resizeContent(50, 100)
    await view.setProps({ open: false })
    resizeContent(100, 100)
    const content = element('content')
    expect(content.hasAttribute('inert')).toBe(true)

    content.setAttribute('hidden', 'until-found')
    await vi.waitFor(() => expect(content.hasAttribute('inert')).toBe(false))
    expect(content.getAttribute('hidden')).toBe('until-found')
  })

  it('releases inert immediately when opening is cancelled before hidden is removed', async () => {
    const view = render({ open: false })
    const content = element('content')
    content.setAttribute('hidden', 'until-found')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(content.hasAttribute('inert')).toBe(false)

    await view.setProps({ open: true })
    expect(content.hasAttribute('inert')).toBe(true)
    expect(content.getAttribute('hidden')).toBe('until-found')

    await view.setProps({ open: false })
    expect(content.hasAttribute('inert')).toBe(false)
    expect(content.getAttribute('hidden')).toBe('until-found')
  })

  it('does not restore stale focus after a rapid reopen', async () => {
    vi.useFakeTimers()
    const view = render()
    element('inside').focus()
    await view.setProps({ open: false })
    expect(document.activeElement).toBe(element('trigger'))
    await view.setProps({ open: true })
    resizeContent(100, 100)
    element('inside').focus()
    await vi.runAllTimersAsync()
    await nextTick()
    expect(document.activeElement).toBe(element('inside'))
    expect(element('content').hasAttribute('inert')).toBe(false)
  })

  it('restores to the outer trigger when nested regions close together', async () => {
    const view = render({ nested: true })
    element('nested-inside').focus()
    const nestedFocus = vi.spyOn(element('nested-trigger'), 'focus')

    await view.setProps({ open: false, nestedOpen: false })

    expect(document.activeElement).toBe(element('trigger'))
    expect(nestedFocus).not.toHaveBeenCalled()
  })

  it.each(['hidden', 'inert', 'closed'])('does not restore to a trigger inside a %s ancestor', async (state) => {
    const view = render({ nested: true })
    element('nested-inside').focus()
    const nestedFocus = vi.spyOn(element('nested-trigger'), 'focus')
    const content = element('nested-trigger-container')
    if (state === 'closed') content.setAttribute('data-state', 'closed')
    else content.setAttribute(state, state === 'hidden' ? 'until-found' : '')

    await view.setProps({ nestedOpen: false })

    expect(nestedFocus).not.toHaveBeenCalled()
  })

  it.each([false, true])('disconnects both observers on unmount (opening: %s)', async (opening) => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const view = render()
    await view.setProps({ open: false })
    if (opening) await view.setProps({ open: true })
    const size = resizeContent(50, 100)
    const content = element('content')
    view.unmount()
    wrapper = undefined
    expect(disconnect).toHaveBeenCalled()
    expect(size.disconnect).toHaveBeenCalledOnce()

    // A detached node must not retain an observer that keeps mutating it.
    Object.defineProperty(content, 'clientHeight', { configurable: true, get: () => 100 })
    size.deliver()
    expect(content.hasAttribute('inert')).toBe(true)
    content.setAttribute('hidden', 'until-found')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(content.hasAttribute('inert')).toBe(true)
  })
})
