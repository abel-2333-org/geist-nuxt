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
import SplitPane from '../../foundation/components/SplitPane.vue'
import SplitPaneHandle from '../../foundation/components/SplitPaneHandle.vue'

const handleProps = {
  label: 'Resize panels',
  controls: 'primary-pane',
  value: 320,
  min: 240,
  max: 640,
}

describe('SplitPaneHandle separator surface', () => {
  it('exposes the window-splitter semantics for a vertical divider', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, { props: handleProps })
    const root = wrapper.get('div')

    expect(root.attributes('role')).toBe('separator')
    expect(root.attributes('aria-orientation')).toBe('vertical')
    expect(root.attributes('tabindex')).toBe('0')
    expect(root.attributes('aria-label')).toBe('Resize panels')
    expect(root.attributes('aria-controls')).toBe('primary-pane')
    expect(root.attributes('aria-valuenow')).toBe('320')
    expect(root.attributes('aria-valuemin')).toBe('240')
    expect(root.attributes('aria-valuemax')).toBe('640')
    expect(root.classes()).toContain('cursor-col-resize')
  })

  it('switches orientation and resize cursor for a horizontal divider', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, {
      props: { ...handleProps, orientation: 'horizontal' as const },
    })
    const root = wrapper.get('div')

    expect(root.attributes('aria-orientation')).toBe('horizontal')
    expect(root.classes()).toContain('cursor-row-resize')
  })
})

describe('SplitPaneHandle keyboard map', () => {
  it.each([
    { orientation: 'vertical', key: 'ArrowLeft', delta: -1 },
    { orientation: 'vertical', key: 'ArrowRight', delta: 1 },
    { orientation: 'horizontal', key: 'ArrowUp', delta: -1 },
    { orientation: 'horizontal', key: 'ArrowDown', delta: 1 },
  ] as const)('nudges $delta on $orientation $key', async ({ orientation, key, delta }) => {
    const wrapper = await mountSuspended(SplitPaneHandle, {
      props: { ...handleProps, orientation },
    })

    await wrapper.get('div').trigger('keydown', { key })
    expect(wrapper.emitted('step')).toEqual([[delta, false]])
    expect(wrapper.emitted('jump')).toBeUndefined()
  })

  it('reports Shift as a coarse nudge without owning the step size', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, { props: handleProps })

    await wrapper.get('div').trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    expect(wrapper.emitted('step')).toEqual([[1, true]])
  })

  it.each([
    { key: 'Home', to: 'min' },
    { key: 'End', to: 'max' },
    { key: 'Enter', to: 'reset' },
  ])('jumps to $to on $key', async ({ key, to }) => {
    const wrapper = await mountSuspended(SplitPaneHandle, { props: handleProps })

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
      props: { ...handleProps, orientation },
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
    const wrapper = await mountSuspended(SplitPaneHandle, { props: handleProps })
    const root = wrapper.get('div')

    await root.trigger('pointerdown', { button: 1 })
    expect(wrapper.emitted('dragStart')).toBeUndefined()

    await root.trigger('pointerdown', { button: 0 })
    expect(wrapper.emitted('dragStart')).toHaveLength(1)
  })

  it('resets on double click', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, { props: handleProps })

    await wrapper.get('div').trigger('dblclick')
    expect(wrapper.emitted('jump')).toEqual([['reset']])
  })

  it('keeps the grip lit while the parent reports a drag', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, {
      props: { ...handleProps, dragging: true },
    })

    // The grip is the SECOND aria-hidden span (track first); while dragging it
    // must stay visible even though the pointer may be outside the handle.
    const grip = wrapper.findAll('span[aria-hidden="true"]').at(-1)!
    expect(grip.classes()).toContain('bg-primary')
    expect(grip.classes()).toContain('opacity-100')
  })
})

describe('SplitPaneHandle edge appearance', () => {
  it('keeps one quiet edge rule and no grip pill', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, {
      props: { ...handleProps, appearance: 'edge' as const },
    })
    const root = wrapper.get('div')
    const rules = wrapper.findAll('span[aria-hidden="true"]')

    expect(root.classes()).toContain('w-2')
    expect(root.classes()).not.toContain('relative')
    expect(rules).toHaveLength(1)
    expect(rules[0]!.classes()).toContain('bg-transparent')

    await wrapper.setProps({ dragging: true })
    expect(rules[0]!.classes()).toContain('w-0.5')
    expect(rules[0]!.classes()).toContain('bg-primary')
  })
})

describe('SplitPaneHandle disabled contract', () => {
  it('degrades to an inert spacer: no semantics, no focus stop, no events', async () => {
    const wrapper = await mountSuspended(SplitPaneHandle, {
      props: { ...handleProps, disabled: true },
    })
    const root = wrapper.get('div')

    // No separator surface and no tab stop — an immovable divider must not
    // announce itself as an operable splitter.
    expect(root.attributes('role')).toBeUndefined()
    expect(root.attributes('tabindex')).toBeUndefined()
    expect(root.attributes('aria-label')).toBeUndefined()
    expect(root.attributes('aria-controls')).toBeUndefined()
    expect(root.attributes('aria-valuenow')).toBeUndefined()

    // No resize affordance, no track, no grip — the box only keeps the layout.
    expect(root.classes().some(c => c.startsWith('cursor-'))).toBe(false)
    expect(wrapper.findAll('span[aria-hidden="true"]')).toHaveLength(0)

    await root.trigger('keydown', { key: 'ArrowRight' })
    await root.trigger('pointerdown', { button: 0 })
    await root.trigger('dblclick')
    expect(wrapper.emitted('step')).toBeUndefined()
    expect(wrapper.emitted('dragStart')).toBeUndefined()
    expect(wrapper.emitted('jump')).toBeUndefined()
  })
})

describe('SplitPane separator relationship', () => {
  it.each([
    { mode: 'fixed', fixedPane: 'start', controlledText: 'Start pane' },
    { mode: 'fixed', fixedPane: 'end', controlledText: 'End pane' },
    { mode: 'ratio', fixedPane: 'end', controlledText: 'Start pane' },
  ] as const)('controls the primary pane in $mode/$fixedPane mode', async (props) => {
    const wrapper = await mountSuspended(SplitPane, {
      props: {
        mode: props.mode,
        fixedPane: props.fixedPane,
        enabledFrom: 'always',
        storageKey: `test-controls-${props.mode}-${props.fixedPane}`,
      },
      slots: {
        start: 'Start pane',
        end: 'End pane',
      },
    })
    const separator = wrapper.get('[role="separator"]')
    const controlled = wrapper.get(`[id="${separator.attributes('aria-controls')}"]`)

    expect(controlled.text()).toBe(props.controlledText)
  })

  it('honors Shift as a 3× coarse keyboard step in fixed mode', async () => {
    const wrapper = await mountSuspended(SplitPane, {
      props: {
        enabledFrom: 'always',
        storageKey: 'test-coarse-step',
        defaultSize: 320,
      },
      slots: { start: 'Start pane', end: 'End pane' },
    })
    const separator = wrapper.get('[role="separator"]')
    expect(separator.attributes('aria-valuenow')).toBe('320')

    // fixedPane defaults to 'end': ArrowLeft grows the end pane by the fine step.
    await separator.trigger('keydown', { key: 'ArrowLeft' })
    expect(separator.attributes('aria-valuenow')).toBe('344')

    await separator.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(separator.attributes('aria-valuenow')).toBe('416')
  })

  it('reports the current value as aria-valuemax while the clamp is unbounded', async () => {
    // No maxSize and no delivered container measurement → the fixed-mode max
    // clamp is Infinity, which must never surface as aria-valuemax="Infinity".
    const wrapper = await mountSuspended(SplitPane, {
      props: {
        enabledFrom: 'always',
        storageKey: 'test-unbounded-max',
      },
      slots: { start: 'Start pane', end: 'End pane' },
    })
    const separator = wrapper.get('[role="separator"]')

    expect(separator.attributes('aria-valuemax')).toBe(separator.attributes('aria-valuenow'))
    expect(Number.isFinite(Number(separator.attributes('aria-valuemax')))).toBe(true)
  })

  it('wires the drag-start event into the split state', async () => {
    const wrapper = await mountSuspended(SplitPane, {
      props: {
        enabledFrom: 'always',
        storageKey: 'test-drag-start-wiring',
      },
      slots: {
        start: 'Start pane',
        end: 'End pane',
      },
    })

    await wrapper.get('[role="separator"]').trigger('pointerdown', {
      button: 0,
      pointerId: 1,
      clientX: 320,
    })
    expect(document.body.style.userSelect).toBe('none')

    wrapper.unmount()
    expect(document.body.style.userSelect).toBe('')
  })
})
