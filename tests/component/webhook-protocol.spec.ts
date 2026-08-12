// <WebhookProtocol> — rich fact contract 与 schedule 折叠按钮的呈现契约。
// 折叠派生逻辑本身在 tests/webhook-protocol.test.mjs（纯函数）；这里验组件层：
// 1) fact format 判别：默认纯文本、'code' / 'inline-markdown' 明确 opt-in
//    （unsafe scheme / raw HTML 不执行）；
// 2) 展开按钮可见文案即可访问名（Label in Name），aria-expanded 与 sr-only
//    全序列的状态切换。
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WebhookProtocol from '../../kits/api-docs/components/WebhookProtocol.vue'
import type { WebhookProtocolFact } from '../../kits/api-docs/components/WebhookProtocol.vue'

const delivery = (schedule: Record<string, unknown>) => ({
  label: 'DELIVERY',
  schedule: {
    term: 'Retry cadence',
    summary: 'Backs off from 1 minute to 12 hours over 8 attempts.',
    steps: ['1m', '5m', '15m', '1h', '3h', '6h', '9h', '12h'],
    ...schedule,
  },
})

async function mountFacts(facts: WebhookProtocolFact[]) {
  return mountSuspended(WebhookProtocol, {
    props: { verification: { label: 'VERIFICATION', facts } },
  })
}

function toggleButton(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.get('button[aria-expanded]')
}

describe('WebhookProtocol fact format', () => {
  it('defaults to plain text: markdown syntax in value stays literal', async () => {
    const wrapper = await mountFacts([
      { term: 'Guide', value: '[Guide](/webhooks/transfer-result)' },
    ])
    expect(wrapper.find('dd a').exists()).toBe(false)
    expect(wrapper.get('dd').text()).toContain('[Guide](/webhooks/transfer-result)')
  })

  it('renders an internal link for format: inline-markdown, keeping note plain text', async () => {
    const wrapper = await mountFacts([
      {
        term: 'Guide',
        value: 'See [Guide](/transfer/api-reference/webhooks/transfer-result) for payloads.',
        format: 'inline-markdown',
        note: 'Note stays **plain**.',
      },
    ])
    const link = wrapper.get('dd a')
    expect(link.attributes('href')).toBe('/transfer/api-reference/webhooks/transfer-result')
    expect(link.attributes('target')).toBeUndefined()
    expect(link.text()).toBe('Guide')
    // note 不经 markdown 解析
    expect(wrapper.get('dd').text()).toContain('Note stays **plain**.')
    expect(wrapper.find('dd strong').exists()).toBe(false)
  })

  it('keeps InlineMarkdown safety: unsafe schemes and raw HTML are never executed', async () => {
    const wrapper = await mountFacts([
      { term: 'Bad link', value: '[x](javascript:alert(1))', format: 'inline-markdown' },
      { term: 'Raw HTML', value: '<img src=x onerror=alert(1)>', format: 'inline-markdown' },
    ])
    expect(wrapper.find('dd a').exists()).toBe(false)
    expect(wrapper.find('dd img').exists()).toBe(false)
    expect(wrapper.text()).toContain('[x](javascript:alert(1))')
  })

  it('renders code only through the explicit format contract', async () => {
    const wrapper = await mountFacts([
      { term: 'Header', value: 'X-Example-Signature', format: 'code' },
      { term: 'Guide', value: '[Guide](/g)', format: 'inline-markdown' },
      { term: 'Enum code', value: 'HMAC-SHA256', format: 'code' },
    ])
    const codes = wrapper.findAll('dd code')
    expect(codes.some(c => c.text() === 'X-Example-Signature')).toBe(true)
    expect(codes.some(c => c.text() === 'HMAC-SHA256')).toBe(true)
    expect(wrapper.get('dd a').attributes('href')).toBe('/g')
  })
})

describe('WebhookProtocol schedule toggle', () => {
  it('shows an action label as both visible copy and accessible name by default', async () => {
    const wrapper = await mountSuspended(WebhookProtocol, {
      props: { delivery: delivery({}) },
    })
    const button = toggleButton(wrapper)
    // 8 steps, max 6 → 5 visible + 3 folded；可见文案即可访问名，无 aria-label 分裂。
    expect(button.text()).toBe('Show 3 more')
    expect(button.attributes('aria-label')).toBeUndefined()
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('prefers caller-provided expandLabel/collapseLabel as visible copy', async () => {
    const wrapper = await mountSuspended(WebhookProtocol, {
      props: {
        delivery: delivery({
          expandLabel: (hidden: number) => `展开其余 ${hidden} 次间隔`,
          collapseLabel: '收起',
        }),
      },
    })
    const button = toggleButton(wrapper)
    expect(button.text()).toBe('展开其余 3 次间隔')

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.text()).toBe('收起')
  })

  it('expanding reveals the full sequence to screen readers and defaults to Show less', async () => {
    const wrapper = await mountSuspended(WebhookProtocol, {
      props: { delivery: delivery({}) },
    })
    const button = toggleButton(wrapper)
    expect(wrapper.find('dd .sr-only').exists()).toBe(false)

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.text()).toBe('Show less')
    expect(wrapper.get('dd .sr-only').text()).toContain('1m → 5m')
  })
})
