import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import HttpMethodBadge from '../../kits/api-docs/components/HttpMethodBadge.vue'

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
})
