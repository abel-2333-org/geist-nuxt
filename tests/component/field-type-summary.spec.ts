import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import { fieldTypeSummary, summarizeFieldValue } from '../../kits/api-docs/utils/field'
import type { FieldNode, FieldValueNode } from '../../kits/api-docs/utils/field'

describe('field type summary', () => {
  it.each([
    [{ type: 'array', value: { relation: 'item', type: 'object' } }, 'array<object>'],
    [{ type: 'array', value: { relation: 'item', type: 'object', presence: { nullable: true } } }, 'array<object | null>'],
    [{ type: 'object', value: { relation: 'member', type: 'string', presence: { nullable: true } } }, 'map<string, string | null>'],
    [{ type: 'string', value: { relation: 'decoded', codec: 'json', type: 'object[]' } }, 'string'],
    [{ type: 'array', value: { relation: 'item', presence: { nullable: true } } }, 'array'],
    [{ type: 'object', value: { relation: 'member' } }, 'object'],
    [{ type: 'array', value: { relation: 'item', type: 'array', value: { relation: 'item', type: 'object' } } }, 'array'],
    [{ type: 'Merchant[]', value: { relation: 'item', type: 'object' } }, 'Merchant[]'],
  ] satisfies [Pick<FieldNode, 'type' | 'value'>, string][])('preserves the explicit wire boundary for %j', (node, expected) => {
    expect(fieldTypeSummary(node)).toBe(expected)
  })

  it('does not invent an owner type from a value', () => {
    expect(fieldTypeSummary({ value: { relation: 'item', type: 'object' } })).toBeUndefined()
  })

  it.each([
    { description: 'Member description.' },
    { enumValues: [{ value: 'ready', description: 'Ready status.' }] },
    { enumVariants: [{ id: 'status', values: [{ value: 'ready', description: 'Ready status.' }] }] },
    { examples: ['sample-value'] },
    { defaultValue: '' },
    { notes: [{ kind: 'caveat', text: 'May be delayed.' }] },
  ] satisfies Partial<FieldValueNode>[])('retains the scoped renderer for rich detail %j', (detail) => {
    expect(summarizeFieldValue({ relation: 'member', type: 'string', ...detail })).toBe(false)
  })

  it('allows simple conditions and constraints without changing the value model', () => {
    const value: FieldValueNode = {
      relation: 'item', path: 'item-root', type: 'object',
      presence: { nullable: true, condition: 'Null for retired entries.' },
      notes: [{ label: 'Limit', text: 'At most ten entries.' }],
    }
    const before = structuredClone(value)
    expect(summarizeFieldValue(value)).toBe(true)
    expect(value).toEqual(before)
  })
})

describe('FieldItem short type presentation', () => {
  const mounted: VueWrapper[] = []
  afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount() })
  async function mountField(field: FieldNode) {
    const wrapper = await mountSuspended(FieldItem, { props: field })
    mounted.push(wrapper)
    return wrapper
  }

  it.each([
    { name: 'items', type: 'array', value: { relation: 'item', type: 'string' } },
    { name: 'metadata', type: 'object', value: { relation: 'member', type: 'string', path: 'member-root' } },
    { name: 'items', type: 'array', value: { relation: 'item', type: 'object', fields: [{ name: 'id', type: 'string' }] } },
  ] satisfies FieldNode[])('does not create empty detail spacing for %j', async (field) => {
    const wrapper = await mountField(field)
    expect(wrapper.find('[data-field-detail]').exists()).toBe(false)
  })

  it('keeps member null inside the map and owner null outside it', async () => {
    const wrapper = await mountField({
      name: 'attributes', type: 'object',
      value: { relation: 'member', type: 'string', presence: { nullable: true } },
    })
    expect(wrapper.get('[data-field-type]').text()).toBe('map<string, string | null>')
    expect(wrapper.find('[data-value-requirements]').exists()).toBe(false)
    await wrapper.setProps({ presence: { nullable: true } })
    expect(wrapper.get('[data-field-type]').text()).toBe('map<string, string | null> | null')
  })

  it('keeps decoded information in prose while the header remains the wire string', async () => {
    const wrapper = await mountField({
      name: 'payload', type: 'string',
      value: { relation: 'decoded', codec: 'json', type: 'object[]' },
    })
    const identity = wrapper.get('[data-field-identity]')
    expect(identity.get('[data-field-type]').text()).toBe('string')
    expect(identity.text()).not.toContain('json')
    expect(wrapper.text()).toContain('json')
    expect(wrapper.text()).toContain('object[]')
    expect(wrapper.find('[data-value-structure-toggle]').exists()).toBe(false)
  })

  it.each([
    [{ description: 'The description stays available.' }, 'The description stays available.'],
    [{ enumValues: [{ value: 'settled', description: 'The final state.' }] }, 'settled'],
    [{ examples: ['kept-example'] }, 'kept-example'],
    [{ defaultValue: 'kept-default' }, 'kept-default'],
    [{ notes: [{ kind: 'caveat', text: 'The caveat stays available.' }] }, 'The caveat stays available.'],
  ] satisfies [Partial<FieldValueNode>, string][])('keeps rich value content %j', async (detail, text) => {
    const wrapper = await mountField({ name: 'values', type: 'array', value: { relation: 'item', type: 'string', ...detail } })
    expect(wrapper.get('[data-field-type]').text()).toBe('array<string>')
    expect(wrapper.text()).toContain(text)
  })

  it.each([false, true])('retains a unique simple value anchor with real properties: %s', async (structured) => {
    const wrapper = await mountField({
      path: 'entries', name: 'entries', type: 'array',
      value: {
        path: 'entry-root', relation: 'item', type: 'object',
        presence: { nullable: true, condition: 'Null for retired entries.' },
        notes: [{ text: 'IDs are unique.' }],
        ...(structured ? { fields: [{ path: 'entry-id', name: 'id', type: 'string' }, { path: 'entry-code', name: 'code', type: 'integer' }] } : {}),
      },
    })
    expect(wrapper.get('[data-field-type]').text()).toBe('array<object | null>')
    expect(wrapper.findAll('[id]').filter(node => node.attributes('id') === 'entry-root')).toHaveLength(1)
    expect(wrapper.text()).toContain('Null for retired entries.')
    expect(wrapper.text()).toContain('IDs are unique.')
    const toggles = wrapper.findAll('[data-value-structure-toggle]')
    expect(toggles).toHaveLength(structured ? 1 : 0)
    if (structured) {
      expect(toggles[0]!.text()).toContain('(2)')
      await toggles[0]!.trigger('click')
      expect(toggles[0]!.attributes('aria-expanded')).toBe('true')
      expect(wrapper.findAll('[data-field-identity]')).toHaveLength(3)
    }
  })
})
