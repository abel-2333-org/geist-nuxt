import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PlaygroundPage from '../../app/pages/playground.vue'

describe('structured relations playground recipe', () => {
  // First mount of the full playground page pays the cold-worker SFC
  // transform cost and can exceed Vitest's 5s default under CPU load.
  it('resolves every field link to one real FieldItem target', { timeout: 15_000 }, async () => {
    const wrapper = await mountSuspended(PlaygroundPage)
    const fields = [
      'req_callback_url',
      'req_notification_callback_url',
      'req_recipients_callback_url',
      'res_id',
      'res_ownership_team_identifier',
      'res_project_identifier',
      'res_metadata_tenant_region',
      'res_flags_beta_legacy',
      'res_payment_id',
      'res_refund_id',
      'res_ownership_member_identifier',
    ]
    const ids = wrapper.findAll('[id]').map(node => node.attributes('id'))
    const links = wrapper.findAll('a[href^="#"]')
    const linked = new Set(links.map(link => decodeURIComponent(link.attributes('href').slice(1))))

    expect(new Set(ids).size).toBe(ids.length)
    expect(linked).toEqual(new Set(fields))
    for (const field of fields) {
      expect(links.filter(link => link.attributes('href') === `#${field}`).length).toBeGreaterThan(0)
      expect(wrapper.findAll(`[id="${field}"]`)).toHaveLength(1)
    }

    const unresolved = wrapper.findAll('[data-fact-row]').find(node => node.text().includes('Location'))
    expect(unresolved).toBeDefined()
    expect(unresolved!.find('a').exists()).toBe(false)
  })

  it('keeps a next operation while omitting its absent parameter mapping', async () => {
    const wrapper = await mountSuspended(PlaygroundPage)
    const operation = wrapper.findAll('li').find(node => node.text().includes('List deployment events'))

    expect(operation).toBeDefined()
    expect(operation!.text()).toContain('/v1/deployments/events')
    expect(operation!.text()).toContain('只保留 identity 与动作说明')
    expect(operation!.text()).not.toContain('Parameter / Value Source')
    expect(operation!.find('[data-fact-list]').exists()).toBe(false)
  })
})
