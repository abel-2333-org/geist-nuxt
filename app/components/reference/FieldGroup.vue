<script setup lang="ts">
// A semantically-labelled group of fields (e.g. HEADERS, REQUEST BODY).
// Heading text is user content → passed in via prop. `count` is optional.
defineProps<{
  label: string
  count?: number
}>()
</script>

<template>
  <section class="space-y-1">
    <div class="flex items-baseline gap-2 border-b border-default pb-2">
      <h2 class="font-mono text-xs font-semibold uppercase tracking-widest text-muted">
        {{ label }}
      </h2>
      <span v-if="count !== undefined" class="font-mono text-xs text-dimmed tabular-nums">
        {{ count }}
      </span>
    </div>
    <div>
      <slot />
    </div>
  </section>
</template>
