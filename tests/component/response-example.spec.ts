// <ApiDocsResponseExample> — controlled / uncontrolled scenario selection.
// Same seam as RequestExample, plus the status dimension which stays INTERNAL
// and preserves a still-valid status across scenario changes, falling back only
// when the previous status is unavailable.
import { defineComponent, reactive } from 'vue'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import ResponseExample from '../../kits/api-docs/components/ResponseExample.vue'

/** Single explicit JSON code body with a stable id (not derived from display copy). */
function jsonBody(code: string) {
  return [{ id: 'json', kind: 'code' as const, variants: [{ language: 'json', code }] }]
}

const scenarios = [
  {
    id: 'basic',
    label: 'Basic',
    statuses: [
      { status: 200, statusText: 'OK', bodies: jsonBody('BASIC-200') },
      { status: 400, statusText: 'Bad Request', bodies: jsonBody('BASIC-400') },
    ],
  },
  {
    id: 'batch',
    label: 'Batch',
    statuses: [
      { status: 404, statusText: 'Not Found', bodies: jsonBody('BATCH-404') },
      { status: 422, statusText: 'Unprocessable Entity', bodies: jsonBody('BATCH-422') },
    ],
  },
]

const sharedStatusScenarios = [
  {
    id: 'single',
    label: 'Single',
    statuses: [
      { status: 200, statusText: 'OK', bodies: jsonBody('SINGLE-200') },
      { status: 400, statusText: 'Bad Request', bodies: jsonBody('SINGLE-400') },
    ],
  },
  {
    id: 'bulk',
    label: 'Bulk',
    statuses: [
      { status: 201, statusText: 'Created', bodies: jsonBody('BULK-201') },
      { status: 400, statusText: 'Bad Request', bodies: jsonBody('BULK-400') },
    ],
  },
]

const bodyScenarios = [
  {
    id: 'body',
    label: 'Body',
    statuses: [
      {
        status: 200,
        statusText: 'OK',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [{ language: 'json', code: 'BODY-JSON' }],
          },
          {
            id: 'csv',
            kind: 'code' as const,
            mediaType: 'text/csv',
            variants: [{ language: 'csv', code: 'BODY-CSV' }],
          },
          {
            id: 'empty',
            kind: 'empty' as const,
            note: 'Intentionally empty.',
          },
        ],
      },
      {
        status: 201,
        statusText: 'Created',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [{ language: 'json', code: 'CREATED-JSON' }],
          },
          {
            id: 'csv',
            kind: 'code' as const,
            mediaType: 'text/csv',
            variants: [{ language: 'csv', code: 'CREATED-CSV' }],
          },
        ],
      },
    ],
  },
]

// Selects are located by their contract icons: scenario = layers, status = activity.
function selectByIcon(wrapper: VueWrapper<InstanceType<typeof ResponseExample>>, icon: string) {
  return wrapper
    .findAllComponents({ name: 'USelect' })
    .find(c => c.props('icon') === icon)
}

afterEach(() => {
  vi.restoreAllMocks()
})

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

  it('uncontrolled: discards a scenario id removed by an in-place update', async () => {
    const liveScenarios = reactive(scenarios.map(s => ({ ...s, statuses: [...s.statuses] })))
    const Host = defineComponent({
      components: { ResponseExample },
      setup: () => ({ liveScenarios }),
      template: '<ResponseExample :scenarios="liveScenarios" />',
    })
    const wrapper = await mountSuspended(Host)
    const response = wrapper.getComponent(ResponseExample) as VueWrapper<InstanceType<typeof ResponseExample>>
    const scenarioSelect = selectByIcon(response, 'i-lucide-layers')

    scenarioSelect!.vm.$emit('update:modelValue', 'batch')
    await wrapper.vm.$nextTick()
    expect(response.text()).toContain('BATCH-404')

    liveScenarios.splice(1, 1)
    await wrapper.vm.$nextTick()
    expect(response.text()).toContain('BASIC-200')

    liveScenarios.push({ ...scenarios[1]!, statuses: [...scenarios[1]!.statuses] })
    await wrapper.vm.$nextTick()
    expect(selectByIcon(response, 'i-lucide-layers')?.props('modelValue')).toBe('basic')
    expect(response.text()).toContain('BASIC-200')
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

  it('preserves a still-valid status when the scenario changes', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios: sharedStatusScenarios, scenario: 'single' },
    })
    const statusSelect = selectByIcon(wrapper, 'i-lucide-activity')
    statusSelect!.vm.$emit('update:modelValue', 400)
    await wrapper.vm.$nextTick()

    await wrapper.setProps({ scenario: 'bulk' })

    expect(statusSelect?.props('modelValue')).toBe(400)
    expect(wrapper.text()).toContain('BULK-400')
  })

  it('includes status codes in options with duplicate text labels', async () => {
    const duplicateLabels = [{
      id: 'same-label',
      label: 'Same label',
      statuses: [
        { status: 200, statusText: 'Success', bodies: jsonBody('200') },
        { status: 201, statusText: 'Success', bodies: jsonBody('201') },
      ],
    }]
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios: duplicateLabels },
    })

    expect(selectByIcon(wrapper, 'i-lucide-activity')?.props('items')).toEqual([
      { label: '200 Success', value: 200 },
      { label: '201 Success', value: 201 },
    ])
  })

  it('falls back to the status code when statusText is empty or whitespace-only', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: {
        scenarios: [{
          id: 'empty-label',
          label: 'Empty label',
          statuses: [
            { status: 200, statusText: '   ', bodies: jsonBody('200') },
            { status: 201, statusText: '', bodies: jsonBody('201') },
          ],
        }],
      },
    })

    const statusSelect = selectByIcon(wrapper, 'i-lucide-activity')
    expect(statusSelect?.text()).toContain('200')
    expect(wrapper.get('[data-response-compact-trigger]').text()).toContain('200')

    statusSelect!.vm.$emit('update:modelValue', 201)
    await wrapper.vm.$nextTick()
    expect(statusSelect?.text()).toContain('201')
    expect(wrapper.get('[data-response-compact-trigger]').text()).toContain('201')
  })

  it('warns about duplicate scenario, status, and body identity keys in dev', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const duplicateScenario = {
      id: 'duplicate',
      label: 'Duplicate',
      statuses: [
        {
          status: 200,
          bodies: [
            { id: 'json', kind: 'empty' as const },
            { id: 'json', kind: 'empty' as const },
          ],
        },
        { status: 200, bodies: [] },
      ],
    }

    await mountSuspended(ResponseExample, {
      props: { scenarios: [duplicateScenario, { ...duplicateScenario }] },
    })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate scenario id "duplicate"'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate status "200" within scenario "duplicate"'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate body id "json" within status 200'))
  })

  it('warns once per duplicate key even when reactive data re-triggers the check', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const makeScenarios = (label: string) => [
      { id: 'duplicate', label, statuses: [{ status: 200 as const, bodies: [] }] },
      { id: 'duplicate', label, statuses: [{ status: 200 as const, bodies: [] }] },
    ]

    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios: makeScenarios('One') },
    })
    const callsAfterMount = warn.mock.calls.length
    expect(callsAfterMount).toBeGreaterThan(0)

    // New array identity with the same duplicate key re-runs the watchEffect.
    await wrapper.setProps({ scenarios: makeScenarios('Two') })
    await wrapper.vm.$nextTick()
    expect(warn.mock.calls.length).toBe(callsAfterMount)
  })

  it('hides the scenario selector when there is at most one scenario', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios: scenarios.slice(1) },
    })
    expect(selectByIcon(wrapper, 'i-lucide-layers')).toBeUndefined()
    expect(wrapper.text()).toContain('BATCH-404')
  })
})

describe('ApiDocsResponseExample body selection', () => {
  it('preserves the default body by id across same-context reorder', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios: bodyScenarios },
    })
    const status = bodyScenarios[0]!.statuses[0]!

    await wrapper.setProps({
      scenarios: [{
        ...bodyScenarios[0]!,
        statuses: [
          { ...status, bodies: [...status.bodies].reverse() },
          ...bodyScenarios[0]!.statuses.slice(1),
        ],
      }],
    })

    expect(selectByIcon(wrapper, 'i-lucide-file-type')?.props('modelValue')).toBe('json')
    expect(wrapper.text()).toContain('BODY-JSON')
  })

  it('preserves a body by id across same-context reorder and converges when removed', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios: bodyScenarios },
    })
    const bodySelect = selectByIcon(wrapper, 'i-lucide-file-type')
    bodySelect!.vm.$emit('update:modelValue', 'csv')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('BODY-CSV')

    const status = bodyScenarios[0]!.statuses[0]!
    await wrapper.setProps({
      scenarios: [{
        ...bodyScenarios[0]!,
        statuses: [
          { ...status, bodies: [...status.bodies].reverse() },
          ...bodyScenarios[0]!.statuses.slice(1),
        ],
      }],
    })
    expect(bodySelect?.props('modelValue')).toBe('csv')
    expect(wrapper.text()).toContain('BODY-CSV')

    await wrapper.setProps({
      scenarios: [{
        ...bodyScenarios[0]!,
        statuses: [
          { ...status, bodies: status.bodies.filter(body => body.id !== 'csv') },
          ...bodyScenarios[0]!.statuses.slice(1),
        ],
      }],
    })
    expect(bodySelect?.props('modelValue')).toBe('json')
    expect(wrapper.text()).toContain('BODY-JSON')

    await wrapper.setProps({ scenarios: bodyScenarios })
    expect(bodySelect?.props('modelValue')).toBe('json')
    expect(wrapper.text()).toContain('BODY-JSON')
  })

  it('resets body selection when the effective status changes', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios: bodyScenarios },
    })
    const bodySelect = selectByIcon(wrapper, 'i-lucide-file-type')
    bodySelect!.vm.$emit('update:modelValue', 'csv')
    await wrapper.vm.$nextTick()

    selectByIcon(wrapper, 'i-lucide-activity')!.vm.$emit('update:modelValue', 201)
    await wrapper.vm.$nextTick()

    expect(bodySelect?.props('modelValue')).toBe('json')
    expect(wrapper.text()).toContain('CREATED-JSON')
  })

  it('keeps one persistent live region and updates it for semantic panels', async () => {
    const wrapper = await mountSuspended(ResponseExample, {
      props: { scenarios: bodyScenarios },
    })
    const liveRegion = wrapper.get('[data-response-announcement]')
    expect(liveRegion.text()).toBe('')

    selectByIcon(wrapper, 'i-lucide-file-type')!.vm.$emit('update:modelValue', 'empty')
    await wrapper.vm.$nextTick()

    expect(liveRegion.text()).toContain('No response body')
    expect(liveRegion.text()).toContain('Intentionally empty.')
  })
})
