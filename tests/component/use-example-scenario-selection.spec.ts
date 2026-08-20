import { computed, defineComponent, h, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useExampleScenarioSelection } from '../../kits/api-docs/composables/useExampleScenarioSelection'

interface Scenario {
  id: string
  label: string
}

const initialScenarios: Scenario[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'batch', label: 'Batch' },
]

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

async function mountSelection(options: {
  controlled?: boolean
  scenario?: Ref<string | undefined>
}) {
  const scenarios = reactive(initialScenarios.map(item => ({ ...item })))
  const scenario = options.scenario ?? ref<string>()
  const onSelect = vi.fn()
  let selection: ReturnType<typeof useExampleScenarioSelection<Scenario>> | undefined

  const Host = defineComponent({
    setup() {
      selection = useExampleScenarioSelection({
        scenarios: computed(() => scenarios),
        scenario: () => scenario.value,
        controlled: options.controlled ?? false,
        onSelect,
      })
      return () => h('div')
    },
  })

  wrapper = await mountSuspended(Host)
  if (!selection) throw new Error('useExampleScenarioSelection did not initialize')
  return { scenarios, scenario, onSelect, selection }
}

describe('useExampleScenarioSelection', () => {
  it('preserves an uncontrolled identity across reorders', async () => {
    const { scenarios, selection } = await mountSelection({})

    selection.selectedScenario.value = 'batch'
    await wrapper!.vm.$nextTick()
    scenarios.reverse()
    await wrapper!.vm.$nextTick()

    expect(selection.currentScenario.value?.id).toBe('batch')
    expect(selection.selectedScenario.value).toBe('batch')
  })

  it('discards an uncontrolled identity after it is removed', async () => {
    const { scenarios, selection } = await mountSelection({})

    selection.selectedScenario.value = 'batch'
    scenarios.splice(1, 1)
    await wrapper!.vm.$nextTick()
    scenarios.push({ id: 'batch', label: 'Batch' })
    await wrapper!.vm.$nextTick()

    expect(selection.currentScenario.value?.id).toBe('basic')
  })

  it('derives controlled fallback without writing back or emitting', async () => {
    const scenario = ref<string>()
    const { onSelect, selection } = await mountSelection({ controlled: true, scenario })

    expect(selection.currentScenario.value?.id).toBe('basic')
    expect(selection.selectedScenario.value).toBe('basic')
    expect(scenario.value).toBeUndefined()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('emits one explicit selection without mutating the controlled source', async () => {
    const scenario = ref<string>('basic')
    const { onSelect, selection } = await mountSelection({ controlled: true, scenario })

    selection.selectedScenario.value = 'batch'

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith('batch')
    expect(scenario.value).toBe('basic')
    expect(selection.currentScenario.value?.id).toBe('basic')
  })
})
