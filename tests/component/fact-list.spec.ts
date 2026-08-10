import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { h } from 'vue'
import FactList from '../../kits/api-docs/internal/FactList.vue'
import FactRow from '../../kits/api-docs/internal/FactRow.vue'

describe('FactList internal layout', () => {
  it('renders ordered definition rows with the shared fact contract', async () => {
    const wrapper = await mountSuspended(FactList, {
      slots: {
        default: () => [
          h(FactRow, { fact: { term: 'Authentication', value: 'Bearer token' } }),
          h(FactRow, { fact: { term: 'Header', value: 'Webhook-Signature', code: true } }),
        ],
      },
    })

    const list = wrapper.get('[data-fact-list]')
    expect(list.element.tagName).toBe('DL')
    expect(list.attributes('data-fact-list')).toBe('')

    const rows = wrapper.findAll('[data-fact-row]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('dt').text()).toBe('Authentication')
    expect(rows[0]!.find('dd').text()).toBe('Bearer token')
    expect(rows[1]!.find('code').attributes('translate')).toBe('no')
  })

  it('lets domain components replace term and value rendering without changing the row shell', async () => {
    const wrapper = await mountSuspended(FactRow, {
      props: { fact: { term: 'Address Source' } },
      slots: {
        term: () => h('span', { 'data-term': '' }, 'Address Source'),
        value: () => h('a', { 'data-source': '', href: '#field' }, 'Request body callback_url'),
      },
    })

    expect(wrapper.attributes('data-fact-row')).toBe('')
    expect(wrapper.find('dt [data-term]').text()).toBe('Address Source')
    expect(wrapper.find('dd [data-source]').attributes('href')).toBe('#field')
  })
})
