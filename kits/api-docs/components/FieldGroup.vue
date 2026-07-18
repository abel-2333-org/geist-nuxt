<script setup lang="ts">
// Domain component (API docs): a semantically-labelled group of fields (e.g.
// HEADERS, REQUEST BODY). Self-contained per the kit slice convention — no
// domain types, just a heading + optional count wrapping a slot of field rows.
//
// Anatomy:  header  ── mono uppercase label · optional count
//           body    ── slot (typically a stack of <ApiDocsFieldItem>)
// The heading text is user content → passed in via prop; `count` is optional.
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
