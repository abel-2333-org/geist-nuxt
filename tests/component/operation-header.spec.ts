import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import OperationHeader from '../../kits/api-docs/components/OperationHeader.vue'

describe('OperationHeader identifier contract', () => {
  it.each([
    {
      props: { kind: 'endpoint', method: 'POST', path: '/v1/payments', summary: 'Create payment' } as const,
      identifier: '/v1/payments',
    },
    {
      props: { kind: 'webhook', event: 'payment.succeeded', summary: 'Payment succeeded' } as const,
      identifier: 'payment.succeeded',
    },
  ])('protects the $props.kind identifier from machine translation', async ({ props, identifier }) => {
    const wrapper = await mountSuspended(OperationHeader, { props })
    const code = wrapper.get('code')

    expect(code.text()).toBe(identifier)
    expect(code.attributes('translate')).toBe('no')
  })
})
