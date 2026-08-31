<script lang="ts">
// Preserve the component's pre-util type import surface.
export type { EnumValue, EnumVariant } from '#imports'
</script>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import EnumTablePanel from '../internal/EnumTablePanel.vue'

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
    filterThreshold: 8,
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

// `id` is authored identity, separate from localized title/when copy. It is
// passed straight through UTabs, so locale changes and reorders preserve the
// selected group without an index/title translation layer.
const variantIds = computed(() => (props.variants ?? []).map(v => v.id))
const activeId = shallowRef<string>()

// TypeScript can require an id but cannot prove runtime uniqueness. Keep author
// mistakes loud in source/gallery/consumer development instead of letting
// Reka's tab lookup silently bind two panels to one value.
if (import.meta.dev || import.meta.test) {
  watchEffect(() => {
    const ids = variantIds.value
    const invalidIndex = ids.findIndex(
      (id, i) => typeof id !== 'string' || !id.trim() || ids.indexOf(id) !== i,
    )
    if (invalidIndex < 0) return
    console.warn(
      `[EnumTable] variant ids must be non-empty and unique; invalid index ${invalidIndex}, `
      + `received ${JSON.stringify(ids[invalidIndex])}`,
    )
  })
}

// Position is derived, so reordering the groups carries the selection with it
// and a vanished group falls back to the first — no index arithmetic to keep
// in sync with the data.
const activeIndex = computed(() => {
  const i = activeId.value ? variantIds.value.indexOf(activeId.value) : -1
  return i >= 0 ? i : 0
})

// A derived fallback is not enough: leaving a stale id in place would let the
// old selection resurrect if that group ever comes back.
watch(
  variantIds,
  (ids) => {
    if (!activeId.value || !ids.includes(activeId.value)) activeId.value = ids[0]
  },
  { flush: 'sync', immediate: true },
)

// Tab per variant, badged with its *filtered* count so an active search reveals
// which variant holds the matches even while you're viewing another tab.
const variantTabs = computed<TabsItem[]>(() =>
  filteredVariants.value.map((v, i) => ({
    label: v.title ?? props.variantLabel(i),
    value: v.id,
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

    <!-- Keep the body in UTabs' content slot so Reka owns the tab/tabpanel ids
         and ARIA relationship. `id` remains the public selection identity. -->
    <UTabs
      v-if="isVariant"
      v-model="activeId"
      :items="variantTabs"
      color="neutral"
      variant="pill"
      size="xs"
      class="w-full"
    >
      <template #content>
        <EnumTablePanel
          :values="visibleValues"
          :when="activeVariant?.when"
          :bounded="bounded"
          :label="label"
          :default-value="defaultValue"
          :default-label="defaultLabel"
          :empty-label="emptyLabel"
        />
      </template>
    </UTabs>

    <EnumTablePanel
      v-else
      :values="visibleValues"
      :bounded="bounded"
      :label="label"
      :default-value="defaultValue"
      :default-label="defaultLabel"
      :empty-label="emptyLabel"
    />
  </div>
</template>
