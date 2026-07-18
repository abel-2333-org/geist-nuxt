<script setup lang="ts">
// Domain component (API docs) — an interactive REQUEST example that switches
// between usage scenarios (e.g. basic / with options / batch) and
// delegates the actual code body + language switch + copy + wrap to
// <CodeBlock>. This wrapper owns ONLY scenario selection; it injects the
// scenario <USelect> into CodeBlock's unified toolbar via #controls, so
// everything stays on one aligned row.
//
// Anatomy:  <CodeBlock> with a scenario select injected into its toolbar
// State:    active scenario; language/copy/wrap live in CodeBlock.
// A11y:     scenario select is labelled; the rest is inherited.

import type { CodeVariant, ApiCodeLabels } from './CodeBlock.vue'

export interface RequestScenario {
  /** Stable id for selection. */
  id: string
  /** Scenario label, already localized upstream, e.g. 'With options'. */
  label: string
  /** Language variants for this scenario. Empty → unavailable state. */
  variants: CodeVariant[]
}

/** Adds request-level chrome copy on top of CodeBlock's labels. */
export interface ApiRequestLabels extends ApiCodeLabels {
  title?: string
  scenario?: string
}

const props = withDefaults(
  defineProps<{
    /** One or more business scenarios. */
    scenarios?: RequestScenario[]
    /** Override the toolbar title (defaults to labels.title / 'Request'). */
    title?: string
    defaultWrap?: boolean
    maxHeight?: string
    labels?: ApiRequestLabels
    languageLabels?: Record<string, string>
  }>(),
  {
    scenarios: () => [],
    defaultWrap: false,
    maxHeight: '24rem',
    labels: () => ({}),
    languageLabels: () => ({}),
  },
)

const t = computed(() => ({
  title: 'Request',
  scenario: 'Scenario',
  ...props.labels,
}))

const scenarios = computed(() => props.scenarios ?? [])
const activeId = ref<string | undefined>(scenarios.value[0]?.id)

const current = computed<RequestScenario | undefined>(
  () => scenarios.value.find(s => s.id === activeId.value) ?? scenarios.value[0],
)

// Keep selection valid if the scenario list changes.
watch(scenarios, (list) => {
  if (!list.some(s => s.id === activeId.value)) activeId.value = list[0]?.id
})

const scenarioItems = computed(() =>
  scenarios.value.map(s => ({ label: s.label, value: s.id })),
)
</script>

<template>
  <ApiDocsCodeBlock
    :variants="current?.variants ?? []"
    :title="title ?? t.title"
    :default-wrap="defaultWrap"
    :max-height="maxHeight"
    :labels="labels"
    :language-labels="languageLabels"
  >
    <template v-if="scenarioItems.length > 1" #controls>
      <USelect
        v-model="activeId"
        :items="scenarioItems"
        icon="i-lucide-layers"
        size="xs"
        color="neutral"
        variant="subtle"
        :aria-label="t.scenario"
        class="min-w-0 max-w-full"
        :ui="{ content: 'min-w-fit' }"
      />
    </template>
  </ApiDocsCodeBlock>
</template>
