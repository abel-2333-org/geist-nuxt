// OperationTarget contracts. These pin BEHAVIOUR that CSS alone cannot defend,
// and each one exists because it already regressed once:
//   - the row offered THREE copy buttons (host / path / whole address). One task
//     ("get the address"), three same-weight unlabelled icons — and because the
//     segment ones were hover-revealed, touch had to show them permanently, so
//     the smallest screen got all three at once. The row now has exactly one.
//   - the visual order was once produced with `order-last`, which moves the box
//     but NOT the tab sequence, so focus silently disagreed with the screen. The
//     layout now relies on DOM order plus a full-width breaker span.
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import OperationTarget from '../../kits/api-docs/components/OperationTarget.vue'

const hosts = [
  { id: 'prod', label: '生产', baseUrl: 'https://api.example.com' },
  { id: 'sandbox', label: '沙箱', baseUrl: 'https://sandbox.example.com' },
]

const base = { hosts, path: '/v1/deployments', selectLabel: '选择环境' }

const copyButtons = (w: Awaited<ReturnType<typeof mountSuspended>>) =>
  w.findAllComponents({ name: 'CopyButton' })

describe('OperationTarget copy affordance', () => {
  it('offers exactly ONE copy button, for the whole address', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, labels: { copy: '复制完整地址' } },
    })

    const buttons = copyButtons(wrapper)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.props('value')).toBe('https://api.example.com/v1/deployments')
  })

  it('exposes no segment-level copy, so the row cannot regrow peer actions', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: base })
    const values = copyButtons(wrapper).map(c => c.props('value'))

    // A bare host or bare path as a copy VALUE means a segment button is back.
    expect(values).not.toContain('https://api.example.com')
    expect(values).not.toContain('/v1/deployments')
  })

  it('keeps the segments as selectable text rather than buttons', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: base })

    // This is what still serves the rare "I only want the path" case, and it is
    // why the segments must never become interactive: that would destroy text
    // selection, the very fallback that let the extra buttons go.
    const codes = wrapper.findAll('code').map(c => c.text())
    expect(codes).toContain('https://api.example.com')
    expect(codes).toContain('/v1/deployments')
    expect(wrapper.findAll('code button')).toHaveLength(0)
  })

  it('recomputes the copy value from the selected environment', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, modelValue: 'sandbox' },
    })

    expect(copyButtons(wrapper)[0]!.props('value'))
      .toBe('https://sandbox.example.com/v1/deployments')
  })
})

describe('OperationTarget reading order', () => {
  it('makes the copy button the LAST focusable in the row', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, labels: { copy: '复制完整地址' } },
    })

    const names = wrapper.findAll('button').map(b => b.attributes('aria-label') ?? b.text())

    // Reading order: environment → address → copy. The action is last because
    // it acts on everything before it, and it must be last for the KEYBOARD too.
    expect(names).toEqual(['选择环境', '复制完整地址'])
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

  it('wraps via a decorative full-width breaker that is hidden from a11y and from wide containers', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: base })
    const breaker = wrapper.find('span[aria-hidden="true"].w-full')

    expect(breaker.exists()).toBe(true)
    // Carries no content, so it cannot be read out or focused...
    expect(breaker.text()).toBe('')
    // ...and it only exists to force the stacked wrap: once both halves fit on
    // one line it must leave the flow entirely, or it would break that line too.
    expect(breaker.classes()).toContain('@md/target:hidden')
  })
})

describe('OperationTarget single-host degradation', () => {
  it('drops the select when there is nothing to choose, keeping the address intact', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { hosts: [hosts[0]!], path: '/v1/deployments' },
    })

    expect(wrapper.findComponent({ name: 'USelect' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('https://api.example.com')
    expect(wrapper.text()).toContain('/v1/deployments')
  })
})
