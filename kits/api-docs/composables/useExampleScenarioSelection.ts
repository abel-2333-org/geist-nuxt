import { computed, shallowRef, watch } from 'vue'
import type { ComputedRef, WritableComputedRef } from 'vue'

export interface ExampleScenarioIdentity {
  id: string
}

export interface UseExampleScenarioSelectionOptions<T extends ExampleScenarioIdentity> {
  /** Reactive scenario list; ids are the stable selection identity. */
  scenarios: ComputedRef<readonly T[]>
  /** Read the optional controlled scenario id from the component props. */
  scenario: () => string | undefined
  /** Fixed at component mount from prop presence, including bound undefined. */
  controlled: boolean
  /** Called once for an explicit user selection. */
  onSelect: (id: string) => void
}

export interface UseExampleScenarioSelectionReturn<T extends ExampleScenarioIdentity> {
  currentScenario: ComputedRef<T | undefined>
  selectedScenario: WritableComputedRef<string | undefined>
}

/**
 * Shared controlled/uncontrolled scenario identity seam for API examples.
 *
 * Unknown controlled ids derive a first-item fallback without writing back.
 * Uncontrolled ids persist across reorders and are discarded when removed.
 */
export function useExampleScenarioSelection<T extends ExampleScenarioIdentity>(
  options: UseExampleScenarioSelectionOptions<T>,
): UseExampleScenarioSelectionReturn<T> {
  const localScenario = shallowRef<string | undefined>(options.scenarios.value[0]?.id)
  const scenario = computed(() => options.controlled ? options.scenario() : localScenario.value)

  const currentScenario = computed<T | undefined>(
    () => options.scenarios.value.find(item => item.id === scenario.value) ?? options.scenarios.value[0],
  )

  const selectedScenario = computed<string | undefined>({
    get: () => currentScenario.value?.id,
    set: (id) => {
      if (id === undefined) return
      if (!options.controlled) localScenario.value = id
      options.onSelect(id)
    },
  })

  if (!options.controlled) {
    watch(
      () => options.scenarios.value.map(item => item.id),
      (ids) => {
        if (localScenario.value === undefined || !ids.includes(localScenario.value)) {
          localScenario.value = ids[0]
        }
      },
      { flush: 'pre' },
    )
  }

  return { currentScenario, selectedScenario }
}
