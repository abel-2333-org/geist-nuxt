<script setup lang="ts">
// Domain component (API docs): a semantically-labelled group of fields (e.g.
// HEADERS, REQUEST BODY). Self-contained per the kit slice convention — no
// domain types, just a heading + optional count wrapping a slot of field rows.
//
// Anatomy:  header  ── mono uppercase label · optional count
//           body    ── slot (typically a stack of <ApiDocsFieldItem>)
// The heading text is user content → passed in via prop; `count` is optional.
// `headingLevel` lets the consumer slot the group into its outline (e.g. under
// an <h2> endpoint title the groups become <h3>); defaults to 2 for standalone
// use where the group is the top of its own island.
withDefaults(defineProps<{
  label: string
  count?: number
  headingLevel?: 2 | 3 | 4
}>(), {
  headingLevel: 2,
})
</script>

<template>
  <section class="space-y-1">
    <div class="flex items-baseline gap-2 border-b border-default pb-2">
      <component
        :is="`h${headingLevel}`"
        class="font-mono text-xs font-semibold uppercase tracking-widest text-muted"
      >
        {{ label }}
      </component>
      <span v-if="count !== undefined" class="font-mono text-xs text-dimmed tabular-nums">
        {{ count }}
      </span>
    </div>
    <div>
      <slot />
    </div>
  </section>
</template>
