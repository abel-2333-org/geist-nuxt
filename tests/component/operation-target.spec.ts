// OperationTarget contracts. These pin BEHAVIOUR that CSS alone cannot defend,
// and each one exists because it already regressed once:
//   - the row once carried THREE peer copy ICONS (host / path / whole address).
//     Segment copy now lives on the segment TEXT itself, so the row keeps a
//     single explicit button while every segment stays individually copyable —
//     including on touch, where the hover-revealed icons never existed.
//   - visual and keyboard order must agree. The two-line layout relies on DOM
//     order alone, never CSS `order`.
//   - the primary CopyButton once wrapped onto a line by itself, because path
//     and copy were peer flex items and the row's break point was left to
//     content width. The layout is now two `flex-nowrap` units, which is a
//     STRUCTURAL invariant a test can hold — unlike the pixel band it replaced.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { defineComponent } from 'vue'
import { UApp, UTooltip } from '#components'
import OperationTarget from '../../kits/api-docs/components/OperationTarget.vue'

// The clipboard write itself belongs to the foundation `useCopy` (and is covered
// there); what this file must pin is WHICH VALUE each affordance hands it, so the
// auto-import is mocked and the recorded calls are the assertion surface.
const { write } = vi.hoisted(() => ({ write: vi.fn() }))
mockNuxtImport('useCopy', () => () => ({ copied: shallowRef(false), copy: write }))

beforeEach(() => {
  write.mockReset()
  write.mockResolvedValue(true)
})

function deferred() {
  let resolve!: (value: boolean) => void
  const promise = new Promise<boolean>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const hosts = [
  { id: 'prod', label: '生产', baseUrl: 'https://api.example.com' },
  { id: 'sandbox', label: '沙箱', baseUrl: 'https://sandbox.example.com' },
]

const base = { hosts, path: '/v1/deployments', selectLabel: '选择环境' }

const zh = {
  copy: '复制完整地址',
  copied: '接口地址已复制',
  copyFailed: '复制失败，请手动复制地址',
  copyHost: '复制 host',
  copiedHost: 'host 已复制',
  copyPath: '复制 path',
  copiedPath: 'path 已复制',
}

const copyButtons = (w: Awaited<ReturnType<typeof mountSuspended>>) =>
  w.findAllComponents({ name: 'CopyButton' })

const Host = defineComponent({
  components: { OperationTarget, UApp },
  inheritAttrs: false,
  template: '<UApp><OperationTarget v-bind="$attrs" /></UApp>',
})

const mountTarget = (options: Parameters<typeof mountSuspended>[1]) =>
  mountSuspended(Host, options)

describe('OperationTarget copy affordances', () => {
  it('keeps ONE explicit button, and it copies the whole address', async () => {
    const wrapper = await mountTarget({
      props: { ...base, labels: zh },
    })

    const buttons = copyButtons(wrapper)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.props('value')).toBe('https://api.example.com/v1/deployments')
    expect(buttons[0]!.props('successMessage')).toBe(zh.copied)
    expect(buttons[0]!.props('failureMessage')).toBe(zh.copyFailed)
  })

  it('copies the host from the host text, untruncated and named in the toast', async () => {
    const wrapper = await mountTarget({
      props: { ...base, labels: zh },
    })

    await wrapper.get(`button[aria-label="${zh.copyHost}"]`).trigger('click')
    expect(write).toHaveBeenCalledWith('https://api.example.com', {
      successMessage: zh.copiedHost,
      failureMessage: zh.copyFailed,
    })
  })

  it('copies the path from the path text, without the host', async () => {
    const wrapper = await mountTarget({
      props: { ...base, labels: zh },
    })

    await wrapper.get(`button[aria-label="${zh.copyPath}"]`).trigger('click')
    expect(write).toHaveBeenCalledWith('/v1/deployments', {
      successMessage: zh.copiedPath,
      failureMessage: zh.copyFailed,
    })
  })

  it('does not fire when the click merely ended a text selection in the segment', async () => {
    const wrapper = await mountTarget({
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
    const wrapper = await mountTarget({ props: { ...base, labels: zh } })

    // Enter/Space arrive as a click with `detail === 0`, so the selection guard
    // must not swallow them even while text elsewhere is selected.
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'example',
      containsNode: () => true,
    } as unknown as Selection)

    await wrapper.get(`button[aria-label="${zh.copyPath}"]`).trigger('click', { detail: 0 })
    expect(write).toHaveBeenCalledWith('/v1/deployments', {
      successMessage: zh.copiedPath,
      failureMessage: zh.copyFailed,
    })
    vi.mocked(window.getSelection).mockRestore()
  })

  it('recomputes both the host and the whole address from the selected environment', async () => {
    const wrapper = await mountTarget({
      props: { ...base, labels: zh, modelValue: 'sandbox' },
    })

    expect(copyButtons(wrapper)[0]!.props('value'))
      .toBe('https://sandbox.example.com/v1/deployments')

    await wrapper.get(`button[aria-label="${zh.copyHost}"]`).trigger('click')
    expect(write).toHaveBeenCalledWith('https://sandbox.example.com', {
      successMessage: zh.copiedHost,
      failureMessage: zh.copyFailed,
    })
  })

  it('keeps the segments as discoverable, selectable mono text', async () => {
    const wrapper = await mountTarget({ props: { ...base, labels: zh } })

    const codes = wrapper.findAll('code').map(c => c.text())
    expect(codes).toContain('https://api.example.com')
    expect(codes).toContain('/v1/deployments')

    const segments = [
      wrapper.get(`button[aria-label="${zh.copyHost}"]`),
      wrapper.get(`button[aria-label="${zh.copyPath}"]`),
    ]
    for (const segment of segments) {
      expect(segment.classes()).toEqual(expect.arrayContaining([
        'cursor-copy',
        'touch-manipulation',
        'select-text',
        'hover:underline',
        'focus-visible:underline',
      ]))
      expect(segment.get('code').attributes('translate')).toBe('no')
    }

    expect(wrapper.findAllComponents(UTooltip).map(tooltip => tooltip.props('text')))
      .toEqual([zh.copyHost, zh.copyPath])
  })

  it('announces segment copies through exactly one polite live region', async () => {
    const wrapper = await mountTarget({ props: { ...base, labels: zh } })
    // The CopyButton owns its own region; the row adds ONE for both segments.
    expect(wrapper.findAll('[aria-live="polite"]')).toHaveLength(2)
  })

  it('announces the latest segment when host and path are copied in succession', async () => {
    const wrapper = await mountTarget({ props: { ...base, labels: zh } })
    const status = wrapper.findAll('[aria-live="polite"]').at(-1)!

    await wrapper.get(`button[aria-label="${zh.copyHost}"]`).trigger('click')
    await flushPromises()
    expect(status.text()).toBe(zh.copiedHost)

    await wrapper.get(`button[aria-label="${zh.copyPath}"]`).trigger('click')
    await flushPromises()
    expect(status.text()).toBe(zh.copiedPath)
  })

  it('keeps the latest requested segment when clipboard promises resolve out of order', async () => {
    const host = deferred()
    const path = deferred()
    write
      .mockReturnValueOnce(host.promise)
      .mockReturnValueOnce(path.promise)
    const wrapper = await mountTarget({ props: { ...base, labels: zh } })
    const status = wrapper.findAll('[aria-live="polite"]').at(-1)!

    await wrapper.get(`button[aria-label="${zh.copyHost}"]`).trigger('click')
    await wrapper.get(`button[aria-label="${zh.copyPath}"]`).trigger('click')
    path.resolve(true)
    await flushPromises()
    expect(status.text()).toBe(zh.copiedPath)

    host.resolve(true)
    await flushPromises()
    expect(status.text()).toBe(zh.copiedPath)
  })
})

describe('OperationTarget reading order', () => {
  it('orders the keyboard path environment → host → path → copy', async () => {
    const wrapper = await mountTarget({
      props: { ...base, labels: zh },
    })

    const names = wrapper.findAll('button').map(b => b.attributes('aria-label') ?? b.text())

    // The whole-address action is last because it acts on everything before it,
    // and it must be last for the KEYBOARD too.
    expect(names).toEqual(['选择环境', zh.copyHost, zh.copyPath, zh.copy])
  })

  it('never uses `order` utilities to place children, which would desync focus', async () => {
    const wrapper = await mountTarget({ props: base })

    // Read CLASS ATTRIBUTES, not html(): the component documents this very trap
    // in a comment, and Vue emits comments into the markup, so scanning raw HTML
    // matches the prose warning against `order-last` and always "fails".
    const ordered = wrapper.findAll('[class]')
      .flatMap(el => el.classes())
      .filter(c => /(^|:)order-/.test(c))

    expect(ordered).toEqual([])
  })

  // The reflow contract, stated as STRUCTURE rather than as a threshold. A
  // pixel breakpoint cannot express "single line only when it actually fits",
  // because host, path, label and font metrics are all variables — and the
  // orphaned CopyButton regression proved it: the break landed wherever the
  // content happened to run out, ~32px wide, at 534px for one fixture and
  // 719px for another. Two `flex-nowrap` units make the row's only break point
  // the boundary between them, so no width can strand the copy action.
  it('splits the row into exactly two unbreakable layout units', async () => {
    const wrapper = await mountTarget({ props: { ...base, labels: zh } })
    const root = wrapper.get('.\\@container\\/target')
    const origin = wrapper.get('[data-target-origin]')
    const operation = wrapper.get('[data-target-operation]')

    // The wrap lives on the root; the units themselves must never wrap.
    expect(root.classes()).toContain('flex-wrap')
    for (const unit of [origin, operation]) {
      expect(unit.classes()).toEqual(expect.arrayContaining(['flex', 'flex-nowrap', 'min-w-0']))
    }

    // Order is positional, never `order`: origin precedes operation in the DOM.
    expect(origin.element.nextElementSibling).toBe(operation.element)

    // The pairing is the point: path travels with the action that copies the
    // whole address, environment travels with the host it selects.
    expect(origin.find('button[aria-label="选择环境"]').exists()).toBe(true)
    expect(origin.find(`button[aria-label="${zh.copyHost}"]`).exists()).toBe(true)
    expect(operation.find(`button[aria-label="${zh.copyPath}"]`).exists()).toBe(true)
    expect(operation.findComponent({ name: 'CopyButton' }).exists()).toBe(true)
  })

  it('carries no breakpoint-bound layout escape hatch', async () => {
    const wrapper = await mountTarget({ props: base })

    // The old implementation forced the two layers with a full-width spacer and
    // released them at a container breakpoint. Both are gone: reintroducing
    // either would make the reflow width-driven again. The named container
    // survives for segment DENSITY only, so `@md/target:` may still appear —
    // just never on a flex/width/display utility.
    expect(wrapper.findAll('span[aria-hidden="true"].w-full')).toHaveLength(0)

    const layoutEscapes = wrapper.findAll('[class]')
      .flatMap(el => el.classes())
      .filter(c => /^@[a-z0-9[\]-]+\/target:(flex|w-|basis-|hidden|block|grid)/.test(c))

    expect(layoutEscapes).toEqual([])
  })
})

describe('OperationTarget single-host degradation', () => {
  it('drops the select while preserving the host/path structure', async () => {
    const wrapper = await mountTarget({
      props: { hosts: [hosts[0]!], path: '/v1/deployments' },
    })

    expect(wrapper.findComponent({ name: 'USelect' }).exists()).toBe(false)
    // Dropping the picker leaves the origin unit holding the host alone; the
    // two-unit split — and therefore the reflow contract — is unaffected.
    expect(wrapper.get('[data-target-origin]').findAll('button')).toHaveLength(1)
    expect(wrapper.find('[data-target-operation]').exists()).toBe(true)
    expect(wrapper.text()).toContain('https://api.example.com')
    expect(wrapper.text()).toContain('/v1/deployments')
  })
})

describe('OperationTarget chrome localization', () => {
  it('keeps neutral English defaults for every copy control', async () => {
    const wrapper = await mountTarget({ props: base })
    const names = wrapper.findAll('button').map(b => b.attributes('aria-label'))

    expect(names).toContain('Copy host')
    expect(names).toContain('Copy path')
    expect(names).toContain('Copy endpoint')
  })
})
