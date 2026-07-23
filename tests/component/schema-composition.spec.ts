import { defineComponent, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import SchemaComposition from '../../playground/components/SchemaComposition.vue'
import type { CompositionNode } from '../../playground/components/SchemaComposition.vue'
import { useActiveFieldPath, useFieldAnchor } from '../../kits/api-docs/composables/useFieldAnchor'

function tabs(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: 'UTabs' })
}

describe('PlaygroundSchemaComposition', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('aggregates N:1 and empty discriminator values into an existing first field', async () => {
    const node: CompositionNode = {
      kind: 'oneOf',
      discriminator: {
        propertyName: 'type',
        mapping: [
          { value: 'card', variantId: 'card' },
          { value: '', variantId: 'card' },
          { value: 'saved_card', variantId: 'card' },
        ],
      },
      variants: [{
        id: 'card',
        label: 'Card',
        fields: [
          { path: 'token', name: 'token', type: 'string' },
          {
            path: 'card_type',
            name: 'type',
            type: 'enum',
            required: false,
            description: 'Existing metadata.',
            examples: ['card'],
          },
        ],
      }],
    }

    const wrapper = await mountSuspended(SchemaComposition, { props: node })
    const fieldNames = wrapper.findAll('code').map(code => code.text())

    expect(fieldNames[0]).toBe('type')
    expect(wrapper.find('#card_type').exists()).toBe(true)
    expect(wrapper.text()).toContain('One of card, "", saved_card. Existing metadata.')
    expect(wrapper.text()).toContain('Required')
  })

  it('keeps invalid runtime discriminator data out of allOf fields', async () => {
    const wrapper = await mountSuspended(SchemaComposition, {
      props: {
        kind: 'allOf',
        discriminator: {
          propertyName: 'type',
          mapping: [{ value: 'ignored', variantId: 'base' }],
        },
        variants: [{
          id: 'base',
          label: 'Base',
          fields: [{ name: 'id', type: 'string' }],
        }],
      } as never,
    })

    expect(wrapper.text()).toContain('id')
    expect(wrapper.text()).not.toContain('Always')
    expect(wrapper.findAll('code').map(code => code.text())).not.toContain('type')
  })

  it('puts disclosure ARIA on the anyOf button and toggles sections independently', async () => {
    const node: CompositionNode = {
      kind: 'anyOf',
      variants: [
        { id: 'email/primary', label: 'Email', fields: [{ name: 'email', type: 'string' }] },
        { id: 'phone', label: 'Phone', fields: [{ name: 'phone', type: 'string' }] },
      ],
    }
    const wrapper = await mountSuspended(SchemaComposition, { props: node })
    const headings = wrapper.findAll('h4')
    const buttons = wrapper.findAll('h4 > button')

    expect(headings[0]?.attributes('aria-expanded')).toBeUndefined()
    expect(buttons[0]?.attributes('aria-expanded')).toBe('false')
    expect(buttons[0]?.attributes('aria-controls')).toBeTruthy()
    const contentId = buttons[0]!.attributes('aria-controls')!
    expect(contentId).toContain('email%2Fprimary')
    expect(wrapper.findAll('[id]').some(node => node.attributes('id') === contentId)).toBe(true)
    expect(buttons[0]?.text()).toBe('Email(1)')
    expect(buttons[0]?.text()).not.toMatch(/Show|Hide/)

    await buttons[0]!.trigger('click')
    expect(buttons[0]?.attributes('aria-expanded')).toBe('true')
    expect(buttons[1]?.attributes('aria-expanded')).toBe('false')
  })

  it('replays the same deep-link event after a tab or disclosure is hidden again', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0))

    const oneOf: CompositionNode = {
      kind: 'oneOf',
      variants: [
        { id: 'short', label: 'Short', fields: [{ path: 'item', name: 'item', type: 'string' }] },
        {
          id: 'detail',
          label: 'Detail',
          fields: [{
            path: 'item_detail',
            name: 'detail',
            type: 'object',
            children: [{ path: 'item_detail_child', name: 'child', type: 'string' }],
          }],
        },
      ],
    }
    const anyOf: CompositionNode = {
      kind: 'anyOf',
      variants: [
        { id: 'email', label: 'Email', fields: [{ path: 'email', name: 'email', type: 'string' }] },
        { id: 'phone', label: 'Phone', fields: [{ path: 'phone', name: 'phone', type: 'string' }] },
      ],
    }
    const Host = defineComponent({
      components: { SchemaComposition },
      setup() {
        const anchor = useFieldAnchor()
        anchor.active.value = ''
        return {
          anyOf,
          oneOf,
          goDetail: () => { void anchor.goTo('item_detail_child', { updateHash: false }) },
          goPhone: () => { void anchor.goTo('phone', { updateHash: false }) },
        }
      },
      template: `
        <button data-testid="detail-link" @click="goDetail">Detail link</button>
        <button data-testid="phone-link" @click="goPhone">Phone link</button>
        <SchemaComposition v-bind="oneOf" />
        <SchemaComposition v-bind="anyOf" />
      `,
    })
    const wrapper = await mountSuspended(Host)
    const compositions = wrapper.findAllComponents(SchemaComposition)
    const oneOfWrapper = compositions[0]!
    const anyOfWrapper = compositions[1]!

    await wrapper.find('[data-testid="detail-link"]').trigger('click')
    expect(tabs(oneOfWrapper).props('modelValue')).toBe('detail')
    let childButton = oneOfWrapper.findAll('button')
      .find(button => button.text().includes('Hide Child Parameters'))
    expect(childButton).toBeTruthy()
    await childButton!.trigger('click')
    expect(oneOfWrapper.text()).toContain('Show Child Parameters')
    tabs(oneOfWrapper).vm.$emit('update:modelValue', 'short')
    await oneOfWrapper.vm.$nextTick()
    expect(tabs(oneOfWrapper).props('modelValue')).toBe('short')
    await wrapper.find('[data-testid="detail-link"]').trigger('click')
    expect(tabs(oneOfWrapper).props('modelValue')).toBe('detail')
    childButton = oneOfWrapper.findAll('button')
      .find(button => button.text().includes('Hide Child Parameters'))
    expect(childButton).toBeTruthy()

    await wrapper.find('[data-testid="phone-link"]').trigger('click')
    let buttons = anyOfWrapper.findAll('h4 > button')
    expect(buttons[1]?.attributes('aria-expanded')).toBe('true')
    await buttons[1]!.trigger('click')
    expect(buttons[1]?.attributes('aria-expanded')).toBe('false')
    await wrapper.find('[data-testid="phone-link"]').trigger('click')
    buttons = anyOfWrapper.findAll('h4 > button')
    expect(buttons[1]?.attributes('aria-expanded')).toBe('true')
  })

  it('counts a nested composition as content and hides zero counts', async () => {
    const wrapper = await mountSuspended(SchemaComposition, {
      props: {
        kind: 'allOf',
        variants: [
          {
            id: 'nested',
            label: 'Nested rule',
            fields: [],
            composition: {
              kind: 'allOf',
              variants: [{ id: 'inner', label: 'Inner', fields: [{ name: 'id', type: 'string' }] }],
            },
          },
          {
            id: 'description',
            label: 'Immutability rule',
            description: 'This value cannot change.',
            fields: [],
          },
        ],
      },
    })
    const headings = wrapper.findAll('h4')

    expect(headings[0]?.text()).toBe('Nested rule (1)')
    expect(headings[1]?.text()).toBe('Immutability rule')
    expect(wrapper.text()).not.toContain('Immutability rule (0)')
  })

  it('prefers exact and longest anchor matches and retries after reactive input changes', async () => {
    const first: CompositionNode = {
      kind: 'oneOf',
      variants: [
        { id: 'short', label: 'Short', fields: [{ path: 'item', name: 'item', type: 'string' }] },
        { id: 'detail', label: 'Detail', fields: [{ path: 'item_detail', name: 'detail', type: 'string' }] },
      ],
    }
    const Host = defineComponent({
      components: { SchemaComposition },
      setup() {
        const node = shallowRef<CompositionNode>(first)
        const active = useActiveFieldPath()
        active.value = ''
        return { active, node }
      },
      template: '<SchemaComposition v-bind="node" />',
    })
    const wrapper = await mountSuspended(Host)

    wrapper.vm.active = 'item_detail'
    await wrapper.vm.$nextTick()
    expect(tabs(wrapper).props('modelValue')).toBe('detail')

    wrapper.vm.active = 'item_detail_child'
    await wrapper.vm.$nextTick()
    expect(tabs(wrapper).props('modelValue')).toBe('detail')

    wrapper.vm.active = 'late_field'
    wrapper.vm.node = {
      kind: 'oneOf',
      variants: [{
        id: 'late',
        label: 'Late',
        fields: [{ path: 'late_field', name: 'late', type: 'string' }],
      }],
    }
    await wrapper.vm.$nextTick()
    expect(tabs(wrapper).props('modelValue')).toBe('late')

    wrapper.vm.node = {
      kind: 'anyOf',
      variants: [{
        id: 'late',
        label: 'Late',
        fields: [{ path: 'late_field', name: 'late', type: 'string' }],
      }],
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('h4 > button').attributes('aria-expanded')).toBe('true')
  })

  it('preserves a valid tab on replacement, falls back when removed, and caps headings at h6', async () => {
    const variants = [
      { id: 'a', label: 'A', fields: [{ name: 'a', type: 'string' }] },
      { id: 'b', label: 'B', fields: [{ name: 'b', type: 'string' }] },
    ]
    const wrapper = await mountSuspended(SchemaComposition, {
      props: { kind: 'oneOf', variants },
    })

    tabs(wrapper).vm.$emit('update:modelValue', 'b')
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ variants: [variants[1]!, { id: 'c', label: 'C', fields: [] }] })
    expect(tabs(wrapper).props('modelValue')).toBe('b')

    await wrapper.setProps({ variants: [{ id: 'c', label: 'C', fields: [] }] })
    expect(tabs(wrapper).props('modelValue')).toBe('c')

    const nested: CompositionNode = {
      kind: 'allOf',
      variants: [{
        id: 'outer',
        label: 'Outer',
        fields: [],
        composition: {
          kind: 'allOf',
          variants: [{ id: 'inner', label: 'Inner', fields: [] }],
        },
      }],
    }
    const headingWrapper = await mountSuspended(SchemaComposition, {
      props: { ...nested, headingLevel: 6 },
    })
    expect(headingWrapper.findAll('h6')).toHaveLength(2)
    expect(headingWrapper.find('h7').exists()).toBe(false)
  })
})
