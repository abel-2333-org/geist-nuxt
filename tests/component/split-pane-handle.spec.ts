// SplitPaneHandle contracts. The handle is the presentational + a11y half of
// the window-splitter pattern: it reports INTENT through events while every
// value lives in the parent (SplitPane / CodeRail via useSplitPane). What CSS
// and types cannot defend, these pin:
//   - the ARIA window-splitter surface (role / orientation / value / focus stop);
//   - the keyboard map (arrows nudge, Home/End jump, Enter resets) and that
//     ONLY handled keys are swallowed — Tab must keep moving focus;
//   - `disabled` making it an inert spacer: no separator semantics, no focus
//     stop, no events, no grip — not merely a greyed-out control.
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SplitPaneHandle from '../../foundation/components/SplitPaneHandle.vue'

const a11y = {
  ariaLabel: 'Resize panels',
  valueNow: 320,
  valueMin: 240,
  valueMax: 640,
}

describe('SplitPaneHandle separator surface', () => {
  it('exposes the window-splitter semantics for a vertical divider', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, { props: a11y })
    const root = wrapper.get('div')

    expect(root.attributes('role')).toBe('separator')
    expect(root.attributes('aria-orientation')).toBe('vertical')
    expect(root.attributes('tabindex')).toBe('0')
    expect(root.attributes('aria-label')).toBe('Resize panels')
    expect(root.attributes('aria-valuenow')).toBe('320')
    expect(root.attributes('aria-valuemin')).toBe('240')
    expect(root.attributes('aria-valuemax')).toBe('640')
    expect(root.classes()).toContain('cursor-col-resize')
  })

  it('switches orientation and resize cursor for a horizontal divider', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, {
      props: { ...a11y, orientation: 'horizontal' as const },
    })
    const root = wrapper.get('div')

    expect(root.attributes('aria-orientation')).toBe('horizontal')
    expect(root.classes()).toContain('cursor-row-resize')
  })
})

describe('SplitPaneHandle keyboard map', () => {
  it.each([
    { orientation: 'vertical', key: 'ArrowLeft', dir: -1 },
    { orientation: 'vertical', key: 'ArrowRight', dir: 1 },
    { orientation: 'horizontal', key: 'ArrowUp', dir: -1 },
    { orientation: 'horizontal', key: 'ArrowDown', dir: 1 },
  ] as const)('nudges $dir on $orientation $key', async ({ orientation, key, dir }) => {
    const wrapper = await mountSuspended(SplitPaneHandle, {
      props: { ...a11y, orientation },
    })

    await wrapper.get('div').trigger('keydown', { key })
    expect(wrapper.emitted('step')).toEqual([[dir]])
    expect(wrapper.emitted('jump')).toBeUndefined()
  })

  it.each([
    { key: 'Home', to: 'min' },
    { key: 'End', to: 'max' },
    { key: 'Enter', to: 'reset' },
  ])('jumps to $to on $key', async ({ key, to }) => {
    const wrapper = await mountSuspended(SplitPaneHandle, { props: a11y })

    await wrapper.get('div').trigger('keydown', { key })
    expect(wrapper.emitted('jump')).toEqual([[to]])
    expect(wrapper.emitted('step')).toBeUndefined()
  })

  it.each([
    { orientation: 'vertical', key: 'ArrowDown' },
    { orientation: 'horizontal', key: 'ArrowRight' },
    { orientation: 'vertical', key: 'Tab' },
  ] as const)('lets $key pass through a $orientation divider', async ({ orientation, key }) => {
    const wrapper = await mountSuspended(SplitPaneHandle, {
      props: { ...a11y, orientation },
    })
    const el = wrapper.get('div').element

    const passthrough = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true })
    el.dispatchEvent(passthrough)
    expect(passthrough.defaultPrevented).toBe(false)
    expect(wrapper.emitted('step')).toBeUndefined()
    expect(wrapper.emitted('jump')).toBeUndefined()
  })
})

describe('SplitPaneHandle pointer intent', () => {
  it('starts a drag only for the primary button', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, { props: a11y })
    const root = wrapper.get('div')

    await root.trigger('pointerdown', { button: 1 })
    expect(wrapper.emitted('dragstart')).toBeUndefined()

    await root.trigger('pointerdown', { button: 0 })
    expect(wrapper.emitted('dragstart')).toHaveLength(1)
  })

  it('resets on double click', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, { props: a11y })

    await wrapper.get('div').trigger('dblclick')
    expect(wrapper.emitted('jump')).toEqual([['reset']])
  })

  it('keeps the grip lit while the parent reports an active drag', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, { props: { ...a11y, active: true } })

    // The grip is the SECOND aria-hidden span (track first); while dragging it
    // must stay visible even though the pointer may be outside the handle.
    const grip = wrapper.findAll('span[aria-hidden="true"]').at(-1)!
    expect(grip.classes()).toContain('bg-primary')
    expect(grip.classes()).toContain('opacity-100')
  })
})

describe('SplitPaneHandle disabled contract', () => {
  it('degrades to an inert spacer: no semantics, no focus stop, no events', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, {
      props: { ...a11y, disabled: true },
    })
    const root = wrapper.get('div')

    // No separator surface and no tab stop — an immovable divider must not
    // announce itself as an operable splitter.
    expect(root.attributes('role')).toBeUndefined()
    expect(root.attributes('tabindex')).toBeUndefined()
    expect(root.attributes('aria-label')).toBeUndefined()
    expect(root.attributes('aria-valuenow')).toBeUndefined()

    // No resize affordance, no track, no grip — the box only keeps the layout.
    expect(root.classes().some(c => c.startsWith('cursor-'))).toBe(false)
    expect(wrapper.findAll('span[aria-hidden="true"]')).toHaveLength(0)

    await root.trigger('keydown', { key: 'ArrowRight' })
    await root.trigger('pointerdown', { button: 0 })
    await root.trigger('dblclick')
    expect(wrapper.emitted('step')).toBeUndefined()
    expect(wrapper.emitted('dragstart')).toBeUndefined()
    expect(wrapper.emitted('jump')).toBeUndefined()
  })
})
