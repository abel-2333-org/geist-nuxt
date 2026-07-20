<script setup lang="ts">
// Domain component (API docs) — an interactive RESPONSE example that switches
// between business scenarios AND HTTP statuses (200 / 400 / 401 …), showing a
// color-coded status badge, and delegates the body + language + copy + wrap to
// <CodeBlock>. Scenario + status selects are injected into CodeBlock's
// unified toolbar via #controls; the status badge goes into #leading.
//
// Handles both the multi-status case and the single fixed response: pass one
// scenario with one status and the selects hide, leaving just the status badge
// + body (delegated to <CodeBlock>).
//
// Anatomy:  <CodeBlock> + status badge (#leading) + scenario/status (#controls)
// State:    active scenario — optionally controlled via `v-model:scenario`
//           (uncontrolled by default); active status stays internal and snaps
//           when the scenario changes; language/copy/wrap in CodeBlock.
// A11y:     status uses a numeric badge (text + color, never color alone);
//           selects are labelled; the rest is inherited.

import type { CodeVariant, ApiCodeLabels } from './CodeBlock.vue'

export interface ResponseStatus {
  /** Numeric HTTP status, e.g. 200 | 400 | 401. */
  status: number
  /** Short human label, e.g. 'OK' | 'Bad Request'. */
  statusText?: string
  /** Language variants for this status (usually one, e.g. JSON). */
  variants: CodeVariant[]
}

export interface ResponseScenario {
  /** Stable id for selection. */
  id: string
  /** Scenario label, already localized upstream, e.g. 'With options'. */
  label: string
  /** Statuses available for this scenario. */
  statuses: ResponseStatus[]
}

/** Adds response-level chrome copy on top of CodeBlock's labels. */
export interface ApiResponseLabels extends ApiCodeLabels {
  title?: string
  scenario?: string
  status?: string
}

const props = withDefaults(
  defineProps<{
    /** One or more business scenarios, each with one or more statuses. */
    scenarios?: ResponseScenario[]
    title?: string
    defaultWrap?: boolean
    maxHeight?: string
    labels?: ApiResponseLabels
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
  title: 'Response',
  scenario: 'Scenario',
  status: 'Status',
  ...props.labels,
}))

const scenarios = computed(() => props.scenarios ?? [])

// Optional controlled seam: bind `v-model:scenario` to drive the selection
// from the parent (e.g. linked request/response). When unbound, defineModel
// falls back to local state and behavior is unchanged (uncontrolled).
const scenarioModel = defineModel<string>('scenario')

// The effective scenario is fully DERIVED: an unknown/missing id converges to
// the first scenario without writing back or emitting — no update loops, no
// duplicate events, SSR-safe (fallback is never persisted into the model).
const currentScenario = computed<ResponseScenario | undefined>(
  () => scenarios.value.find(s => s.id === scenarioModel.value) ?? scenarios.value[0],
)

// The select shows the CONVERGED id but only writes user choices to the model.
const selectedScenario = computed<string | undefined>({
  get: () => currentScenario.value?.id,
  set: (id) => { scenarioModel.value = id },
})

// Status stays INTERNAL state (out of the controlled seam by design).
const activeStatus = ref<number | undefined>(scenarios.value[0]?.statuses?.[0]?.status)

const statuses = computed<ResponseStatus[]>(() => currentScenario.value?.statuses ?? [])

const currentStatus = computed<ResponseStatus | undefined>(
  () => statuses.value.find(s => s.status === activeStatus.value) ?? statuses.value[0],
)

// When the CONVERGED scenario changes (user pick, parent update, or list
// change), snap the status back into range.
watch(() => currentScenario.value?.id, () => {
  if (!statuses.value.some(s => s.status === activeStatus.value)) {
    activeStatus.value = statuses.value[0]?.status
  }
})

const scenarioItems = computed(() =>
  scenarios.value.map(s => ({ label: s.label, value: s.id })),
)

// The numeric code lives in the colored badge (#leading), so the selector only
// carries the status TEXT — together they read "200 · OK" without repeating.
const statusItems = computed(() =>
  statuses.value.map(s => ({ label: s.statusText ?? String(s.status), value: s.status })),
)

// 2xx success · 3xx info · 4xx warning · 5xx error (text + color, not color alone).
const statusColor = computed<'success' | 'info' | 'warning' | 'error' | 'neutral'>(() => {
  const s = currentStatus.value?.status
  if (!s) return 'neutral'
  const c = Math.floor(s / 100)
  if (c === 2) return 'success'
  if (c === 3) return 'info'
  if (c === 4) return 'warning'
  if (c === 5) return 'error'
  return 'neutral'
})
</script>

<template>
  <ApiDocsCodeBlock
    :variants="currentStatus?.variants ?? []"
    :title="title ?? t.title"
    icon="i-lucide-file-json-2"
    :default-wrap="defaultWrap"
    :max-height="maxHeight"
    :labels="labels"
    :language-labels="languageLabels"
    :trust-highlighted-html="trustHighlightedHtml"
  >
    <!-- Status badge next to the title -->
    <template v-if="currentStatus" #leading>
      <UBadge
        :color="statusColor"
        variant="subtle"
        size="sm"
        class="font-mono font-semibold"
      >
        {{ currentStatus.status }}
      </UBadge>
    </template>

    <!-- Scenario + status selects, injected into the unified toolbar -->
    <template #controls>
      <USelect
        v-if="scenarioItems.length > 1"
        v-model="selectedScenario"
        :items="scenarioItems"
        icon="i-lucide-layers"
        size="xs"
        color="neutral"
        variant="subtle"
        :aria-label="t.scenario"
        class="min-w-0 max-w-full"
        :ui="{ content: 'min-w-fit' }"
      />
      <USelect
        v-if="statusItems.length > 1"
        v-model="activeStatus"
        :items="statusItems"
        icon="i-lucide-activity"
        size="xs"
        color="neutral"
        variant="subtle"
        :aria-label="t.status"
        class="min-w-0 max-w-full"
        :ui="{ content: 'min-w-fit' }"
      />
    </template>
  </ApiDocsCodeBlock>
</template>
