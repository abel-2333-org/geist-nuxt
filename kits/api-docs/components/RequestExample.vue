<script setup lang="ts">
// Domain component (API docs) — an interactive REQUEST example that switches
// between usage scenarios (e.g. basic / with options / batch) and
// delegates the actual code body + language switch + copy + wrap to
// <CodeBlock>. This wrapper owns ONLY scenario selection; it injects the
// scenario <USelect> into CodeBlock's unified toolbar via #controls, so
// everything stays on one aligned row.
//
// Anatomy:  <CodeBlock> with a scenario select injected into its toolbar
// State:    active scenario — optionally controlled via `v-model:scenario`
//           (uncontrolled by default); language/copy/wrap live in CodeBlock.
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

const emit = defineEmits<{
  'update:scenario': [id: string]
}>()

const props = withDefaults(
  defineProps<{
    /** One or more business scenarios. */
    scenarios?: RequestScenario[]
    /** Controlled scenario id for `v-model:scenario`. */
    scenario?: string
    /** Override the toolbar title (defaults to labels.title / 'Request'). */
    title?: string
    defaultWrap?: boolean
    maxHeight?: string
    labels?: ApiRequestLabels
    languageLabels?: Record<string, string>
    /** Pass through CodeBlock's explicit trusted-highlight opt-in. */
    trustHighlightedHtml?: boolean
  }>(),
  {
    scenarios: () => [],
    defaultWrap: false,
    maxHeight: '24rem',
    labels: () => ({}),
    languageLabels: () => ({}),
    trustHighlightedHtml: false,
  },
)

const t = computed(() => ({
  title: 'Request',
  scenario: 'Scenario',
  ...props.labels,
}))

const scenarios = computed(() => props.scenarios ?? [])

// Prop presence distinguishes controlled usage from standalone usage, including
// an explicitly bound undefined value. Decided once at mount (React-style):
// switching between controlled and uncontrolled at runtime is not supported.
// Uncontrolled state keeps the selected id stable across list reordering and
// only resets when that id disappears.
const controlled = Object.hasOwn(getCurrentInstance()?.vnode.props ?? {}, 'scenario')
const localScenario = shallowRef<string | undefined>(scenarios.value[0]?.id)
const scenario = computed(() => controlled ? props.scenario : localScenario.value)

// The effective scenario is fully DERIVED: an unknown/missing id converges to
// the first scenario without writing back or emitting — no update loops, no
// duplicate events, SSR-safe (fallback is never persisted into the model).
const current = computed<RequestScenario | undefined>(
  () => scenarios.value.find(s => s.id === scenario.value) ?? scenarios.value[0],
)

// The select shows the CONVERGED id but only emits explicit user choices.
const selected = computed<string | undefined>({
  get: () => current.value?.id,
  set: (id) => {
    if (id === undefined) return
    if (!controlled) localScenario.value = id
    emit('update:scenario', id)
  },
})

// Only uncontrolled usage consumes localScenario; skip the bookkeeping otherwise.
if (!controlled) {
  watch(scenarios, (list) => {
    if (!list.some(s => s.id === localScenario.value)) {
      localScenario.value = list[0]?.id
    }
  })
}

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
    :trust-highlighted-html="trustHighlightedHtml"
  >
    <template v-if="scenarioItems.length > 1" #controls>
      <USelect
        v-model="selected"
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
