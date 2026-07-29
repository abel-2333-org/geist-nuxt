// ApiDocsEnumTable structural behavior — everything above the i18n contract
// (that lives in chrome-labels.spec.ts). Covers the variant `when` caption, the
// keyboard-reachable scroll region, the filter live region, and the single
// filter pass shared by tab badges and the rendered body.
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import EnumTable from '../../kits/api-docs/components/EnumTable.vue'

/** ≥ filterThreshold(30) so the filter + bounded scroll box appear. */
const manyValues = Array.from({ length: 30 }, (_, i) => ({
  value: `value_${i}`,
  description: `desc ${i}`,
}))

const variants = [
  {
    title: 'Git deploys',
    when: 'Applies when `gitSource` is set.',
    values: [
      { value: 'BUILDING', description: 'Build running.' },
      { value: 'READY', description: 'Serving traffic.' },
    ],
  },
  {
    title: 'Prebuilt uploads',
    when: 'Applies to a prebuilt output.',
    values: [{ value: 'UPLOADING', description: 'Archive uploading.' }],
  },
]

/** The bounded scroll box; only long lists get one. */
function scrollBox(html: string) {
  return html.includes('max-h-80')
}

describe('variant applicability caption', () => {
  it('renders the active variant `when` and swaps it with the selection', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { variants } })

    const caption = wrapper.get('[data-enum-when]')
    expect(caption.text()).toContain('Applies when gitSource is set.')
    expect(caption.classes()).toContain('wrap-anywhere')
    expect(caption.classes()).toContain('min-w-0')
    expect(wrapper.text()).not.toContain('Applies to a prebuilt output.')

    // `when` is authored copy, so it goes through InlineMarkdown like every
    // other description in this kit — the backticks become inline code.
    expect(wrapper.html()).toContain('<code')

    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', '1')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Applies to a prebuilt output.')
    expect(wrapper.text()).not.toContain('Applies when gitSource is set.')
  })

  it('omits the caption entirely for a variant without `when`', async () => {
    const wrapper = await mountSuspended(EnumTable, {
      props: { variants: [{ title: 'Only group', values: [{ value: 'a', description: '' }] }] },
    })

    expect(wrapper.text()).toContain('Only group')
    expect(wrapper.text()).not.toContain('Applies')
  })
})

describe('scroll region reachability', () => {
  it('gives the bounded scroll box a named tab stop', async () => {
    // Nothing inside the box is focusable, so without this a keyboard-only
    // user cannot scroll past the fold (focus-a11y.md 键盘可达).
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })
    const box = wrapper.find('[role="group"]')

    expect(box.exists()).toBe(true)
    expect(box.attributes('tabindex')).toBe('0')
    expect(box.attributes('aria-label')).toBe('Allowed values')
    expect(box.classes()).toContain('focus-visible:outline-primary')
  })

  it('leaves a short list without a tab stop — it does not scroll', async () => {
    const wrapper = await mountSuspended(EnumTable, {
      props: { values: [{ value: 'a', description: 'only one' }] },
    })

    expect(scrollBox(wrapper.html())).toBe(false)
    expect(wrapper.find('[role="group"]').exists()).toBe(false)
  })
})

describe('filter live region', () => {
  it('announces hit count and the no-match case, staying silent while idle', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })
    const region = wrapper.find('[role="status"]')
    const filter = wrapper.findComponent({ name: 'UInput' })

    expect(region.exists()).toBe(true)
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toBe('')

    filter.vm.$emit('update:modelValue', 'value_1')
    await wrapper.vm.$nextTick()
    // value_1 plus value_10..value_19.
    expect(wrapper.find('[role="status"]').text()).toBe('11 values found')

    filter.vm.$emit('update:modelValue', 'zzz')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').text()).toBe('No matching values for “zzz”')
  })

  it('singularizes a lone hit', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })

    wrapper.findComponent({ name: 'UInput' }).vm.$emit('update:modelValue', 'value_29')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text()).toBe('1 value found')
  })

  it('has no live region when the list is too short to filter', async () => {
    const wrapper = await mountSuspended(EnumTable, {
      props: { values: [{ value: 'a', description: '' }] },
    })

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('clears a query when a reused list becomes too short to filter', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })
    const filter = wrapper.findComponent({ name: 'UInput' })

    filter.vm.$emit('update:modelValue', 'zzz')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('No matching values')

    await wrapper.setProps({ values: [{ value: 'a', description: 'only one' }] })
    expect(wrapper.findComponent({ name: 'UInput' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('only one')
    expect(wrapper.text()).not.toContain('No matching values')
  })
})

describe('variant selection', () => {
  it('badges each tab with its filtered count, matching what the body renders', async () => {
    // Badges and body read one filtered array, so a badge can never claim a
    // count the panel disagrees with.
    const wrapper = await mountSuspended(EnumTable, {
      props: { variants, filterThreshold: 1 },
    })

    wrapper.findComponent({ name: 'UInput' }).vm.$emit('update:modelValue', 'READY')
    await wrapper.vm.$nextTick()

    const items = wrapper.findComponent({ name: 'UTabs' }).props('items') as Array<{ badge: string }>
    expect(items.map(i => i.badge)).toEqual(['1', '0'])
    expect(wrapper.findAll('dt')).toHaveLength(1)
    expect(wrapper.text()).toContain('READY')
  })

  it('falls back to the first group when the selected variant disappears', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { variants } })

    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', '1')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('UPLOADING')

    // A reused instance whose field data shrank to a single group would
    // otherwise strand the selector on a gone tab and show the empty state.
    await wrapper.setProps({ variants: [variants[0]] })
    expect(wrapper.text()).toContain('BUILDING')
    expect(wrapper.text()).not.toContain('No matching values')

    // The raw selection is reset, not merely hidden by a computed fallback.
    // Re-expanding must therefore keep the first group selected.
    await wrapper.setProps({ variants })
    expect(wrapper.findComponent({ name: 'UTabs' }).props('modelValue')).toBe('0')
    expect(wrapper.text()).toContain('BUILDING')
    expect(wrapper.text()).not.toContain('UPLOADING')
  })
})
