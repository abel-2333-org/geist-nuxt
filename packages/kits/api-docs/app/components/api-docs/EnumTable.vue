<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

// Domain component (API docs): renders a field's allowed values. Self-contained
// per the kit slice convention — the enum display types travel with the
// component. Composed from Nuxt UI primitives + core atoms (InlineCode,
// InlineMarkdown, both auto-imported from @geist-nuxt/core).

/** A single enum member. */
export interface EnumValue {
  value: string
  description: string
}

/** A named group of enum members — e.g. bank lists that apply under a condition. */
export interface EnumVariant {
  title?: string
  /** When this group of values applies (already localized). */
  when?: string
  values: EnumValue[]
}

const props = withDefaults(
  defineProps<{
    /** Flat enum: a single list of allowed values. */
    values?: EnumValue[]
    /** Grouped enum: values that vary by condition (e.g. bank lists per market). */
    variants?: EnumVariant[]
    /** Structural labels; overridable for i18n. */
    label?: string
    searchPlaceholder?: string
    emptyLabel?: string
    /** Lists at or above this length get a filter box + scroll area. */
    filterThreshold?: number
  }>(),
  {
    label: 'Allowed values',
    searchPlaceholder: 'Filter values',
    emptyLabel: 'No matching values',
    filterThreshold: 30,
  },
)

const query = ref('')

// Variant enums are mutually exclusive (you pick one condition, e.g. one
// lpmsType), so we surface them as a tab selector instead of stacking every
// group's values — otherwise a large first group buries the rest off-screen.
const isVariant = computed(() => !!props.variants?.length)
const activeTab = ref('0')

function filterValues(values: EnumValue[]): EnumValue[] {
  const q = query.value.trim().toLowerCase()
  if (!q) return values
  return values.filter(
    v => v.value.toLowerCase().includes(q) || v.description.toLowerCase().includes(q),
  )
}

// Tab per variant, badged with its *filtered* count so an active search reveals
// which variant holds the matches even while you're viewing another tab.
const variantTabs = computed<TabsItem[]>(() =>
  (props.variants ?? []).map((v, i) => ({
    label: v.title ?? `Option ${i + 1}`,
    value: String(i),
    badge: String(filterValues(v.values).length),
  })),
)

const activeVariant = computed(() => props.variants?.[Number(activeTab.value) || 0])

// The values actually rendered: the active variant's filtered list, or the
// filtered flat list.
const visibleValues = computed<EnumValue[]>(() =>
  isVariant.value
    ? (activeVariant.value ? filterValues(activeVariant.value.values) : [])
    : filterValues(props.values ?? []),
)

const totalCount = computed(() =>
  isVariant.value
    ? (props.variants ?? []).reduce((n, v) => n + v.values.length, 0)
    : (props.values?.length ?? 0),
)

// Only large lists need the search affordance.
const filterable = computed(() => totalCount.value >= props.filterThreshold)
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs font-medium uppercase tracking-wide text-dimmed">
        {{ label }}
        <span v-if="filterable" class="text-dimmed/70">({{ totalCount }})</span>
      </p>
      <UInput
        v-if="filterable"
        v-model="query"
        :placeholder="searchPlaceholder"
        :aria-label="searchPlaceholder"
        icon="i-lucide-search"
        size="xs"
        variant="soft"
        class="w-44"
        :ui="{ base: 'rounded-sm' }"
      />
    </div>

    <!-- Variant selector: one click to any group, so nothing is buried below a
         long list. Badges carry per-variant counts. -->
    <UTabs
      v-if="isVariant"
      v-model="activeTab"
      :items="variantTabs"
      :content="false"
      color="neutral"
      variant="pill"
      size="xs"
      class="w-full"
    />

    <!-- Large lists scroll within a bounded area so a 60-item enum never blows
         out the page; small lists render at full height. -->
    <div
      class="overflow-hidden rounded-lg border border-default"
      :class="filterable ? 'max-h-80 overflow-y-auto' : ''"
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
