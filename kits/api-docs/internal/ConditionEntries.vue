<script setup lang="ts">
// The body of a condition rule, shared by the request condition (amber
// border), the field presence rule and the value presence rule (neutral
// border). Internal helper distributed with the api-docs-field-item slice and
// imported relatively; the owner keeps the bordered container, its data
// attribute and its colour axis, so this file has no opinion about WHICH rule
// it is filling — only about how several sentences share one rule.
//
// One entry renders exactly as a plain string always has: no list chrome for
// a single sentence. Two or more become a real list so assistive technology
// announces item count and boundaries; the visual marker is the same muted
// grey on both axes because the border already carries the colour, and a
// second amber object per entry would break the fill ladder (tag → rule →
// callout → badge) the field band is graded by.
import type { ConditionEntries } from '../utils/field'

defineProps<{
  /** Already normalised by `conditionEntries()`; the owner renders nothing when empty. */
  entries: ConditionEntries
}>()
</script>

<template>
  <InlineMarkdown v-if="entries.length === 1" :text="entries[0]!" />
  <ul
    v-else
    role="list"
    data-condition-list
    class="flex list-disc flex-col gap-1 ps-4 marker:text-muted"
  >
    <li v-for="(entry, i) in entries" :key="i" class="wrap-anywhere min-w-0 ps-0.5">
      <InlineMarkdown :text="entry" />
    </li>
  </ul>
</template>
