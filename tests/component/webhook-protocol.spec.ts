// <WebhookProtocol> — schedule 折叠按钮的可访问名契约。
// 折叠派生逻辑本身在 tests/webhook-protocol.test.mjs(纯函数);这里只验组件层:
// 展开按钮在调用方未注入 expandLabel/collapseLabel 时回退英文默认可访问名
// (视觉文案保持 +N / −),以及 aria-expanded 与 sr-only 全序列的状态切换。
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WebhookProtocol from '../../kits/api-docs/components/WebhookProtocol.vue'

const delivery = (schedule: Record<string, unknown>) => ({
  label: 'DELIVERY',
  schedule: {
    term: 'Retry cadence',
    summary: 'Backs off from 1 minute to 12 hours over 8 attempts.',
    steps: ['1m', '5m', '15m', '1h', '3h', '6h', '9h', '12h'],
    ...schedule,
  },
})

function toggleButton(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.get('button[aria-expanded]')
}

describe('WebhookProtocol schedule toggle accessible name', () => {
  it('falls back to an English default accessible name, keeping +N as visual copy', async () => {
    const wrapper = await mountSuspended(WebhookProtocol, {
      props: { delivery: delivery({}) },
    })
    const button = toggleButton(wrapper)
    // 8 steps, max 6 → 5 visible + 3 folded.
    expect(button.attributes('aria-label')).toBe('Show 3 more steps')
    expect(button.text()).toBe('+3')
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('prefers caller-provided expandLabel/collapseLabel over the defaults', async () => {
    const wrapper = await mountSuspended(WebhookProtocol, {
      props: {
        delivery: delivery({
          expandLabel: (hidden: number) => `展开其余 ${hidden} 次间隔`,
          collapseLabel: '收起',
        }),
      },
    })
    const button = toggleButton(wrapper)
    expect(button.attributes('aria-label')).toBe('展开其余 3 次间隔')

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.attributes('aria-label')).toBe('收起')
  })

  it('expanding reveals the full sequence to screen readers and defaults to Collapse', async () => {
    const wrapper = await mountSuspended(WebhookProtocol, {
      props: { delivery: delivery({}) },
    })
    const button = toggleButton(wrapper)
    expect(wrapper.find('dd .sr-only').exists()).toBe(false)

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.attributes('aria-label')).toBe('Collapse')
    expect(wrapper.get('dd .sr-only').text()).toContain('1m → 5m')
  })
})
