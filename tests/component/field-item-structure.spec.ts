// Structural contract for the FieldItem row — layout, not copy (chrome strings
// live in chrome-labels.spec.ts): the container-width responsive summary
// (identity vs trailing-fact zones, atomic qualifier cluster, compact badge
// tier) and the kind-based routing of notes into the constraints band vs the
// caveat callout.
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import LifecycleBadge from '../../kits/api-docs/components/LifecycleBadge.vue'

describe('FieldItem summary layout', () => {
  it('keeps lifecycle status compact within the field identity', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'gitSource',
        type: 'object',
        required: 'conditional',
        lifecycle: { status: 'beta' as const },
      },
    })

    const badge = wrapper.findComponent(LifecycleBadge)

    // The compact tier must reach the Nuxt UI primitive rather than stop at
    // the kit wrapper. `sm` keeps lifecycle secondary to the field signature.
    expect(badge.props('size')).toBe('sm')
    expect(badge.findComponent({ name: 'UBadge' }).props('size')).toBe('sm')

    // Call-site compactness classes (ours — Nuxt UI's internal sizing classes
    // are its own implementation detail and are not asserted here).
    expect(badge.attributes('class')).toContain('rounded-sm')
    expect(badge.attributes('class')).toContain('shrink-0')

    // Requiredness and lifecycle form one atomic qualifier cluster so flex
    // wrapping cannot leave the lifecycle badge on a row by itself.
    const identity = wrapper.find('[data-field-identity]')
    const qualifiers = identity.find('[data-field-qualifiers]')
    expect(wrapper.classes()).toContain('@container/field')
    expect(identity.text()).toContain('gitSource')
    expect(identity.text()).toContain('object')
    expect(qualifiers.classes()).toEqual(expect.arrayContaining(['inline-flex', 'shrink-0', 'items-center']))
    expect(qualifiers.find('[data-field-requiredness]').text()).toBe('Conditional')
    expect(qualifiers.findComponent(LifecycleBadge).exists()).toBe(true)
    expect(wrapper.find('[data-field-facts]').exists()).toBe(false)
  })

  it('keeps requiredness beside the type when no trailing facts exist', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'amount', type: 'integer', required: true },
    })

    expect(wrapper.find('[data-field-identity]').text()).toContain('amountintegerRequired')
    expect(wrapper.find('[data-field-facts]').exists()).toBe(false)
  })

  it('keeps lifecycle with a long identity and separates only the default fact', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'an_uninterrupted_field_name_that_must_keep_its_own_width_budget',
        type: 'string',
        format: 'vendor-specific-format-with-a-long-name',
        defaultValue: 'a-default-value-that-must-wrap-within-the-facts-zone',
        lifecycle: { status: 'new' as const },
      },
    })

    expect(wrapper.find('[data-field-identity] code').classes()).toContain('wrap-anywhere')
    expect(wrapper.find('[data-field-identity] [data-field-lifecycle]').exists()).toBe(true)
    expect(wrapper.find('[data-field-facts] code').classes()).toContain('wrap-anywhere')
    expect(wrapper.find('[data-field-summary]').classes()).toContain('@md/field:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')
  })

  it('keeps a full-width identity column when no default fact is rendered', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'transactionSettlementInstruction',
        type: 'object',
        lifecycle: { status: 'beta' as const },
      },
    })

    expect(wrapper.find('[data-field-facts]').exists()).toBe(false)
    expect(wrapper.find('[data-field-summary]').classes()).not.toContain('@md/field:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')
  })
})

describe('FieldItem note category routing', () => {
  it('uses kind as the single note category and defaults omitted kind to constraint', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'metadata',
        type: 'object',
        notes: [
          { text: 'Default constraint.' },
          { kind: 'constraint', text: 'Explicit constraint.' },
          { kind: 'caveat', text: 'Behavioral caveat.' },
        ],
      },
    })

    const constraints = wrapper.get('[data-field-constraints]')
    const caveat = wrapper.get('[data-field-caveat]')
    expect(constraints.text()).toContain('Default constraint.')
    expect(constraints.text()).toContain('Explicit constraint.')
    expect(constraints.text()).not.toContain('Behavioral caveat.')
    expect(constraints.text()).toContain('(2)')
    expect(caveat.text()).toContain('Behavioral caveat.')
  })
})
