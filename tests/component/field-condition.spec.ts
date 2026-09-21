// Condition prose as a list (issue #145): a request condition and an output
// presence condition may each be one sentence or an ordered list of
// independent sentences. The contract pinned here: `conditionEntries()` is the
// only normalisation (blanks dropped, order kept), every truthiness check
// reads it (marker, detail gate, value scope block, FieldAnnotation popover),
// one entry renders exactly like a plain string, two or more render as ONE
// rule holding a real list, and the presence notation never changes shape
// because of the prose.
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { UApp } from '#components'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import FieldAnnotation from '../../kits/api-docs/components/FieldAnnotation.vue'
import InlineMarkdown from '../../foundation/components/InlineMarkdown.vue'
import {
  conditionEntries,
  describeFieldPresence,
  describeValueRequirements,
  fieldRequiredState,
  fieldValueLabelDefaults,
  hasValueDetail,
} from '../../kits/api-docs/utils/field'

const FieldHost = defineComponent({
  components: { FieldItem, UApp },
  inheritAttrs: false,
  template: '<UApp><FieldItem v-bind="$attrs" /></UApp>',
})
const mountField = (props: Record<string, unknown>) => mountSuspended(FieldHost, { props })

const two = ['Required when `deliveryMode=email`.', 'Required when the user [asks for a receipt](/docs/receipts).']

describe('conditionEntries', () => {
  it('treats a sentence and a one-entry list as the same input', () => {
    expect(conditionEntries('Required when `capture` is `true`.')).toEqual(['Required when `capture` is `true`.'])
    expect(conditionEntries(['Required when `capture` is `true`.'])).toEqual(['Required when `capture` is `true`.'])
  })

  it('keeps order, drops blank entries and trims authoring whitespace', () => {
    expect(conditionEntries(['  ', two[0]!, '', ` ${two[1]!} `])).toEqual(two)
  })

  it('yields nothing for an absent, blank or empty condition', () => {
    for (const condition of [undefined, '', '   ', [], ['', ' ']]) {
      expect(conditionEntries(condition)).toEqual([])
    }
  })
})

describe('fieldRequiredState with list conditions', () => {
  it('keeps the priority: explicit required wins, then conditional or any real entry', () => {
    expect(fieldRequiredState({ required: true, condition: two })).toBe('required')
    expect(fieldRequiredState({ required: 'conditional' })).toBe('conditional')
    expect(fieldRequiredState({ required: 'conditional', condition: [] })).toBe('conditional')
    expect(fieldRequiredState({ condition: two })).toBe('conditional')
    expect(fieldRequiredState({ condition: [two[0]!] })).toBe('conditional')
  })

  it('never derives Conditional from the truthiness of an empty or blank list', () => {
    expect(fieldRequiredState({ condition: [] })).toBeNull()
    expect(fieldRequiredState({ condition: ['', '  '] })).toBeNull()
    expect(fieldRequiredState({ required: false, condition: [] })).toBeNull()
  })
})

describe('presence derivation with list conditions', () => {
  it('normalises the prose and leaves the notation untouched', () => {
    const notation = describeFieldPresence({ optional: true, nullable: true, condition: [' ', ...two] })
    expect(notation).toEqual({ optional: true, unionTail: ['null'], condition: two })
    expect(describeFieldPresence({ optional: true, condition: [] }).condition).toEqual([])
  })

  it('counts only real entries as value detail', () => {
    expect(hasValueDetail({ relation: 'item', type: 'object', presence: { condition: [] } })).toBe(false)
    expect(hasValueDetail({ relation: 'item', type: 'object', presence: { condition: [' ', 'Absent for drafts.'] } })).toBe(true)
    const block = describeValueRequirements(
      { relation: 'item', type: 'object', presence: { condition: two } },
      fieldValueLabelDefaults,
    )
    expect(block?.presence.condition).toEqual(two)
    expect(block?.compact).toBe(false)
  })
})

describe('FieldItem request condition list', () => {
  it('renders a one-entry list exactly like the plain string', async () => {
    const asString = await mountSuspended(FieldItem, {
      props: { name: 'teamId', type: 'string', condition: two[0] },
    })
    const asList = await mountSuspended(FieldItem, {
      props: { name: 'teamId', type: 'string', condition: [two[0]!] },
    })
    expect(asList.get('[data-field-condition]').html()).toBe(asString.get('[data-field-condition]').html())
    expect(asList.find('[data-condition-list]').exists()).toBe(false)
    expect(asList.get('[data-field-requiredness]').text()).toBe('Conditional')
  })

  it('renders several entries as one amber rule holding one list, in order, with inline markdown per entry', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'contactEmail', type: 'string', required: 'conditional', condition: two },
    })

    const rules = wrapper.findAll('[data-field-condition]')
    expect(rules).toHaveLength(1)
    const rule = rules[0]!
    expect(rule.classes()).toContain('border-warning')

    const list = rule.get('[data-condition-list]')
    expect(list.element.tagName).toBe('UL')
    expect(list.attributes('role')).toBe('list')
    const items = list.findAll('li')
    expect(items.map(item => item.text())).toEqual([
      'Required when deliveryMode=email.',
      'Required when the user asks for a receipt.',
    ])
    // Each entry keeps the inline renderer's code and link, so no consumer needs HTML or a newline hack.
    expect(items[0]!.find('code').text()).toBe('deliveryMode=email')
    expect(items[1]!.get('a').attributes('href')).toBe('/docs/receipts')
    expect(items.map(item => item.classes())).toEqual(items.map(() => expect.arrayContaining(['wrap-anywhere', 'min-w-0'])))
    // The marker stays the neutral grey: the border already carries the amber axis.
    expect(list.classes()).toContain('marker:text-muted')

    // Exactly one summary marker, and the word appears there only (no lead-in inside the rule).
    expect(wrapper.findAll('[data-field-requiredness]')).toHaveLength(1)
    expect(wrapper.get('[data-field-requiredness]').text()).toBe('Conditional')
    expect(rule.text()).not.toContain('Conditional')
  })

  it('renders nothing for an empty or blank list: no rule, no marker, no detail region', async () => {
    for (const condition of [[], ['', '  ']]) {
      const wrapper = await mountSuspended(FieldItem, {
        props: { name: 'teamId', type: 'string', condition },
      })
      expect(wrapper.find('[data-field-condition]').exists()).toBe(false)
      expect(wrapper.find('[data-field-requiredness]').exists()).toBe(false)
      expect(wrapper.findComponent(InlineMarkdown).exists()).toBe(false)
    }
  })

  it('keeps an explicit conditional marker when the list is empty', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'teamId', type: 'string', required: 'conditional', condition: [] },
    })
    expect(wrapper.get('[data-field-requiredness]').text()).toBe('Conditional')
    expect(wrapper.find('[data-field-condition]').exists()).toBe(false)
  })

  it('applies the same rule to recursive child fields', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'billing',
        type: 'object',
        children: [
          { name: 'province', type: 'string', condition: ['Required when `country` is `US`.', 'Required when `country` is `CA`.'] },
          { name: 'note', type: 'string', condition: [] },
        ],
      },
    })
    const child = wrapper.findAll('[data-field-condition]')
    expect(child).toHaveLength(1)
    expect(child[0]!.findAll('li')).toHaveLength(2)
    expect(wrapper.findAll('[data-field-requiredness]')).toHaveLength(1)
  })
})

describe('FieldItem presence condition list', () => {
  it('renders several entries in the one neutral presence rule and keeps the notation', async () => {
    const wrapper = await mountField({
      name: 'receiptUrl',
      type: 'string',
      presence: {
        optional: true,
        nullable: true,
        empty: '""',
        condition: [
          'Returned only when `status` is `succeeded`.',
          '`null` until the receipt is generated.',
          '`""` when the merchant disabled receipts.',
        ],
      },
    })
    const identity = wrapper.get('[data-field-identity]')
    expect(identity.get('code').text()).toBe('receiptUrl?')
    expect(identity.get('[data-field-type]').text()).toBe('string | null | ""')

    const rules = wrapper.findAll('[data-field-presence-condition]')
    expect(rules).toHaveLength(1)
    expect(rules[0]!.classes()).toContain('border-accented')
    expect(rules[0]!.classes()).not.toContain('border-warning')
    expect(rules[0]!.findAll('[data-condition-list] li')).toHaveLength(3)
    expect(wrapper.find('[data-field-requiredness]').exists()).toBe(false)
  })

  it('renders no presence rule for an empty list while the notation still shows', async () => {
    const wrapper = await mountField({ name: 'failureCode', type: 'string', presence: { optional: true, condition: [] } })
    expect(wrapper.get('[data-field-identity] code').text()).toBe('failureCode?')
    expect(wrapper.find('[data-field-presence-condition]').exists()).toBe(false)
  })

  it('renders a value node presence list under the value scope', async () => {
    const wrapper = await mountField({
      name: 'items',
      type: 'array',
      value: {
        relation: 'item',
        type: 'object',
        presence: { nullable: true, condition: ['`null` when the SKU was retired.', '`null` while the item is being re-priced.'] },
        fields: [{ path: 'sku', name: 'sku', type: 'string' }],
      },
    })
    const scope = wrapper.get('[data-value-requirements] [data-value-presence]')
    expect(scope.get('p').text()).toBe('object | null')
    expect(scope.findAll('[data-value-presence-condition]')).toHaveLength(1)
    expect(scope.findAll('[data-value-presence-condition] li')).toHaveLength(2)
    expect(wrapper.find('[data-field-presence-condition]').exists()).toBe(false)
  })
})

describe('FieldAnnotation with list conditions', () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.restoreAllMocks()
  })
  function panel(): HTMLElement | null {
    return document.querySelector<HTMLElement>('div[tabindex="-1"][class*="w-72"]')
  }
  async function open(w: VueWrapper) {
    await w.get('button[type="button"]').trigger('click')
    await vi.waitFor(() => {
      if (!panel()) throw new Error('annotation panel did not open')
    })
  }

  it('tags a list condition Conditional and an empty list not at all, exactly like the row', async () => {
    wrapper = await mountSuspended(FieldAnnotation, {
      props: { field: { path: 'body_teamId', name: 'teamId', type: 'string', condition: two } },
      attachTo: document.body,
    })
    await open(wrapper)
    expect(panel()!.textContent).toContain('Conditional')
    wrapper.unmount()

    wrapper = await mountSuspended(FieldAnnotation, {
      props: { field: { path: 'body_teamId', name: 'teamId', type: 'string', condition: [] } },
      attachTo: document.body,
    })
    await open(wrapper)
    expect(panel()!.textContent).not.toContain('Conditional')
  })
})
