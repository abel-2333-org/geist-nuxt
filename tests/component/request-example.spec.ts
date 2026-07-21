// <ApiDocsRequestExample> — controlled / uncontrolled scenario selection.
// Covers issue #21 acceptance: optional v-model:scenario, standard events,
// predictable parent updates, silent fallback (no write-back, no emit),
// and the ≤1-scenario selector-hidden rule.
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import RequestExample from '../../kits/api-docs/components/RequestExample.vue'

const scenarios = [
  { id: 'basic', label: 'Basic', variants: [{ language: 'curl', code: 'CODE-BASIC' }] },
  { id: 'batch', label: 'Batch', variants: [{ language: 'curl', code: 'CODE-BATCH' }] },
]

/** The scenario <USelect> injected into the CodeBlock toolbar (layers icon). */
function scenarioSelect(wrapper: VueWrapper<InstanceType<typeof RequestExample>>) {
  return wrapper
    .findAllComponents({ name: 'USelect' })
    .find(c => c.props('icon') === 'i-lucide-layers')
}

describe('ApiDocsRequestExample scenario selection', () => {
  it('uncontrolled: renders the first scenario by default', async () => {
    const wrapper = await mountSuspended(RequestExample, { props: { scenarios } })
    expect(wrapper.text()).toContain('CODE-BASIC')
    expect(wrapper.text()).not.toContain('CODE-BATCH')
  })

  it('uncontrolled: preserves the selected id when scenarios are reordered', async () => {
    const wrapper = await mountSuspended(RequestExample, { props: { scenarios } })

    await wrapper.setProps({ scenarios: [...scenarios].reverse() })

    expect(scenarioSelect(wrapper)?.props('modelValue')).toBe('basic')
    expect(wrapper.text()).toContain('CODE-BASIC')
    expect(wrapper.text()).not.toContain('CODE-BATCH')
  })

  it('controlled: renders the bound scenario and follows parent updates', async () => {
    const wrapper = await mountSuspended(RequestExample, {
      props: { scenarios, scenario: 'batch', 'onUpdate:scenario': () => {} },
    })
    expect(wrapper.text()).toContain('CODE-BATCH')

    await wrapper.setProps({ scenario: 'basic' })
    expect(wrapper.text()).toContain('CODE-BASIC')
    expect(wrapper.text()).not.toContain('CODE-BATCH')
  })

  it('emits update:scenario exactly once when the user picks a scenario', async () => {
    const wrapper = await mountSuspended(RequestExample, { props: { scenarios } })
    const select = scenarioSelect(wrapper)
    expect(select).toBeDefined()

    select!.vm.$emit('update:modelValue', 'batch')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:scenario')).toEqual([['batch']])
    expect(wrapper.text()).toContain('CODE-BATCH')
  })

  it('unknown controlled id: falls back to the first scenario without emitting', async () => {
    const wrapper = await mountSuspended(RequestExample, {
      props: { scenarios, scenario: 'missing' },
    })
    expect(wrapper.text()).toContain('CODE-BASIC')
    // Fallback is derived, never written back → no update loop, no event.
    expect(wrapper.emitted('update:scenario')).toBeUndefined()
  })

  it('converges when the scenario list changes under the selection', async () => {
    const wrapper = await mountSuspended(RequestExample, {
      props: { scenarios, scenario: 'batch' },
    })
    expect(wrapper.text()).toContain('CODE-BATCH')

    const next = [
      { id: 'inline', label: 'Inline', variants: [{ language: 'curl', code: 'CODE-INLINE' }] },
    ]
    await wrapper.setProps({ scenarios: next })
    expect(wrapper.text()).toContain('CODE-INLINE')
    expect(wrapper.emitted('update:scenario')).toBeUndefined()
  })

  it('hides the scenario selector when there is at most one scenario', async () => {
    const wrapper = await mountSuspended(RequestExample, {
      props: { scenarios: scenarios.slice(0, 1) },
    })
    expect(scenarioSelect(wrapper)).toBeUndefined()
    expect(wrapper.text()).toContain('CODE-BASIC')
  })
})
