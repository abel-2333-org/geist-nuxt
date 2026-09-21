// Output presence contract (issue #127): a response / webhook field can state
// that its key may be omitted, its value may be null, or its value may be
// empty — three independent facts, rendered as TYPE NOTATION (`name?`,
// `string | null | ""`) with the applicable condition in its own rule, never
// folded into the constraints band. The pure derivation in `utils/field.ts`
// is asserted without a DOM; the mounted cases pin the row's promises: no
// inference from request markers, request and output facts coexisting, the
// field / value boundary in both directions, no vocabulary to localize, and
// the FieldAnnotation popover agreeing with the row.
//
// Issue #133 adds the in-place explanation: the row's `?` is a tooltip trigger
// (hover + keyboard focus) named by the same `mayBeOmitted` label. Pinned here
// because each promise is invisible to CSS review: exactly one focus stop per
// omittable key and none otherwise, the sentence announced once (name, not
// name + description), and the notation kept out of a copied field name.
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { UApp } from '#components'
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

// The `?` trigger is a UTooltip, which needs the app-level provider — the same
// <UApp> every consumer already mounts for the kit's other tooltips.
const FieldHost = defineComponent({
  components: { FieldItem, UApp },
  inheritAttrs: false,
  template: '<UApp><FieldItem v-bind="$attrs" /></UApp>',
})
const mountField = (props: Record<string, unknown>, options: Parameters<typeof mountSuspended>[1] = {}) =>
  mountSuspended(FieldHost, { ...options, props })

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
    const wrapper = await mountField({ name: 'failureCode', type: 'string', presence: { optional: true } })
    expect(nameText(wrapper)).toBe('failureCode?')
    const mark = identity(wrapper).get('[data-field-optional]')
    // Kit tap-target touch contract: the marker is a real <button> and joins it.
    expect(mark.classes()).toContain('touch-manipulation')
    expect(mark.text()).toBe('?')
    // Low visual weight: notation in the grey register, never a badge — but
    // the readable grey: the glyph states a fact, so it must clear WCAG 1.4.3
    // on the light theme, which `text-dimmed` (~2.4:1) does not.
    expect(mark.classes()).toContain('text-toned')
    expect(mark.classes()).not.toContain('text-dimmed')
    expect(typeText(wrapper)).toBe('string')
  })

  it('combines independent facts, shows the condition once in its own rule and never as a constraint', async () => {
    const condition = 'Omitted until `state` is `READY`; `null` while the build is queued.'
    const wrapper = await mountField({
      name: 'url',
      type: 'string',
      presence: { optional: true, nullable: true, empty: '""', condition },
      notes: [{ label: 'Format', text: 'Absolute https URL.' }],
    })
    expect(nameText(wrapper)).toBe('url?')
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
    const wrapper = await mountField({
      name: 'items',
      type: 'array',
      presence: { optional: true },
      value: {
        relation: 'item',
        type: 'object',
        presence: { nullable: true, condition: 'An element is `null` when the SKU was retired.' },
        fields: [{ path: 'sku', name: 'sku', type: 'string' }],
      },
    })
    // The field row says only what the FIELD says.
    expect(nameText(wrapper)).toBe('items?')
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
    const wrapper = await mountField({
      name: 'data',
      type: 'object',
      presence: { optional: true, nullable: true },
      labels: { required: '必填', mayBeOmitted: '可省略' },
      children: [{ name: 'note', type: 'string', presence: { empty: '""' } }],
    })
    expect(nameText(wrapper)).toBe('data?')
    expect(identity(wrapper).get('[data-field-optional]').attributes('aria-label')).toBe('可省略')
    expect(typeText(wrapper)).toBe('object | null')
    const child = wrapper.findAllComponents(FieldItem).find(row => row.props('name') === 'note')!
    expect(nameText(child)).toBe('note')
    expect(typeText(child)).toBe('string | ""')
  })
})

describe('FieldItem omittable-key explanation (issue #133)', () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const tooltip = () => document.querySelector<HTMLElement>('[role="tooltip"]')
  const focusStops = (row: VueWrapper) => row.findAll('button, a[href], [tabindex]:not([tabindex="-1"])')

  it('costs exactly one focus stop on an omittable key, and none on any other row', async () => {
    const plain = await mountField({ path: 'id', name: 'id', type: 'string', presence: { nullable: true } })
    const before = focusStops(plain).length
    expect(plain.find('[data-field-optional]').exists()).toBe(false)
    plain.unmount()

    wrapper = await mountField({ path: 'id', name: 'id', type: 'string', presence: { optional: true, nullable: true } })
    expect(focusStops(wrapper)).toHaveLength(before + 1)
    const mark = wrapper.get('[data-field-optional]')
    expect(mark.element.tagName).toBe('BUTTON')
    expect(mark.attributes('type')).toBe('button')
  })

  it('names the trigger with the explanation, so punctuation is never announced as part of the field name', async () => {
    wrapper = await mountField({ name: 'failureCode', type: 'string', presence: { optional: true } })
    const mark = wrapper.get('[data-field-optional]')
    expect(mark.attributes('aria-label')).toBe('may be omitted')
    expect(mark.attributes('aria-hidden')).toBeUndefined()
    // The name now lives on the trigger: a second hidden copy would be read twice.
    expect(identity(wrapper).find('code .sr-only').exists()).toBe(false)
  })

  it('opens on keyboard focus with the injected copy, announces it once, and closes on Escape and on blur', async () => {
    wrapper = await mountField(
      { name: 'failureCode', type: 'string', presence: { optional: true }, labels: { mayBeOmitted: '可省略' } },
      { attachTo: document.body },
    )
    const mark = wrapper.get('[data-field-optional]')
    expect(tooltip()).toBeNull()

    await mark.trigger('focus')
    await vi.waitFor(() => {
      if (!tooltip()) throw new Error('tooltip did not open on focus')
    })
    expect(tooltip()!.textContent).toBe('可省略')
    // `role="tooltip"` is the primitive's hidden mirror; the panel a sighted
    // reader sees must carry the same injected sentence.
    expect(document.querySelector('[data-slot="text"]')?.textContent).toBe('可省略')
    // Name and tooltip are the same sentence: exposing it as a description too
    // would make a screen reader say it twice.
    expect(mark.attributes('aria-label')).toBe('可省略')
    expect(mark.attributes('aria-describedby')).toBeUndefined()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => {
      if (tooltip()) throw new Error('tooltip stayed open after Escape')
    })

    await mark.trigger('focus')
    await vi.waitFor(() => {
      if (!tooltip()) throw new Error('tooltip did not reopen')
    })
    await mark.trigger('blur')
    await vi.waitFor(() => {
      if (tooltip()) throw new Error('tooltip stayed open after blur')
    })
  })

  it('keeps the row notation out of a selection, so a copied field name is the bare name', async () => {
    wrapper = await mountField({ name: 'failureCode', type: 'string', presence: { optional: true } })
    expect(wrapper.get('[data-field-optional]').classes()).toContain('select-none')
  })

  it('does not let a click dismiss the explanation: the trigger has no other action', async () => {
    wrapper = await mountField(
      { name: 'failureCode', type: 'string', presence: { optional: true } },
      { attachTo: document.body },
    )
    const mark = wrapper.get('[data-field-optional]')
    await mark.trigger('focus')
    await vi.waitFor(() => {
      if (!tooltip()) throw new Error('tooltip did not open on focus')
    })
    await mark.trigger('click')
    // The primitive closes synchronously; the pause only gives the portal
    // time to unmount, so a regression cannot hide behind a pending teardown.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(tooltip()).not.toBeNull()
  })

  it('marks focus with a fill in normal rendering and an outline in forced colors — neither may be "cleaned up"', async () => {
    wrapper = await mountField({ name: 'failureCode', type: 'string', presence: { optional: true } })
    const classes = wrapper.get('[data-field-optional]').classes()
    // Focus lights the glyph's own box (no offset ring to land on the field
    // name). The fill is the ONLY visible indicator in normal rendering; the
    // transparent outline is the only one left once Windows High Contrast
    // strips backgrounds. happy-dom can render neither, so the classes are
    // the contract.
    expect(classes).toContain('focus-visible:bg-primary')
    expect(classes).toContain('focus-visible:text-inverted')
    expect(classes).toContain('focus-visible:outline-2')
    expect(classes).toContain('focus-visible:outline-transparent')
    expect(classes.some(name => name.startsWith('focus-visible:outline-offset'))).toBe(false)
  })

  it('strikes the notation through with a deprecated name — a button is an atomic inline box the name\'s decoration skips', async () => {
    wrapper = await mountField({
      name: 'legacyCode',
      type: 'string',
      presence: { optional: true },
      lifecycle: { status: 'deprecated' },
    })
    expect(identity(wrapper).get('code').classes()).toContain('line-through')
    expect(wrapper.get('[data-field-optional]').classes()).toContain('line-through')
  })

  it('reaches recursive rows: each omittable descendant owns its own trigger', async () => {
    wrapper = await mountField({
      name: 'data',
      type: 'object',
      children: [
        { name: 'note', type: 'string', presence: { optional: true } },
        { name: 'id', type: 'string' },
      ],
    })
    const rows = wrapper.findAllComponents(FieldItem)
    const note = rows.find(row => row.props('name') === 'note')!
    const id = rows.find(row => row.props('name') === 'id')!
    expect(identity(note).find('button[data-field-optional]').exists()).toBe(true)
    expect(identity(id).find('[data-field-optional]').exists()).toBe(false)
    expect(identity(wrapper).find('[data-field-optional]').exists()).toBe(false)
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
    // The preview is already a floating layer: its `?` stays plain text (no
    // nested tooltip, no focus stop) and keeps the screen-reader sentence —
    // both kept out of a copied name.
    const mark = panel()!.querySelector('[data-field-optional]')!
    expect(mark.tagName).toBe('SPAN')
    expect(mark.getAttribute('aria-hidden')).toBe('true')
    expect(mark.classList.contains('select-none')).toBe(true)
    // Same grey as the row's `?`: the preview must not drift back to the
    // dimmest tier the row left for WCAG 1.4.3.
    expect(mark.classList.contains('text-toned')).toBe(true)
    expect(mark.classList.contains('text-dimmed')).toBe(false)
    expect(panel()!.querySelector('code .sr-only')?.classList.contains('select-none')).toBe(true)
    expect(panel()!.querySelector('code button')).toBeNull()
    expect(panel()!.querySelector('[data-field-type]')?.textContent).toBe('string | ""')
    // A summary, not the row: the presence condition stays in the row's detail.
    expect(panel()!.querySelector('[data-field-presence-condition]')).toBeNull()
    expect(panel()!.textContent).not.toContain('Omitted until')
  })
})
