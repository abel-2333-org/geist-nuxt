<script setup lang="ts">
// One labelled block inside a GalleryItem: a small uppercase tag naming the
// variant (e.g. "SIZES", "STATES") above the real rendered instance(s).
defineProps<{
  /** Variant label, shown in small uppercase muted type. */
  label: string
}>()
</script>

<template>
  <div class="space-y-3">
    <p class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ label }}</p>
    <div class="flex flex-wrap items-center gap-3">
      <slot />
    </div>
  </div>
</template>
