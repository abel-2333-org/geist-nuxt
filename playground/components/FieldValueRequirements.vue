<script setup lang="ts">
// CANDIDATE (issue #117) — one value level's requirements block.
// Registered as <PlaygroundFieldValueRequirements>.
//
// Deliberately reuses the field band's grammar rather than inventing a surface:
// same uppercase dimmed scope label, same `fit-content(8rem)` information
// column, same escalation to a bordered table at two or more constraints. A
// value's rules and a field's rules read as the same kind of fact — only the
// SCOPE differs, and the scope is exactly what the label carries.
import type { FieldValueLabels, ValueRequirementsBlock } from '../model/field-value'
import type { FieldItemLabels } from '../../kits/api-docs/utils/field'

const props = defineProps<{
  block: ValueRequirementsBlock
  labels?: FieldItemLabels & FieldValueLabels
}>()

const node = computed(() => props.block.node)
</script>

<template>
  <!-- Compact: one constraint, nothing else. The scope IS the label, so the
       whole fact is one scannable row — "Each item │ at least 1 character". -->
  <dl
    v-if="block.compact"
    data-value-requirements
    class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed"
  >
    <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ block.label }}</dt>
    <dd class="wrap-anywhere min-w-0 text-toned">
      <InlineMarkdown :text="block.constraints[0]!.text" />
    </dd>
  </dl>

  <!-- Rich: the level also has a description, values, an example or a default.
       One row cannot hold that, so the scope becomes a heading and the facts
       sit under it in the same information column. -->
  <section v-else data-value-requirements class="flex flex-col gap-2">
    <p class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ block.label }}</p>

    <div class="flex flex-col gap-3 border-s border-default/60 ps-3">
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
          {{ note.label ?? labels?.caveat ?? 'Caveat' }}
        </span>
        <InlineMarkdown :text="note.text" />
      </p>

      <EnumTable
        v-if="node.enumValues?.length || node.enumVariants?.length"
        :values="node.enumValues"
        :variants="node.enumVariants"
        :default-value="node.defaultValue"
        :default-label="labels?.default"
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
          {{ note.label ?? labels?.note ?? 'Note' }}
        </dt>
        <dd class="wrap-anywhere min-w-0 text-toned"><InlineMarkdown :text="note.text" /></dd>
      </dl>

      <dl
        v-if="node.defaultValue !== undefined"
        class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed"
      >
        <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ labels?.default ?? 'Default' }}</dt>
        <dd class="min-w-0"><InlineCode class="wrap-anywhere min-w-0">{{ node.defaultValue }}</InlineCode></dd>
      </dl>

      <dl
        v-if="node.examples?.length"
        class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed"
      >
        <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ labels?.example ?? 'Example' }}</dt>
        <dd class="flex min-w-0 flex-wrap gap-2">
          <InlineCode v-for="(ex, i) in node.examples" :key="i" class="wrap-anywhere min-w-0">{{ ex }}</InlineCode>
        </dd>
      </dl>
    </div>
  </section>
</template>
