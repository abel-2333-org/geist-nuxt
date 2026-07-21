// <ApiDocsResponseExample> — controlled / uncontrolled scenario selection.
// Same seam as RequestExample, plus the status dimension which stays INTERNAL
// and must snap to the first available status whenever the converged scenario
// changes (user pick, parent update, or fallback).
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import ResponseExample from '../../kits/api-docs/components/ResponseExample.vue'

const scenarios = [
  {
    id: 'basic',
    label: 'Basic',
    statuses: [
      { status: 200, statusText: 'OK', variants: [{ language: 'json', code: 'BASIC-200' }] },
      { status: 400, statusText: 'Bad Request', variants: [{ language: 'json', code: 'BASIC-400' }] },
    ],
  },
  {
    id: 'batch',
    label: 'Batch',
    statuses: [
      { status: 404, statusText: 'Not Found', variants: [{ language: 'json', code: 'BATCH-404' }] },
      { status: 422, statusText: 'Unprocessable Entity', variants: [{ language: 'json', code: 'BATCH-422' }] },
    ],
  },
]

// Selects are located by their contract icons: scenario = layers, status = activity.
function selectByIcon(wrapper: VueWrapper<InstanceType<typeof ResponseExample>>, icon: string) {
  return wrapper
    .findAllComponents({ name: 'USelect' })
    .find(c => c.props('icon') === icon)
}

describe('ApiDocsResponseExample scenario selection', () => {
  it('uncontrolled: renders the first scenario and its first status by default', async () => {
    const wrapper = await mountSuspended(ResponseExample, { props: { scenarios } })
    expect(wrapper.text()).toContain('BASIC-200')
    expect(wrapper.text()).toContain('200')
  })

  it('uncontrolled: preserves scenario and status when scenarios are reordered', async () => {
    const wrapper = await mountSuspended(ResponseExample, { props: { scenarios } })
    const statusSelect = selectByIcon(wrapper, 'i-lucide-activity')
    expect(statusSelect).toBeDefined()

    statusSelect!.vm.$emit('update:modelValue', 400)
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ scenarios: [...scenarios].reverse() })

    expect(selectByIcon(wrapper, 'i-lucide-layers')?.props('modelValue')).toBe('basic')
    expect(selectByIcon(wrapper, 'i-lucide-activity')?.props('modelValue')).toBe(400)
    expect(wrapper.text()).toContain('BASIC-400')
    expect(wrapper.text()).not.toContain('BATCH-404')
  })

  it('controlled: renders the bound scenario and follows parent updates', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios, scenario: 'batch', 'onUpdate:scenario': () => {} },
    })
    expect(selectByIcon(wrapper, 'i-lucide-activity')?.props('modelValue')).toBe(404)
    expect(wrapper.text()).toContain('BATCH-404')

    await wrapper.setProps({ scenario: 'basic' })
    expect(wrapper.text()).toContain('BASIC-200')
  })

  it('emits update:scenario exactly once when the user picks a scenario', async () => {
    const wrapper = await mountSuspended(ResponseExample, { props: { scenarios } })
    const select = selectByIcon(wrapper, 'i-lucide-layers')
    expect(select).toBeDefined()

    select!.vm.$emit('update:modelValue', 'batch')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:scenario')).toEqual([['batch']])
    expect(wrapper.text()).toContain('BATCH-404')
  })

  it('unknown controlled id: falls back to the first scenario without emitting', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios, scenario: 'missing' },
    })
    expect(wrapper.text()).toContain('BASIC-200')
    expect(wrapper.emitted('update:scenario')).toBeUndefined()
  })

  it('snaps status to the first available one when the scenario changes', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios, scenario: 'basic' },
    })

    // Move internal status off the default (200 → 400).
    const statusSelect = selectByIcon(wrapper, 'i-lucide-activity')
    expect(statusSelect).toBeDefined()
    statusSelect!.vm.$emit('update:modelValue', 400)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('BASIC-400')

    // Parent switches the scenario; 400 does not exist there → snap to 404.
    await wrapper.setProps({ scenario: 'batch' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('BATCH-404')
    expect(wrapper.text()).toContain('404')
  })

  it('hides the scenario selector when there is at most one scenario', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios: scenarios.slice(1) },
    })
    expect(selectByIcon(wrapper, 'i-lucide-layers')).toBeUndefined()
    expect(wrapper.text()).toContain('BATCH-404')
  })
})
