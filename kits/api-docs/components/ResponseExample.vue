<script setup lang="ts">
// Domain component (API docs) — an interactive RESPONSE example that switches
// between business scenarios, HTTP statuses (200 / 400 / 'default' …) and body
// forms (media types), showing a color-coded status badge, and delegating code
// display + language + copy + wrap to <CodeBlock>. Scenario / status / media
// selects are injected into CodeBlock's unified toolbar via #controls. Wide
// containers show the three selects inline; narrow containers collapse them
// into one scenario-named trigger whose popover keeps the unbounded scenario
// dimension in a select and flattens status/media into labelled radio groups.
// The status badge goes into #leading; the status description into #notice;
// non-code body panels (empty / unavailable / file) go into #body.
//
// The display model is provided by the consumer, already localized; the
// component never parses OpenAPI. Body semantics are explicit:
//   code        — one or more CodeVariants (JSON / text / CSV …)
//   empty       — protocol-level empty body (e.g. 204); never "no example"
//   unavailable — a body exists but no example is provided; never fake code
//   file        — binary/file response: metadata + optional download only
//
// Handles both the multi-select case and the single fixed response: pass one
// scenario, one status, one body and every select hides, leaving just the
// status badge + body.
//
// Anatomy:  <CodeBlock> + status badge (#leading) + responsive
//           scenario/status/media controls (#controls) + status description
//           (#notice) + body panel (#body)
// State:    scenario is optionally controlled via `v-model:scenario`; status
//           and body stay internal and converge by stable ids; language/copy/
//           wrap live in CodeBlock.
// A11y:     status uses a text badge (text + color, never color alone);
//           selects are labelled; a persistent live region announces semantic
//           body panels; downloads are real links named with the filename.

import type { CodeVariant, ApiCodeLabels } from './CodeBlock.vue'

type ResponseBodyBase = {
  /** Stable and unique within one status; survives data replacement/reordering. */
  id: string
  /** Display label for the media select, e.g. 'application/json'. */
  mediaType?: string
}

/** One body form under a status. */
export type ResponseBody =
  | ResponseBodyBase & {
      /** Renderable example(s) — JSON, plain text, CSV … all CodeVariants. */
      kind: 'code'
      variants: CodeVariant[]
    }
  | ResponseBodyBase & {
      /** Protocol-defined empty body (e.g. 204). Never shown as "no example". */
      kind: 'empty'
      /** Optional localized note overriding the default hint. */
      note?: string
    }
  | ResponseBodyBase & {
      /** A body exists per the schema but no example is available. */
      kind: 'unavailable'
      note?: string
    }
  | ResponseBodyBase & {
      /** Binary/file response — metadata + optional download, never fake code. */
      kind: 'file'
      mediaType: string
      filename?: string
      /** Human-readable size, already formatted upstream, e.g. '2.4 MB'. */
      size?: string
      /** When present, renders a real download link. */
      downloadUrl?: string
      note?: string
    }

export interface ResponseStatus {
  /** Numeric HTTP status (200 | 400 …) or OpenAPI's 'default' fallback. */
  status: number | 'default'
  /** Short human label, e.g. 'OK' | 'Bad Request'. */
  statusText?: string
  /** Status-level description, already localized; shown above the body. */
  description?: string
  /** One or more body forms; more than one shows a media select. */
  bodies?: ResponseBody[]
  /**
   * Legacy shorthand for a single code body. Kept for compatibility and
   * normalized internally to `[{ id: 'legacy', kind: 'code', variants }]`;
   * `bodies` wins
   * when both are present.
   */
  variants?: CodeVariant[]
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
  /** aria-label of the media type select. */
  mediaType?: string
  /** Accessible name and fallback copy for the narrow response-options trigger. */
  responseOptions?: string
  /** Final fallback media label for a code body without a usable variant label. */
  codeBodyTitle?: string
  /** Intentional empty body panel (e.g. 204). */
  emptyBodyTitle?: string
  emptyBodyHint?: string
  /** Body exists but no example panel. */
  unavailableTitle?: string
  unavailableHint?: string
  /** File panel fallback title (no filename) and download link text. */
  fileTitle?: string
  download?: string
}

const emit = defineEmits<{
  'update:scenario': [id: string]
}>()

const props = withDefaults(
  defineProps<{
    /** One or more business scenarios, each with one or more statuses. */
    scenarios?: ResponseScenario[]
    /** Controlled scenario id for `v-model:scenario`. */
    scenario?: string
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
  mediaType: 'Media type',
  responseOptions: 'Response options',
  codeBodyTitle: 'Code example',
  emptyBodyTitle: 'No response body',
  emptyBodyHint: 'This response intentionally returns an empty body.',
  unavailableTitle: 'Example not available',
  unavailableHint: 'This response has a body, but no example is provided yet.',
  fileTitle: 'File response',
  download: 'Download',
  ...props.labels,
}))

/* ------------------------------------------------------------------ *
 * Selection state — scenario → status → body
 * ------------------------------------------------------------------ */
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
const currentScenario = computed<ResponseScenario | undefined>(
  () => scenarios.value.find(s => s.id === scenario.value) ?? scenarios.value[0],
)

// The select shows the CONVERGED id but only emits explicit user choices.
const selectedScenario = computed<string | undefined>({
  get: () => currentScenario.value?.id,
  set: (id) => {
    if (id === undefined) return
    if (!controlled) localScenario.value = id
    emit('update:scenario', id)
  },
})

// Status stays INTERNAL state (out of the controlled seam by design) and is
// DERIVED the same way as the scenario: localStatus records the last explicit
// user pick, and a pick missing from the current scenario converges to the
// first status without writing back — no normalization watcher, SSR-safe,
// correct on first render even for a controlled non-first initial scenario.
const localStatus = shallowRef<ResponseStatus['status'] | undefined>()

const statuses = computed<ResponseStatus[]>(() => currentScenario.value?.statuses ?? [])

const currentStatus = computed<ResponseStatus | undefined>(
  () => statuses.value.find(s => s.status === localStatus.value) ?? statuses.value[0],
)

// The select shows the CONVERGED status but only persists explicit user picks.
const selectedStatus = computed<ResponseStatus['status'] | undefined>({
  get: () => currentStatus.value?.status,
  set: (status) => {
    if (status === undefined) return
    localStatus.value = status
  },
})

/** Normalized body list: `bodies` wins; legacy `variants` maps to one code body. */
const bodies = computed<ResponseBody[]>(() => {
  const s = currentStatus.value
  if (!s) return []
  if (s.bodies !== undefined) return s.bodies
  if (s.variants) return [{ id: 'legacy', kind: 'code', variants: s.variants }]
  return []
})

const localBodyId = shallowRef<string | undefined>()

const currentBody = computed<ResponseBody | undefined>(
  () => bodies.value.find(b => b.id === localBodyId.value) ?? bodies.value[0],
)

const selectedBody = computed<string | undefined>({
  get: () => currentBody.value?.id,
  set: (id) => {
    if (id === undefined) return
    localBodyId.value = id
  },
})

// Body selection belongs to one effective scenario/status context. Data refreshes
// within that context preserve a still-valid body id; context changes start at
// the first body even when two contexts reuse the same id.
watch(
  [() => currentScenario.value?.id, () => currentStatus.value?.status],
  () => { localBodyId.value = undefined },
  { flush: 'sync' },
)

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

// Every option is self-contained. The toolbar badge may repeat the active code,
// but dropdown/radio choices remain distinguishable when labels are identical.
const statusItems = computed(() =>
  statuses.value.map(s => ({
    label: s.statusText ? `${s.status} ${s.statusText}` : String(s.status),
    value: s.status,
  })),
)

// Shares `langLabel` (kit utils/lang-preset.ts) with CodeBlock's language
// select, so the same language id renders the same label in both controls.
function codeBodyLabel(body: Extract<ResponseBody, { kind: 'code' }>) {
  const variant = body.variants[0]
  if (!variant) return t.value.codeBodyTitle
  return variant.label ?? langLabel(variant.language, props.languageLabels)
}

// Media select labels: mediaType when given, otherwise a kind-specific label.
// Code bodies use their first variant metadata and never fall through to the
// file-response copy.
const bodyItems = computed(() =>
  bodies.value.map(b => ({
    label:
      b.mediaType
      ?? (b.kind === 'code'
        ? codeBodyLabel(b)
        : b.kind === 'empty'
          ? t.value.emptyBodyTitle
          : b.kind === 'unavailable'
            ? t.value.unavailableTitle
            : t.value.fileTitle),
    value: b.id,
  })),
)

const hasResponseControls = computed(() =>
  scenarioItems.value.length > 1
  || statusItems.value.length > 1
  || bodyItems.value.length > 1,
)

const currentBodyLabel = computed(() =>
  bodyItems.value.find(item => item.value === selectedBody.value)?.label,
)

/**
 * Narrow trigger copy: the scenario name only — the highest-signal value.
 * Status stays visible in the leading badge and the media type is one click
 * away inside the popover, so concatenating them here only produced a long,
 * truncated label. Fall back through the other selectable dimensions when
 * scenarios aren't selectable; the aria-label still carries all three values.
 */
const compactControlLabel = computed(() => {
  if (scenarioItems.value.length > 1 && currentScenario.value?.label) {
    return currentScenario.value.label
  }
  if (bodyItems.value.length > 1 && currentBodyLabel.value) {
    return currentBodyLabel.value
  }
  if (statusItems.value.length > 1) {
    return currentStatus.value?.statusText ?? String(currentStatus.value?.status ?? '')
  }
  return t.value.responseOptions
})

const compactControlAriaLabel = computed(() => {
  const parts = [t.value.responseOptions]
  if (currentScenario.value?.label) {
    parts.push(`${t.value.scenario}: ${currentScenario.value.label}`)
  }
  if (currentStatus.value) {
    const text = currentStatus.value.statusText
      ? ` ${currentStatus.value.statusText}`
      : ''
    parts.push(`${t.value.status}: ${currentStatus.value.status}${text}`)
  }
  if (currentBodyLabel.value) {
    parts.push(`${t.value.mediaType}: ${currentBodyLabel.value}`)
  }
  return parts.join('. ')
})

const responseRoot = useTemplateRef<HTMLElement>('responseRoot')
const responseOptionsOpen = shallowRef(false)
let responseResizeObserver: ResizeObserver | undefined

watch(hasResponseControls, (hasControls) => {
  if (!hasControls) responseOptionsOpen.value = false
})

/**
 * The compact trigger is hidden by a container query, while the popover is
 * portalled outside that container. Close it as soon as the trigger is no
 * longer rendered, so resizing a code rail cannot leave an unanchored overlay.
 */
function syncResponseOptionsVisibility() {
  if (!responseOptionsOpen.value) return
  const trigger = responseRoot.value?.querySelector<HTMLElement>(
    '[data-response-compact-trigger]',
  )
  if (trigger && getComputedStyle(trigger).display === 'none') {
    responseOptionsOpen.value = false
  }
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  responseResizeObserver = new ResizeObserver(syncResponseOptionsVisibility)
  if (responseRoot.value) responseResizeObserver.observe(responseRoot.value)
})

onBeforeUnmount(() => {
  responseResizeObserver?.disconnect()
})

// 2xx success · 3xx info · 4xx warning · 5xx error · 'default' neutral
// (text + color, not color alone).
const statusColor = computed<'success' | 'info' | 'warning' | 'error' | 'neutral'>(() => {
  const s = currentStatus.value?.status
  if (typeof s !== 'number') return 'neutral'
  const c = Math.floor(s / 100)
  if (c === 2) return 'success'
  if (c === 3) return 'info'
  if (c === 4) return 'warning'
  if (c === 5) return 'error'
  return 'neutral'
})

const showStatusTextInBadge = computed(() =>
  statusItems.value.length === 1 && !!currentStatus.value?.statusText,
)

const codeVariants = computed<CodeVariant[]>(() =>
  currentBody.value?.kind === 'code' ? currentBody.value.variants : [],
)

/** Non-code body panel to render in CodeBlock's #body slot, if any. */
const panel = computed<Exclude<ResponseBody, { kind: 'code' }> | undefined>(() => {
  const b = currentBody.value
  return b && b.kind !== 'code' ? b : undefined
})

const panelAnnouncement = computed(() => {
  const b = panel.value
  if (!b) return ''
  if (b.kind === 'empty') {
    return `${t.value.emptyBodyTitle}. ${b.note ?? t.value.emptyBodyHint}`
  }
  if (b.kind === 'unavailable') {
    return `${t.value.unavailableTitle}. ${b.note ?? t.value.unavailableHint}`
  }
  return [b.filename ?? t.value.fileTitle, b.mediaType, b.size, b.note]
    .filter(Boolean)
    .join('. ')
})
</script>

<template>
  <div ref="responseRoot" class="@container/response">
    <p data-response-announcement class="sr-only" role="status" aria-atomic="true">
      {{ panelAnnouncement }}
    </p>
    <ApiDocsCodeBlock
      :variants="codeVariants"
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
          class="font-semibold"
        >
          <span class="sr-only">{{ t.status }}:</span>
          <span class="font-mono">{{ currentStatus.status }}</span>
          <span v-if="showStatusTextInBadge" class="font-sans font-medium">
            {{ currentStatus.statusText }}
          </span>
        </UBadge>
      </template>

      <!-- Wide: three inline selects. Narrow: a scenario-named trigger opens a
           hybrid select/radio popover over the same converged state. -->
      <template #controls>
        <div
          v-if="hasResponseControls"
          class="hidden min-w-0 items-center gap-1.5 @xl/response:flex"
        >
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
            v-model="selectedStatus"
            :items="statusItems"
            icon="i-lucide-activity"
            size="xs"
            color="neutral"
            variant="subtle"
            :aria-label="t.status"
            class="min-w-0 max-w-full"
            :ui="{ content: 'min-w-fit' }"
          />
          <USelect
            v-if="bodyItems.length > 1"
            v-model="selectedBody"
            :items="bodyItems"
            icon="i-lucide-file-type"
            size="xs"
            color="neutral"
            variant="subtle"
            :aria-label="t.mediaType"
            class="min-w-0 max-w-full"
            :ui="{ content: 'min-w-fit' }"
          />
        </div>

        <UPopover
          v-if="hasResponseControls"
          v-model:open="responseOptionsOpen"
          :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
        >
          <UButton
            data-response-compact-trigger
            :label="compactControlLabel"
            trailing-icon="i-lucide-chevron-down"
            size="xs"
            color="neutral"
            variant="subtle"
            :aria-label="compactControlAriaLabel"
            class="min-w-0 max-w-36 @xl/response:hidden"
            :ui="{ label: 'truncate' }"
          />

          <!-- Hybrid controls matched to real cardinality: scenarios can grow
               unbounded, so they stay a select (scrollable menu instead of a
               popover-stretching radio list); status and media type are small
               (1-3 items) and flatten into radio groups — one click away, no
               nested dropdown for the dimensions where flat wins. -->
          <template #content>
            <div
              class="max-h-[var(--reka-popover-content-available-height)] w-64 max-w-[calc(100vw-2rem)] space-y-4 overflow-y-auto overscroll-contain p-3"
            >
              <UFormField v-if="scenarioItems.length > 1" :label="t.scenario" size="xs">
                <USelect
                  v-model="selectedScenario"
                  :items="scenarioItems"
                  icon="i-lucide-layers"
                  size="xs"
                  color="neutral"
                  variant="subtle"
                  :aria-label="t.scenario"
                  class="w-full"
                />
              </UFormField>
              <URadioGroup
                v-if="statusItems.length > 1"
                v-model="selectedStatus"
                :items="statusItems"
                :legend="t.status"
                size="xs"
                color="neutral"
                variant="list"
                :ui="{ legend: 'text-xs text-muted' }"
              />
              <URadioGroup
                v-if="bodyItems.length > 1"
                v-model="selectedBody"
                :items="bodyItems"
                :legend="t.mediaType"
                size="xs"
                color="neutral"
                variant="list"
                :ui="{ legend: 'text-xs text-muted' }"
              />
            </div>
          </template>
        </UPopover>
      </template>

      <!-- Status-level description, inside the block's chrome, above the body -->
      <template v-if="currentStatus?.description" #notice>
        <p class="text-pretty">{{ currentStatus.description }}</p>
      </template>

      <!-- Non-code body panels — empty / unavailable / file. -->
      <template v-if="panel" #body>
        <div>
          <!-- Intentional empty body (e.g. 204) -->
          <div
            v-if="panel.kind === 'empty'"
            class="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center"
          >
            <UIcon name="i-lucide-circle-slash" class="size-8 text-dimmed" aria-hidden="true" />
            <p class="text-sm font-medium text-highlighted">{{ t.emptyBodyTitle }}</p>
            <p class="max-w-xs text-sm text-muted">{{ panel.note ?? t.emptyBodyHint }}</p>
          </div>

          <!-- Body exists, example missing -->
          <div
            v-else-if="panel.kind === 'unavailable'"
            class="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center"
          >
            <UIcon name="i-lucide-file-question" class="size-8 text-dimmed" aria-hidden="true" />
            <p class="text-sm font-medium text-highlighted">{{ t.unavailableTitle }}</p>
            <p class="max-w-xs text-sm text-muted">{{ panel.note ?? t.unavailableHint }}</p>
          </div>

          <!-- Binary/file — metadata card + optional real download link -->
          <div
            v-else
            class="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center"
          >
            <UIcon name="i-lucide-file-archive" class="size-8 text-dimmed" aria-hidden="true" />
            <div class="flex min-w-0 max-w-full flex-col items-center gap-1">
              <p class="max-w-full truncate font-mono text-sm font-medium text-highlighted">
                {{ panel.filename ?? t.fileTitle }}
              </p>
              <p class="max-w-xs text-sm text-muted">
                <span class="font-mono">{{ panel.mediaType }}</span>
                <template v-if="panel.size"> · {{ panel.size }}</template>
              </p>
              <p v-if="panel.note" class="max-w-xs text-sm text-muted">{{ panel.note }}</p>
            </div>
            <UButton
              v-if="panel.downloadUrl"
              :to="panel.downloadUrl"
              external
              download
              icon="i-lucide-download"
              color="neutral"
              variant="subtle"
              size="xs"
              :aria-label="`${t.download} ${panel.filename ?? t.fileTitle}`"
            >
              {{ t.download }}
            </UButton>
          </div>
        </div>
      </template>
    </ApiDocsCodeBlock>
  </div>
</template>
