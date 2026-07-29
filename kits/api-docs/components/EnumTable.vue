<script lang="ts">
// Preserve the component's pre-util type import surface.
export type { EnumValue, EnumVariant } from '#imports'
</script>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { useResizeObserver } from '@vueuse/core'

// Domain component (API docs): renders a field's allowed values. Composed from
// Nuxt UI primitives + core atoms (InlineCode, InlineMarkdown, both supplied by
// the foundation dependency closure).
//
// The enum display model (EnumValue/EnumVariant) lives in the co-slice util
// `utils/enum.ts` and is referenced bare here — Nuxt auto-imports this kit's
// `utils/` dir, so no import statement is needed (same pattern as the
// lifecycle/method preset types). New callers import from `~/utils/enum`; the
// module script above preserves the previous component import surface.
const props = withDefaults(
  defineProps<EnumTableProps>(),
  {
    label: 'Allowed values',
    defaultLabel: 'Default',
    searchPlaceholder: 'Filter values',
    emptyLabel: 'No matching values',
    variantLabel: (index: number) => `Option ${index + 1}`,
    filterThreshold: 30,
    resultsAnnouncement: (count: number) => `${count} value${count === 1 ? '' : 's'} found`,
    variantResultsAnnouncement: (totalCount: number, activeCount: number, activeLabel: string) =>
      `${totalCount} value${totalCount === 1 ? '' : 's'} found across all options; `
      + `${activeCount} in ${activeLabel}`,
    noResultsAnnouncement: (q: string) => `No matching values for “${q}”`,
  },
)

const query = ref('')

// Variant enums are mutually exclusive (you pick one condition, e.g. one
// delivery mode), so we surface them as a tab selector instead of stacking every
// group's values — otherwise a large first group buries the rest off-screen.
const isVariant = computed(() => !!props.variants?.length)

function filterValues(values: EnumValue[]): EnumValue[] {
  const q = query.value.trim().toLowerCase()
  if (!q) return values
  return values.filter(
    v => v.value.toLowerCase().includes(q) || v.description.toLowerCase().includes(q),
  )
}

// Filter every variant once per query. Both the tab badges and the rendered
// body read this same array, so a badge count can never disagree with the panel
// it points at — previously each surface ran its own filter pass.
const filteredVariants = computed(() =>
  (props.variants ?? []).map(v => ({ ...v, values: filterValues(v.values) })),
)

// Selection is held as the *identity* of the chosen group, never as its
// position. A reused instance (a docs route swapping field data) can hand this
// component an entirely different set of groups with the same length, and a
// stored index would then silently point at an unrelated group. Title is the
// group's authored handle; untitled groups fall back to their first value, and
// a repeated handle gets an occurrence suffix so two same-titled tabs stay
// distinguishable.
const variantKeys = computed(() => {
  const seen = new Map<string, number>()
  return (props.variants ?? []).map((v, i) => {
    const base = v.title ?? v.values[0]?.value ?? `#${i}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n ? `${base}#${n}` : base
  })
})

const activeKey = ref<string>()

// Position is derived, so reordering the groups carries the selection with it
// and a vanished group falls back to the first — no index arithmetic to keep
// in sync with the data.
const activeIndex = computed(() => {
  const i = activeKey.value ? variantKeys.value.indexOf(activeKey.value) : -1
  return i >= 0 ? i : 0
})

// A derived fallback is not enough: leaving a stale key in place would let the
// old selection resurrect if that group ever comes back.
watch(
  variantKeys,
  (keys) => {
    if (!activeKey.value || !keys.includes(activeKey.value)) activeKey.value = keys[0]
  },
  { flush: 'sync', immediate: true },
)

// The tab items carry positions (UTabs needs a value per item), so translate
// back to identity at the single point where the reader picks a group.
function selectVariant(value: unknown) {
  activeKey.value = variantKeys.value[Number(value)] ?? variantKeys.value[0]
}

// Tab per variant, badged with its *filtered* count so an active search reveals
// which variant holds the matches even while you're viewing another tab.
const variantTabs = computed<TabsItem[]>(() =>
  filteredVariants.value.map((v, i) => ({
    label: v.title ?? props.variantLabel(i),
    value: String(i),
    badge: String(v.values.length),
  })),
)

const activeVariant = computed(() => filteredVariants.value[activeIndex.value])
const activeVariantLabel = computed(() => {
  const label = variantTabs.value[activeIndex.value]?.label
  return typeof label === 'string' ? label : props.variantLabel(activeIndex.value)
})

// The values actually rendered: the active variant's filtered list, or the
// filtered flat list.
const visibleValues = computed<EnumValue[]>(() =>
  isVariant.value
    ? (activeVariant.value?.values ?? [])
    : filterValues(props.values ?? []),
)

// The filter searches every variant, so its live-region result must use the
// same global scope. Announcing only the active panel could claim "no matches"
// while another tab's badge shows a hit.
const filteredCount = computed(() =>
  isVariant.value
    ? filteredVariants.value.reduce((n, v) => n + v.values.length, 0)
    : visibleValues.value.length,
)

const totalCount = computed(() =>
  isVariant.value
    ? (props.variants ?? []).reduce((n, v) => n + v.values.length, 0)
    : (props.values?.length ?? 0),
)

const activeTotalCount = computed(() =>
  isVariant.value
    ? (props.variants?.[activeIndex.value]?.values.length ?? 0)
    : (props.values?.length ?? 0),
)

// Only large lists need the search affordance.
const filterable = computed(() => totalCount.value >= props.filterThreshold)

// Search availability is global, but the bounded panel is local to the active
// authored group. Do not derive this from filtered results: crossing the
// threshold while typing would remove max-height and expand a long table.
const bounded = computed(() => activeTotalCount.value >= props.filterThreshold)

// `bounded` keeps the page layout stable while filtering, but keyboard chrome
// belongs only on a box that genuinely scrolls. Measure the rendered element
// instead of using row count as a second proxy: descriptions and viewport width
// both change its real height.
const scrollBox = useTemplateRef<HTMLElement>('scrollBox')
const scrollable = shallowRef(false)
const focusable = computed(() => bounded.value && scrollable.value)
let measureFrame = 0

function measureOverflow() {
  const el = scrollBox.value
  scrollable.value = Boolean(
    bounded.value
    && el
    && el.scrollHeight > el.clientHeight + 1,
  )
}

function scheduleOverflowMeasure() {
  if (typeof requestAnimationFrame === 'undefined') {
    measureOverflow()
    return
  }
  if (measureFrame) cancelAnimationFrame(measureFrame)
  measureFrame = requestAnimationFrame(() => {
    measureFrame = 0
    measureOverflow()
  })
}

useResizeObserver(scrollBox, scheduleOverflowMeasure)
onMounted(scheduleOverflowMeasure)
watch([visibleValues, bounded], () => scheduleOverflowMeasure(), {
  deep: true,
  flush: 'post',
})
onBeforeUnmount(() => {
  if (measureFrame) cancelAnimationFrame(measureFrame)
})

// Never retain a filter the reader can no longer see or clear.
watch(filterable, (value) => {
  if (!value) query.value = ''
}, { flush: 'sync' })

// Filtering rewrites every variant silently, so announce the aggregate result
// — the same scope as the input and the tab badges. Empty while idle so
// ordinary browsing stays quiet.
const filterAnnouncement = computed(() => {
  const q = query.value.trim()
  if (!q) return ''
  if (filteredCount.value === 0) return props.noResultsAnnouncement(q)
  if (!isVariant.value) return props.resultsAnnouncement(filteredCount.value)
  return props.variantResultsAnnouncement(
    filteredCount.value,
    visibleValues.value.length,
    activeVariantLabel.value,
  )
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <!-- Count is always shown so this header matches the constraints block's
           `LABEL (N)` grammar — the two tabular blocks read as one language. -->
      <p class="text-xs font-medium uppercase tracking-wide text-dimmed">
        {{ label }}
        <span v-if="totalCount" class="text-dimmed/70">({{ totalCount }})</span>
      </p>
      <UInput
        v-if="filterable"
        v-model="query"
        :placeholder="searchPlaceholder"
        :aria-label="searchPlaceholder"
        icon="i-lucide-search"
        size="xs"
        variant="soft"
        class="w-44 max-w-full"
        :ui="{ base: 'rounded-sm' }"
      />
    </div>

    <!-- Polite live region: filtering rewrites the table silently, so a screen
         reader otherwise gets no feedback on how many values matched. Visually
         hidden; empty while idle. -->
    <p v-if="filterable" class="sr-only" role="status" aria-live="polite">
      {{ filterAnnouncement }}
    </p>

    <!-- Variant selector: one click to any group, so nothing is buried below a
         long list. Badges carry per-variant counts. Bound to the clamped index
         rather than the raw ref, so the highlighted pill and the rendered panel
         can never disagree. -->
    <UTabs
      v-if="isVariant"
      :model-value="String(activeIndex)"
      :items="variantTabs"
      :content="false"
      color="neutral"
      variant="pill"
      size="xs"
      class="w-full"
      @update:model-value="selectVariant"
    />

    <!-- Applicability caption: the tab title names the group, this sentence
         says when you are in it. Neutral, never amber — the warning ladder
         belongs to the field row this table nests inside, and one more amber
         object there would flatten that grading. -->
    <p
      v-if="activeVariant?.when"
      data-enum-when
      class="wrap-anywhere min-w-0 text-xs leading-relaxed text-muted"
    >
      <InlineMarkdown :text="activeVariant.when" />
    </p>

    <!-- The authored active list controls the stable max-height; DOM overflow
         controls keyboard chrome. Filtering therefore never expands a long
         table, while a now-short/non-scrolling result leaves the tab order.
         Nothing inside a genuinely scrolling box is focusable, so that region
         itself takes a named, focus-ringed tab stop. -->
    <div
      ref="scrollBox"
      data-enum-scroll
      class="overflow-hidden rounded-lg border border-default"
      :class="bounded
        ? [
          'max-h-80 overflow-y-auto',
          focusable
            ? 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            : '',
        ]
        : ''"
      :tabindex="focusable ? 0 : undefined"
      :role="focusable ? 'group' : undefined"
      :aria-label="focusable ? label : undefined"
    >
      <!-- One shared grid for the whole table: the value column is sized once,
           to the widest code across all rows (capped at 12rem), so every row's
           description starts at the same x. Rows use subgrid to inherit that
           single column track instead of each computing its own fit-content. -->
      <dl
        v-if="visibleValues.length"
        class="grid grid-cols-[fit-content(12rem)_1fr] gap-x-4 divide-y divide-default"
      >
        <div
          v-for="item in visibleValues"
          :key="item.value"
          class="col-span-2 grid grid-cols-subgrid items-baseline gap-y-1 bg-muted/40 px-3 py-2.5"
        >
          <dt class="min-w-0">
            <InlineCode class="break-all">{{ item.value }}</InlineCode>
            <!-- Default marker — same uppercase tag language as the field
                 row's DEFAULT lead-in, so scanning the table answers "which
                 one do I get if I omit this?" without looking back up. -->
            <span
              v-if="defaultValue !== undefined && item.value === defaultValue"
              class="ms-2 text-xs font-medium uppercase tracking-wide text-dimmed"
            >{{ defaultLabel }}</span>
          </dt>
          <dd v-if="item.description" class="min-w-0 text-sm leading-relaxed text-muted">
            <InlineMarkdown :text="item.description" />
          </dd>
        </div>
      </dl>

      <p v-else class="bg-muted/40 px-3 py-4 text-sm text-dimmed">
        {{ emptyLabel }}
      </p>
    </div>
  </div>
</template>
