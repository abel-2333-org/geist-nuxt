import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import HttpMethodBadge from '../../kits/api-docs/components/HttpMethodBadge.vue'
import WebhookBadge from '../../kits/api-docs/components/WebhookBadge.vue'

describe('HttpMethodBadge visible token contract', () => {
  it.each([
    { input: ' get ', label: 'GET', color: 'info' },
    { input: 'EVENT', label: 'EVENT', color: 'neutral' },
    { input: '', label: 'UNKNOWN', color: 'neutral' },
    { input: '   ', label: 'UNKNOWN', color: 'neutral' },
  ])('renders $label for "$input"', async ({ input, label, color }) => {
    const wrapper = await mountSuspended(HttpMethodBadge, { props: { method: input } })
    const badge = wrapper.findComponent({ name: 'UBadge' })

    expect(wrapper.text()).toContain(label)
    expect(badge.props()).toMatchObject({ color, variant: 'subtle' })
  })

  it('protects the method token from machine translation', async () => {
    const wrapper = await mountSuspended(HttpMethodBadge, { props: { method: 'POST' } })

    expect(wrapper.attributes('translate')).toBe('no')
  })
})

describe('WebhookBadge visible token contract', () => {
  it('renders EVENT as a translation-protected domain token', async () => {
    const wrapper = await mountSuspended(WebhookBadge)

    expect(wrapper.text()).toContain('EVENT')
    expect(wrapper.attributes('translate')).toBe('no')
  })
})
