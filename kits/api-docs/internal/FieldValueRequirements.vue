<script setup lang="ts">
// One value level's requirements block, rendered inside FieldItem's value
// structure (see FieldValueStructure.vue). Internal helper: distributed with
// the api-docs-field-item slice, imported relatively by FieldValueStructure,
// never used directly by a consumer.
//
// Deliberately reuses the field band's grammar rather than inventing a surface:
// same uppercase dimmed scope label, same `fit-content(8rem)` information
// column. A value's rules and a field's rules read as the same kind of fact —
// only the SCOPE differs, and the scope is exactly what the label carries.
//
// Density and lines follow references/kits/api-docs/index.md «折叠与层级语法»:
// the model (`block.compact`) decides between one row and a heading and this
// template only renders the kind it is handed; and nothing here draws a
// structural line — a block is a list of facts, not a subtree, so the region
// around it stays the only neutral line. The 2px semantic rules (condition,
// caveat) carry a colour axis, not hierarchy.
import { presenceTypeExpression } from '../utils/field'
import type { FieldItemLabels, FieldValueChrome, ValueRequirementsBlock } from '../utils/field'
import ConditionEntries from './ConditionEntries.vue'

const props = defineProps<{
  block: ValueRequirementsBlock
  /** Chrome already resolved by the owner FieldItem (no defaults re-declared here). */
  chrome: FieldValueChrome
  /** The owner's raw labels object, for EnumTable passthrough keys. */
  labels?: FieldItemLabels
}>()

const node = computed(() => props.block.node)
</script>

<template>
  <!-- Compact: the level states ONE thing. The scope IS the label, so the
       whole fact is one scannable row — "EACH ITEM │ at least 1 character",
       or "VALUE │ object | null" when the one thing is a presence notation.
       The row may wrap: a long notation breaks inside the value column. -->
  <dl
    v-if="block.compact"
    data-value-requirements
    :data-compact="block.compact.kind"
    class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed"
  >
    <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ block.label }}</dt>
    <dd v-if="block.compact.kind === 'constraint'" class="wrap-anywhere min-w-0 text-toned">
      <InlineMarkdown :text="block.compact.text" />
    </dd>
    <!-- Same mono notation the heading form prints under `data-value-presence`,
         so the value's presence is found in one place whichever density the
         level landed on. -->
    <dd
      v-else
      data-value-presence
      class="wrap-anywhere min-w-0 font-mono text-xs text-muted"
      translate="no"
    >{{ block.compact.expression }}</dd>
  </dl>

  <!-- Heading: the level also has a condition, a description, values, an
       example or a default. One row cannot hold that, so the scope becomes a
       heading with its short notation; the remaining facts sit under it —
       a list, not a subtree, hence no line and no indent of its own. -->
  <section v-else data-value-requirements class="flex flex-col gap-2">
    <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-2">
      <p class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ block.label }}</p>
      <!-- The notation and conditions belong to this value level, never to
           the owner's field identity. Keep one presence scope for both. -->
      <div
        v-if="block.presence.unionTail.length || block.presence.condition.length"
        data-value-presence
        class="contents"
      >
        <p
          v-if="block.presence.unionTail.length"
          class="wrap-anywhere min-w-0 font-mono text-xs text-muted"
          translate="no"
        >{{ presenceTypeExpression(node.type, block.presence.unionTail) }}</p>
        <div
          v-if="block.presence.condition.length"
          data-value-presence-condition
          class="min-w-0 basis-full border-s-2 border-accented ps-3 text-sm leading-relaxed text-toned"
        >
          <ConditionEntries :entries="block.presence.condition" />
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <p v-if="node.description" class="text-sm leading-relaxed text-toned">
        <InlineMarkdown :text="node.description" />
      </p>

      <p
        v-for="(note, i) in block.caveats"
        :key="`caveat-${i}`"
        data-value-caveat
        class="rounded-md border-s-2 border-warning bg-warning/10 px-3 py-2 text-sm leading-relaxed text-toned"
      >
        <span class="me-2 text-xs font-medium uppercase tracking-wide text-warning">
          {{ note.label ?? chrome.caveat }}
        </span>
        <InlineMarkdown :text="note.text" />
      </p>

      <EnumTable
        v-if="node.enumValues?.length || node.enumVariants?.length"
        :values="node.enumValues"
        :variants="node.enumVariants"
        :default-value="node.defaultValue"
        :default-label="chrome.default"
        :label="labels?.enumLabel"
        :search-placeholder="labels?.enumFilter"
        :empty-label="labels?.enumEmpty"
        :variant-label="labels?.enumVariant"
        :results-announcement="labels?.enumResults"
        :variant-results-announcement="labels?.enumVariantResults"
        :no-results-announcement="labels?.enumNoResults"
      />

      <dl
        v-for="(note, i) in block.constraints"
        :key="`constraint-${i}`"
        class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed"
      >
        <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">
          {{ note.label ?? chrome.note }}
        </dt>
        <dd class="wrap-anywhere min-w-0 text-toned"><InlineMarkdown :text="note.text" /></dd>
      </dl>

      <dl
        v-if="node.defaultValue !== undefined"
        class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed"
      >
        <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ chrome.default }}</dt>
        <dd class="min-w-0"><InlineCode class="wrap-anywhere min-w-0">{{ node.defaultValue }}</InlineCode></dd>
      </dl>

      <dl
        v-if="node.examples?.length"
        class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed"
      >
        <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ chrome.example }}</dt>
        <dd class="flex min-w-0 flex-wrap gap-2">
          <InlineCode v-for="(ex, i) in node.examples" :key="i" class="wrap-anywhere min-w-0">{{ ex }}</InlineCode>
        </dd>
      </dl>
    </div>
  </section>
</template>
