// Output presence contract (issue #127): a response / webhook field can state
// that its key may be omitted, its value may be null, or its value may be
// empty — three independent facts, rendered as TYPE NOTATION (`name?`,
// `string | null | ""`) with the applicable condition in its own rule, never
// folded into the constraints band. The pure derivation in `utils/field.ts`
// is asserted without a DOM; the mounted cases pin the row's promises: no
// inference from request markers, request and output facts coexisting, the
// field / value boundary in both directions, no vocabulary to localize, and
// the FieldAnnotation popover agreeing with the row.
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import FieldAnnotation from '../../kits/api-docs/components/FieldAnnotation.vue'
import {
  describeFieldPresence,
  describeValuePresence,
  describeValueRequirements,
  fieldValueLabelDefaults,
  presenceTypeExpression,
} from '../../kits/api-docs/utils/field'
import type { FieldNode, FieldPresence, ValuePresence } from '../../kits/api-docs/utils/field'

/** The row's own identity line (never a nested value's). */
function identity(wrapper: VueWrapper) {
  return wrapper.get('[data-field-identity]')
}
function nameText(wrapper: VueWrapper) {
  return identity(wrapper).get('code').text()
}
function typeText(wrapper: VueWrapper) {
  return identity(wrapper).get('[data-field-type]').text()
}

describe('describeFieldPresence', () => {
  it('yields no notation for an absent or all-false presence — the unmarked row is "always present"', () => {
    for (const presence of [undefined, {}, { optional: false, nullable: false }]) {
      expect(describeFieldPresence(presence)).toEqual({ optional: false, unionTail: [], condition: undefined })
    }
  })

  it('keeps the three facts independent: `?` for the key, `null` then the literal empty form for the value', () => {
    const presence: FieldPresence = { empty: '""', nullable: true, optional: true }
    expect(describeFieldPresence(presence)).toEqual({ optional: true, unionTail: ['null', '""'], condition: undefined })
    expect(describeFieldPresence({ nullable: true })).toEqual({ optional: false, unionTail: ['null'], condition: undefined })
    expect(describeFieldPresence({ optional: true })).toEqual({ optional: true, unionTail: [], condition: undefined })
  })

  it('takes the literal empty form verbatim — `[]` and `"[]"` are different facts', () => {
    expect(describeFieldPresence({ empty: '[]' }).unionTail).toEqual(['[]'])
    expect(describeFieldPresence({ empty: '"[]"' }).unionTail).toEqual(['"[]"'])
  })

  it('treats a blank empty form as not stated — "empty" must be spelled out', () => {
    expect(describeFieldPresence({ empty: '' }).unionTail).toEqual([])
    expect(describeFieldPresence({ empty: '  ' }).unionTail).toEqual([])
    // Surrounding whitespace is authoring noise, not part of the literal form.
    expect(describeFieldPresence({ empty: ' "" ' }).unionTail).toEqual(['""'])
  })

  it('carries the condition through unchanged', () => {
    expect(describeFieldPresence({ condition: 'Absent for drafts.' }).condition).toBe('Absent for drafts.')
  })

  it('never reads omittability off a value node', () => {
    // `optional` is typed out of ValuePresence; a JavaScript caller that
    // smuggles it in still gets no `?`, because a value has no key to omit.
    const smuggled = { optional: true, nullable: true } as ValuePresence
    expect(describeValuePresence(smuggled)).toEqual({ optional: false, unionTail: ['null'], condition: undefined })
    expect(describeValuePresence(undefined)).toEqual({ optional: false, unionTail: [] })
  })

  it('composes the type expression, and states the bare tail when a value has no declared type', () => {
    expect(presenceTypeExpression('string', ['null', '""'])).toBe('string | null | ""')
    expect(presenceTypeExpression('string', [])).toBe('string')
    expect(presenceTypeExpression(undefined, ['null'])).toBe('null')
  })

  it('counts as value detail and escalates the scope block past compact', () => {
    const chrome = fieldValueLabelDefaults
    const block = describeValueRequirements({ relation: 'item', type: 'object', presence: { nullable: true } }, chrome)
    expect(block?.presence.unionTail).toEqual(['null'])
    expect(block?.compact).toBe(false)
    const conditionOnly = describeValueRequirements(
      { relation: 'item', type: 'object', presence: { condition: 'Absent for drafts.' } },
      chrome,
    )
    expect(conditionOnly?.presence.condition).toBe('Absent for drafts.')
  })
})

describe('FieldItem output presence', () => {
  it('renders plain name and type for a field without presence, and infers nothing from a missing request marker', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'id', type: 'string', required: false, description: 'Always present.' },
    })
    expect(nameText(wrapper)).toBe('id')
    expect(typeText(wrapper)).toBe('string')
    expect(wrapper.find('[data-field-optional]').exists()).toBe(false)
    expect(wrapper.find('[data-field-presence-condition]').exists()).toBe(false)
    expect(wrapper.find('[data-field-requiredness]').exists()).toBe(false)
  })

  it('marks a lone nullable fact in the type only', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'settledAt', type: 'integer', format: 'unix_ms', presence: { nullable: true } },
    })
    expect(nameText(wrapper)).toBe('settledAt')
    expect(typeText(wrapper)).toBe('integer | null')
    // Notation sits in the type's own grey register, never in the coloured qualifier cluster.
    const type = identity(wrapper).get('[data-field-type]')
    expect(type.classes()).toContain('text-muted')
    // Same wrapping contract as the popover's type span: shrinkable, breakable, never pinned.
    expect(type.classes()).toEqual(expect.arrayContaining(['wrap-anywhere', 'min-w-0']))
    expect(type.classes()).not.toContain('shrink-0')
    expect(wrapper.find('[data-field-qualifiers]').exists()).toBe(false)
    expect(wrapper.find('[data-field-presence-condition]').exists()).toBe(false)
  })

  it('marks a lone optional fact on the name only', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'failureCode', type: 'string', presence: { optional: true } },
    })
    // Visual `?` is hidden from AT (bare punctuation is not announced); the
    // sr-only phrase is the one localizable presence string.
    expect(nameText(wrapper)).toBe('failureCode? (may be omitted)')
    const mark = identity(wrapper).get('[data-field-optional]')
    expect(mark.text()).toBe('?')
    expect(mark.attributes('aria-hidden')).toBe('true')
    expect(mark.classes()).toContain('text-dimmed')
    expect(identity(wrapper).get('code .sr-only').text()).toBe('(may be omitted)')
    expect(typeText(wrapper)).toBe('string')
  })

  it('combines independent facts, shows the condition once in its own rule and never as a constraint', async () => {
    const condition = 'Omitted until `state` is `READY`; `null` while the build is queued.'
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'url',
        type: 'string',
        presence: { optional: true, nullable: true, empty: '""', condition },
        notes: [{ label: 'Format', text: 'Absolute https URL.' }],
      },
    })
    expect(nameText(wrapper)).toBe('url? (may be omitted)')
    // `""` and `[]` never collapse into one word: the literal form is the notation.
    expect(typeText(wrapper)).toBe('string | null | ""')

    const rule = wrapper.get('[data-field-presence-condition]')
    expect(rule.text()).toContain('Omitted until')
    // Neutral border: presence is a payload fact, not the amber required-strength axis.
    expect(rule.classes()).toContain('border-accented')
    expect(rule.classes()).not.toContain('border-warning')
    // Exactly one occurrence — not repeated in the constraints band or anywhere else.
    expect(wrapper.text().split('Omitted until')).toHaveLength(2)
    expect(wrapper.get('[data-field-constraints]').text()).not.toContain('Omitted until')
  })

  it('still renders an author\'s condition when no fact is marked at all', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'note', type: 'string', presence: { condition: 'Absent for drafts.' } },
    })
    expect(nameText(wrapper)).toBe('note')
    expect(typeText(wrapper)).toBe('string')
    expect(wrapper.get('[data-field-presence-condition]').text()).toBe('Absent for drafts.')
  })

  it('keeps request requiredness and output presence as two separate facts', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'amount',
        type: 'integer',
        required: 'conditional',
        condition: 'Required when `capture` is `true`.',
        presence: { nullable: true, condition: '`null` for authorizations that never captured.' },
      },
    })
    expect(wrapper.get('[data-field-requiredness]').text()).toBe('Conditional')
    expect(typeText(wrapper)).toBe('integer | null')
    expect(wrapper.get('[data-field-condition]').classes()).toContain('border-warning')
    expect(wrapper.get('[data-field-presence-condition]').classes()).toContain('border-accented')
  })

  it('keeps the field / value boundary in both directions', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'items',
        type: 'array',
        presence: { optional: true },
        value: {
          relation: 'item',
          type: 'object',
          presence: { nullable: true, condition: 'An element is `null` when the SKU was retired.' },
          fields: [{ path: 'sku', name: 'sku', type: 'string' }],
        },
      },
    })
    // The field row says only what the FIELD says.
    expect(nameText(wrapper)).toBe('items? (may be omitted)')
    expect(typeText(wrapper)).toBe('array')
    expect(wrapper.find('[data-field-presence-condition]').exists()).toBe(false)
    // The element's facts render under the element's scope, as the element's type.
    const scope = wrapper.get('[data-value-requirements] [data-value-presence]')
    expect(scope.get('p').text()).toBe('object | null')
    expect(scope.get('[data-value-presence-condition]').text()).toContain('retired')
    expect(scope.find('[data-field-optional]').exists()).toBe(false)
  })

  it('states an encoded empty container under the decoded scope, not on the wire type', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'products',
        type: 'string',
        format: 'json_string',
        value: { relation: 'decoded', codec: 'json', type: 'object[]', presence: { empty: '"[]"' } },
      },
    })
    expect(typeText(wrapper)).toBe('string')
    const scope = wrapper.get('[data-value-requirements]')
    // Decoded root is an array, so the scope reads as the array's requirements.
    expect(scope.text()).toContain('Array')
    expect(scope.get('[data-value-presence] p').text()).toBe('object[] | "[]"')
  })

  it('needs one label at most: notation is language-neutral and reaches recursive rows unchanged', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'data',
        type: 'object',
        presence: { optional: true, nullable: true },
        labels: { required: '必填', mayBeOmitted: '可省略' },
        children: [{ name: 'note', type: 'string', presence: { empty: '""' } }],
      },
    })
    expect(nameText(wrapper)).toBe('data? (可省略)')
    expect(typeText(wrapper)).toBe('object | null')
    const child = wrapper.findAllComponents(FieldItem).find(row => row.props('name') === 'note')!
    expect(nameText(child)).toBe('note')
    expect(typeText(child)).toBe('string | ""')
  })
})

describe('FieldAnnotation output presence', () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  function panel(): HTMLElement | null {
    return document.querySelector<HTMLElement>('div[tabindex="-1"][class*="w-72"]')
  }

  it('previews the same notation the row renders', async () => {
    const field: FieldNode = {
      path: 'res_url',
      name: 'url',
      type: 'string',
      presence: { optional: true, empty: '""', condition: 'Omitted until `state` is `READY`.' },
    }
    const Host = defineComponent({
      components: { FieldAnnotation },
      setup: () => ({ field }),
      template: '<FieldAnnotation :field="field" :labels="{ mayBeOmitted: \'可省略\' }" />',
    })
    wrapper = await mountSuspended(Host, { attachTo: document.body })
    await wrapper.get('button[type="button"]').trigger('click')
    await vi.waitFor(() => {
      if (!panel()) throw new Error('annotation panel did not open')
    })
    expect(panel()!.querySelector('code')?.textContent).toBe('url? (可省略)')
    expect(panel()!.querySelector('[data-field-optional]')?.getAttribute('aria-hidden')).toBe('true')
    expect(panel()!.querySelector('[data-field-type]')?.textContent).toBe('string | ""')
    // A summary, not the row: the presence condition stays in the row's detail.
    expect(panel()!.querySelector('[data-field-presence-condition]')).toBeNull()
    expect(panel()!.textContent).not.toContain('Omitted until')
  })
})
