// <AnnotationPopover> — foundation interaction shell of the Annotation family.
// Covers issue #30 acceptance: real button trigger, click skeleton +
// mouse-only hover enhancement, OpenSource focus policy (keyboard entry,
// hover/pointer focus-neutral, conditional restore), forward-Tab takeover,
// disabled timer hygiene, loading / error / retry chrome, and label overrides.
//
// The popover panel is portaled to document.body, so panel assertions query
// the document instead of the wrapper. Hover timers run on fake timers;
// pointer events are hand-built because happy-dom's `trigger()` carries no
// `pointerType`.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import AnnotationPopover from '../../foundation/components/AnnotationPopover.vue'

const OPEN_DELAY = 150
const CLOSE_DELAY = 250

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  document.body.innerHTML = ''
})

type MountOptions = {
  props?: Record<string, unknown>
  /** Rendered inside #content. */
  content?: string
  /** Adds an #actions slot with a single focusable button when true. */
  actions?: boolean
}

async function mount(options: MountOptions = {}) {
  const slots: Record<string, unknown> = {
    default: () => 'token',
    content: () => h('p', { 'data-test': 'content' }, options.content ?? 'Definition body.'),
  }
  if (options.actions) {
    slots.actions = ({ close }: { close: () => void }) =>
      h('button', { 'data-test': 'action', type: 'button', onClick: () => close() }, 'Go')
  }
  // attachTo is required: a detached tree cannot receive focus in happy-dom,
  // and the focus-restore behaviors under test depend on document focus.
  wrapper = await mountSuspended(AnnotationPopover, {
    props: { label: 'Term', ...options.props },
    slots,
    attachTo: document.body,
  })
  return wrapper
}

/** The portaled panel root (tabindex="-1" wrapper with the width classes). */
function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('div[tabindex="-1"][class*="w-72"]')
}

function trigger(w: VueWrapper) {
  return w.get('button[type="button"]')
}

function pointerEvent(type: string, pointerType = 'mouse') {
  let event: Event
  try {
    event = new PointerEvent(type, { bubbles: false, cancelable: true })
  }
  catch {
    event = new Event(type, { cancelable: true })
  }
  if ((event as PointerEvent).pointerType !== pointerType) {
    Object.defineProperty(event, 'pointerType', { value: pointerType })
  }
  return event
}

async function openByClick(w: VueWrapper) {
  await trigger(w).trigger('click')
  await nextTick()
  await vi.waitFor(() => {
    if (!panel()) throw new Error('panel did not open')
  })
}

async function openByKeyboard(w: VueWrapper) {
  const el = trigger(w).element as HTMLButtonElement
  el.focus()
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await openByClick(w)
  // onOpenAutoFocus defers to nextTick before moving focus.
  await nextTick()
}

/** Hover-opens the panel under fake timers (which stay active afterwards). */
async function openByHover(w: VueWrapper) {
  vi.useFakeTimers()
  trigger(w).element.dispatchEvent(pointerEvent('pointerenter'))
  vi.advanceTimersByTime(OPEN_DELAY)
  await nextTick()
  await nextTick()
  expect(panel()).not.toBeNull()
}

describe('AnnotationPopover trigger & click skeleton', () => {
  it('renders a real button trigger with dashed-underline affordance, panel closed', async () => {
    const w = await mount()
    const btn = trigger(w)
    expect(btn.element.tagName).toBe('BUTTON')
    expect(btn.attributes('type')).toBe('button')
    expect(btn.text()).toBe('token')
    expect(btn.classes()).toContain('decoration-dashed')
    expect(panel()).toBeNull()
  })

  it('click toggles the panel and emits `open` on every open', async () => {
    const w = await mount()
    await openByClick(w)
    expect(panel()!.textContent).toContain('Definition body.')
    expect(w.emitted('open')).toHaveLength(1)

    await trigger(w).trigger('click')
    await vi.waitFor(() => {
      if (panel()) throw new Error('panel did not close')
    })

    await openByClick(w)
    expect(w.emitted('open')).toHaveLength(2)
  })

  it('renders the eyebrow label in the panel', async () => {
    const w = await mount({ props: { label: 'Concept' } })
    await openByClick(w)
    expect(panel()!.textContent).toContain('Concept')
  })
})

describe('AnnotationPopover keyboard journey', () => {
  it('keyboard open moves focus to the first panel action', async () => {
    const w = await mount({ actions: true })
    await openByKeyboard(w)
    const action = panel()!.querySelector<HTMLElement>('[data-test="action"]')
    expect(action).not.toBeNull()
    expect(document.activeElement).toBe(action)
  })

  it('keyboard open without actions focuses the panel itself', async () => {
    const w = await mount()
    await openByKeyboard(w)
    expect(document.activeElement).toBe(panel())
  })

  it('Escape closes a keyboard session and restores focus to the trigger', async () => {
    const w = await mount({ actions: true })
    await openByKeyboard(w)

    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await vi.waitFor(() => {
      if (panel()) throw new Error('panel did not close')
    })
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(trigger(w).element)
  })

  it('pointer session close does not steal focus from an outside element', async () => {
    const w = await mount()
    const outside = document.createElement('input')
    document.body.appendChild(outside)

    trigger(w).element.dispatchEvent(pointerEvent('pointerdown'))
    await openByClick(w)

    outside.focus()
    await trigger(w).trigger('click')
    await vi.waitFor(() => {
      if (panel()) throw new Error('panel did not close')
    })
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(outside)
  })
})

describe('AnnotationPopover hover enhancement (mouse only)', () => {
  it('opens after the hover delay without stealing focus', async () => {
    const w = await mount()
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    outside.focus()

    await openByHover(w)
    expect(document.activeElement).toBe(outside)
    expect(w.emitted('open')).toHaveLength(1)
  })

  it('does not open before the delay elapses', async () => {
    const w = await mount()
    vi.useFakeTimers()
    trigger(w).element.dispatchEvent(pointerEvent('pointerenter'))
    vi.advanceTimersByTime(OPEN_DELAY - 1)
    await nextTick()
    expect(panel()).toBeNull()
  })

  it('pointerleave closes after the close delay; entering the panel cancels it', async () => {
    const w = await mount()
    await openByHover(w)

    // Enter the panel before the close delay elapses → close is cancelled.
    trigger(w).element.dispatchEvent(pointerEvent('pointerleave'))
    vi.advanceTimersByTime(CLOSE_DELAY - 50)
    panel()!.dispatchEvent(pointerEvent('pointerenter'))
    vi.advanceTimersByTime(CLOSE_DELAY)
    await nextTick()
    expect(panel()).not.toBeNull()

    // Leaving the panel schedules the close again. DOM removal may need reka
    // teardown steps beyond a tick, so settle on real timers.
    panel()!.dispatchEvent(pointerEvent('pointerleave'))
    vi.advanceTimersByTime(CLOSE_DELAY)
    await nextTick()
    vi.useRealTimers()
    await vi.waitFor(() => {
      if (panel()) throw new Error('panel did not close')
    })
  })

  it('ignores non-mouse pointers', async () => {
    const w = await mount()
    vi.useFakeTimers()
    trigger(w).element.dispatchEvent(pointerEvent('pointerenter', 'touch'))
    vi.advanceTimersByTime(OPEN_DELAY * 2)
    await nextTick()
    expect(panel()).toBeNull()
  })

  it('mouse sweep does not reclassify a click-owned session as hover', async () => {
    const w = await mount()
    trigger(w).element.dispatchEvent(pointerEvent('pointerdown'))
    await openByClick(w)

    vi.useFakeTimers()
    trigger(w).element.dispatchEvent(pointerEvent('pointerenter'))
    trigger(w).element.dispatchEvent(pointerEvent('pointerleave'))
    vi.advanceTimersByTime(CLOSE_DELAY * 2)
    await nextTick()
    // The click session survives the hover graze.
    expect(panel()).not.toBeNull()
  })
})

describe('AnnotationPopover hover → keyboard takeover', () => {
  it('forward Tab from the focused trigger enters the open panel', async () => {
    const w = await mount({ actions: true })
    await openByHover(w)
    const btn = trigger(w).element as HTMLButtonElement
    btn.focus()

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    btn.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(panel()!.querySelector('[data-test="action"]'))

    // The session is keyboard-owned now: pointerleave must not dismiss it.
    trigger(w).element.dispatchEvent(pointerEvent('pointerleave'))
    vi.advanceTimersByTime(CLOSE_DELAY * 2)
    await nextTick()
    expect(panel()).not.toBeNull()
  })

  it('Shift+Tab keeps its natural backward behavior', async () => {
    const w = await mount({ actions: true })
    await openByHover(w)
    const btn = trigger(w).element as HTMLButtonElement
    btn.focus()

    const shiftTab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    btn.dispatchEvent(shiftTab)
    expect(shiftTab.defaultPrevented).toBe(false)
  })
})

describe('AnnotationPopover disabled', () => {
  it('renders a disabled trigger', async () => {
    const w = await mount({ props: { disabled: true } })
    expect(trigger(w).attributes('disabled')).toBeDefined()
  })

  it('disabling during a pending hover delay cancels the open', async () => {
    const w = await mount()
    vi.useFakeTimers()
    trigger(w).element.dispatchEvent(pointerEvent('pointerenter'))
    await w.setProps({ disabled: true })
    vi.advanceTimersByTime(OPEN_DELAY * 2)
    await nextTick()
    expect(panel()).toBeNull()
  })

  it('disabling an open annotation closes the panel', async () => {
    const w = await mount()
    await openByClick(w)
    await w.setProps({ disabled: true })
    await vi.waitFor(() => {
      if (panel()) throw new Error('panel did not close')
    })
  })
})

describe('AnnotationPopover loading & error chrome', () => {
  it('loading: aria-busy panel, sr-only status, skeletons, no content slot', async () => {
    const w = await mount({ props: { loading: true } })
    await openByClick(w)
    const p = panel()!
    expect(p.getAttribute('aria-busy')).toBe('true')
    const status = p.querySelector('[role="status"]')
    expect(status?.textContent).toBe('Loading preview…')
    expect(p.querySelector('[data-test="content"]')).toBeNull()
  })

  it('error: live message, retry emit, actions stay available', async () => {
    const w = await mount({ props: { error: 'Preview failed.' }, actions: true })
    await openByClick(w)
    const p = panel()!
    const status = p.querySelector('[role="status"]')
    expect(status?.textContent).toBe('Preview failed.')
    expect(p.querySelector('[data-test="content"]')).toBeNull()
    // The escape hatch action is still rendered next to retry.
    expect(p.querySelector('[data-test="action"]')).not.toBeNull()

    const retry = Array.from(p.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Retry preview'),
    )
    expect(retry).toBeDefined()
    retry!.click()
    await nextTick()
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('labels override the shell copy for localization', async () => {
    const w = await mount({
      props: { loading: true, labels: { loading: '正在加载预览' } },
    })
    await openByClick(w)
    expect(panel()!.querySelector('[role="status"]')?.textContent).toBe('正在加载预览')

    await w.setProps({ loading: false, error: '加载失败', labels: { retry: '重试' } })
    await nextTick()
    const retry = Array.from(panel()!.querySelectorAll('button')).find(b =>
      b.textContent?.includes('重试'),
    )
    expect(retry).toBeDefined()
  })
})

describe('AnnotationPopover content resilience', () => {
  it('renders long CJK/Latin content inside the width-capped panel', async () => {
    const long = `${'幂等键确保同一请求重复提交时只生效一次。'.repeat(12)} ${'Idempotency keys deduplicate retries safely. '.repeat(12)}`
    const w = await mount({ content: long })
    await openByClick(w)
    const p = panel()!
    expect(p.textContent).toContain('幂等键')
    expect(p.className).toContain('w-72')
    expect(p.className).toContain('max-w-[calc(100vw-2rem)]')
  })
})
