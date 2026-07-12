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
// State:    active scenario, active status; language/copy/wrap in CodeBlock.
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
  /** Scenario label, already localized upstream, e.g. '收银台支付'. */
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
  title: 'Response',
  scenario: 'Scenario',
  status: 'Status',
  ...props.labels,
}))

const scenarios = computed(() => props.scenarios ?? [])
const activeScenarioId = ref<string | undefined>(scenarios.value[0]?.id)
const activeStatus = ref<number | undefined>(scenarios.value[0]?.statuses?.[0]?.status)

const currentScenario = computed<ResponseScenario | undefined>(
  () => scenarios.value.find(s => s.id === activeScenarioId.value) ?? scenarios.value[0],
)

const statuses = computed<ResponseStatus[]>(() => currentScenario.value?.statuses ?? [])

const currentStatus = computed<ResponseStatus | undefined>(
  () => statuses.value.find(s => s.status === activeStatus.value) ?? statuses.value[0],
)

// When the scenario changes, snap the status back into range.
watch(activeScenarioId, () => {
  if (!statuses.value.some(s => s.status === activeStatus.value)) {
    activeStatus.value = statuses.value[0]?.status
  }
})
watch(scenarios, (list) => {
  if (!list.some(s => s.id === activeScenarioId.value)) activeScenarioId.value = list[0]?.id
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
        v-model="activeScenarioId"
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
