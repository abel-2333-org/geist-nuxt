// OperationTarget contracts. These pin BEHAVIOUR that CSS alone cannot defend,
// and each one exists because it already regressed once:
//   - the row once carried THREE peer copy ICONS (host / path / whole address).
//     Segment copy now lives on the segment TEXT itself, so the row keeps a
//     single explicit button while every segment stays individually copyable —
//     including on touch, where the hover-revealed icons never existed.
//   - the visual order was once produced with `order-last`, which moves the box
//     but NOT the tab sequence, so focus silently disagreed with the screen. The
//     layout now relies on DOM order plus full-width breaker spans.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import OperationTarget from '../../kits/api-docs/components/OperationTarget.vue'

// The clipboard write itself belongs to the foundation `useCopy` (and is covered
// there); what this file must pin is WHICH VALUE each affordance hands it, so the
// auto-import is mocked and the recorded calls are the assertion surface.
const { write } = vi.hoisted(() => ({ write: vi.fn() }))
mockNuxtImport('useCopy', () => () => ({ copied: shallowRef(false), copy: write }))

beforeEach(() => write.mockClear())

const hosts = [
  { id: 'prod', label: '生产', baseUrl: 'https://api.example.com' },
  { id: 'sandbox', label: '沙箱', baseUrl: 'https://sandbox.example.com' },
]

const base = { hosts, path: '/v1/deployments', selectLabel: '选择环境' }

const zh = {
  copy: '复制完整地址',
  copyHost: '复制 host',
  copiedHost: 'host 已复制',
  copyPath: '复制 path',
  copiedPath: 'path 已复制',
}

const copyButtons = (w: Awaited<ReturnType<typeof mountSuspended>>) =>
  w.findAllComponents({ name: 'CopyButton' })

describe('OperationTarget copy affordances', () => {
  it('keeps ONE explicit button, and it copies the whole address', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, labels: zh },
    })

    const buttons = copyButtons(wrapper)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.props('value')).toBe('https://api.example.com/v1/deployments')
  })

  it('copies the host from the host text, untruncated and named in the toast', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, labels: zh, hostToastLabel: 'Host' },
    })

    await wrapper.get(`button[aria-label="${zh.copyHost}"]`).trigger('click')
    expect(write).toHaveBeenCalledWith('https://api.example.com', { label: 'Host' })
  })

  it('copies the path from the path text, without the host', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, labels: zh, pathToastLabel: 'Path' },
    })

    await wrapper.get(`button[aria-label="${zh.copyPath}"]`).trigger('click')
    expect(write).toHaveBeenCalledWith('/v1/deployments', { label: 'Path' })
  })

  it('does not fire when the click merely ended a text selection in the segment', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, labels: zh },
    })

    // Drag-selecting a substring must stay possible: the pointer click that
    // ENDS such a selection is not a copy request.
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'example',
      containsNode: () => true,
    } as unknown as Selection)

    await wrapper.get(`button[aria-label="${zh.copyPath}"]`).trigger('click', { detail: 1 })
    expect(write).not.toHaveBeenCalled()
    vi.mocked(window.getSelection).mockRestore()
  })

  it('still copies on keyboard activation, which carries no selection intent', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: { ...base, labels: zh } })

    // Enter/Space arrive as a click with `detail === 0`, so the selection guard
    // must not swallow them even while text elsewhere is selected.
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'example',
      containsNode: () => true,
    } as unknown as Selection)

    await wrapper.get(`button[aria-label="${zh.copyPath}"]`).trigger('click', { detail: 0 })
    expect(write).toHaveBeenCalledWith('/v1/deployments', { label: 'Path' })
    vi.mocked(window.getSelection).mockRestore()
  })

  it('recomputes both the host and the whole address from the selected environment', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, labels: zh, modelValue: 'sandbox' },
    })

    expect(copyButtons(wrapper)[0]!.props('value'))
      .toBe('https://sandbox.example.com/v1/deployments')

    await wrapper.get(`button[aria-label="${zh.copyHost}"]`).trigger('click')
    expect(write).toHaveBeenCalledWith('https://sandbox.example.com', { label: 'Host' })
  })

  it('keeps the segments as real, selectable mono text', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: base })

    const codes = wrapper.findAll('code').map(c => c.text())
    expect(codes).toContain('https://api.example.com')
    expect(codes).toContain('/v1/deployments')
    // `select-text` is what lets a drag still pick a substring even though the
    // segment is a button now.
    expect(wrapper.get('code').element.closest('button')!.className).toContain('select-text')
  })

  it('announces segment copies through exactly one polite live region', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: { ...base, labels: zh } })
    // The CopyButton owns its own region; the row adds ONE for both segments.
    expect(wrapper.findAll('[aria-live="polite"]')).toHaveLength(2)
  })
})

describe('OperationTarget reading order', () => {
  it('orders the keyboard path environment → host → path → copy', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, labels: zh },
    })

    const names = wrapper.findAll('button').map(b => b.attributes('aria-label') ?? b.text())

    // The whole-address action is last because it acts on everything before it,
    // and it must be last for the KEYBOARD too.
    expect(names).toEqual(['选择环境', zh.copyHost, zh.copyPath, zh.copy])
  })

  it('never uses `order` utilities to place children, which would desync focus', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: base })

    // Read CLASS ATTRIBUTES, not html(): the component documents this very trap
    // in a comment, and Vue emits comments into the markup, so scanning raw HTML
    // matches the prose warning against `order-last` and always "fails".
    const ordered = wrapper.findAll('[class]')
      .flatMap(el => el.classes())
      .filter(c => /(^|:)order-/.test(c))

    expect(ordered).toEqual([])
  })

  it('stacks with decorative full-width breakers that leave wide containers', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: base })
    const breakers = wrapper.findAll('span[aria-hidden="true"].w-full')

    // One splits the controls row from the address card, one gives the path its
    // own line. Both carry no content, so neither can be read out or focused...
    expect(breakers).toHaveLength(2)
    expect(breakers.map(b => b.text())).toEqual(['', ''])
    // ...and both must leave the flow once everything fits on one line, or they
    // would break that line too.
    for (const breaker of breakers) expect(breaker.classes()).toContain('@md/target:hidden')
  })
})

describe('OperationTarget single-host degradation', () => {
  it('drops the select AND its divider when there is nothing to choose', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { hosts: [hosts[0]!], path: '/v1/deployments' },
    })

    expect(wrapper.findComponent({ name: 'USelect' }).exists()).toBe(false)
    // No controls row → no controls/address hairline, just the path breaker.
    expect(wrapper.findAll('span[aria-hidden="true"].w-full')).toHaveLength(1)
    expect(wrapper.text()).toContain('https://api.example.com')
    expect(wrapper.text()).toContain('/v1/deployments')
  })
})

describe('OperationTarget chrome localization', () => {
  it('keeps neutral English defaults for every copy control', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: base })
    const names = wrapper.findAll('button').map(b => b.attributes('aria-label'))

    expect(names).toContain('Copy host')
    expect(names).toContain('Copy path')
    expect(names).toContain('Copy endpoint')
  })
})
