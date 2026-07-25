// OperationTarget contracts. These pin BEHAVIOUR that CSS alone cannot defend:
// the row is a wrapping flex line whose visual order was once produced with
// `order-last`, which moves the box but NOT the tab sequence — so focus order
// silently disagreed with the screen. The layout now relies on DOM order plus a
// full-width breaker span, and these tests fail if anyone reintroduces `order`
// or reshuffles the children.
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import OperationTarget from '../../kits/api-docs/components/OperationTarget.vue'

const hosts = [
  { id: 'prod', label: '生产', baseUrl: 'https://api.example.com' },
  { id: 'sandbox', label: '沙箱', baseUrl: 'https://sandbox.example.com' },
]

const base = { hosts, path: '/v1/deployments', selectLabel: '选择环境' }

describe('OperationTarget reading order', () => {
  it('makes the whole-address copy the LAST focusable, after both segments', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, labels: { copyHost: '复制服务地址', copyPath: '复制请求路径' } },
    })

    const names = wrapper.findAll('button').map(b => b.attributes('aria-label') ?? b.text())

    // Reading order of the row: env → host → path → whole address. The primary
    // action is last because it acts on everything before it.
    expect(names).toEqual(['选择环境', '复制服务地址', '复制请求路径', 'Copy'])
  })

  it('never uses `order` utilities to place children, which would desync focus', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: base })

    // Read CLASS ATTRIBUTES, not html(): the component documents this very trap
    // in a comment, and Vue emits comments into the markup, so scanning raw HTML
    // matches the prose warning against `order-last` and always "fails".
    const ordered = wrapper.findAll('[class]')
      .flatMap(el => el.classes())
      .filter(c => /(^|:)order-/.test(c))

    // Any order-* utility means visual position no longer follows DOM position.
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

describe('OperationTarget copy values', () => {
  it('copies the full baseUrl for the host even though it may render truncated', async () => {
    const wrapper = await mountSuspended(OperationTarget, { props: base })
    const values = wrapper.findAllComponents({ name: 'CopyButton' }).map(c => c.props('value'))

    expect(values).toContain('https://api.example.com')
    expect(values).toContain('/v1/deployments')
    expect(values).toContain('https://api.example.com/v1/deployments')
  })

  it('recomputes every copy value from the selected environment', async () => {
    const wrapper = await mountSuspended(OperationTarget, {
      props: { ...base, modelValue: 'sandbox' },
    })
    const values = wrapper.findAllComponents({ name: 'CopyButton' }).map(c => c.props('value'))

    expect(values).toContain('https://sandbox.example.com')
    expect(values).toContain('https://sandbox.example.com/v1/deployments')
    expect(values).not.toContain('https://api.example.com/v1/deployments')
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
