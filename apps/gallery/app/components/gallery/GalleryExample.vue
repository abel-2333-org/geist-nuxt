<script setup lang="ts">
// One labelled example inside a GalleryEntry: a small uppercase tag naming the
// facet (e.g. "SIZES", "STATES") above the real rendered instance(s).
//
// `layout` controls how the instances arrange, since inline components (buttons,
// badges) and block components (alerts, cards) need different flows:
//   row   — inline wrap, for buttons/badges/inputs (default)
//   stack — vertical, for block components like alerts/cards
//   grid  — responsive 2-col grid, for larger specimens
const props = withDefaults(
  defineProps<{
    /** Facet label, shown in small uppercase muted type. */
    label: string
    /** Arrangement of the rendered instances. */
    layout?: 'row' | 'stack' | 'grid'
  }>(),
  { layout: 'row' },
)

const layoutClass = computed(
  () =>
    ({
      row: 'flex flex-wrap items-center gap-3',
      stack: 'flex flex-col gap-3',
      grid: 'grid gap-3 sm:grid-cols-2',
    })[props.layout],
)
</script>

<template>
  <div class="space-y-3">
    <p class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ label }}</p>
    <div :class="layoutClass">
      <slot />
    </div>
  </div>
</template>
