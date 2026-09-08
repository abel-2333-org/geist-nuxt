<script setup lang="ts">
// CANDIDATE (issue #117) — renders "what this field's VALUE requires and
// contains", for values that are array elements, record members, or the content
// inside an encoded string.
//
// Registered as <PlaygroundFieldValueStructure>. Nothing under `playground/` is
// distributed; on acceptance this folds into FieldItem's own template.
//
// WHAT IT IS NOT
// It is not a field renderer. Every block below describes a value that has no
// business name, which is exactly why the consumer could not express it through
// `children` without inventing one. Real properties are handed straight back to
// the field row (<PlaygroundFieldRow>) and are the only things counted.
//
// DISCLOSURE POLICY (the whole design, in three lines)
//   · nothing structural below  → no chevron at all; the rules read inline.
//   · structure below           → exactly one region, opened by the boundary
//                                 the reader actually crosses.
//   · JSON-encoded array        → decode boundary and element boundary share
//                                 that one region (see foldsIntoParentRegion).
//
// Anatomy: inline requirements
//          | region( requirements per folded node → real fields → composition
//                    → nested region for a deeper boundary )
import {
  collectValuePaths,
  describeValueRequirements,
  fieldValueLabelDefaults,
  foldsIntoParentRegion,
  hasStructureBelow,
} from '../model/field-value'
import type { FieldValueLabels, FieldValueNode } from '../model/field-value'
import type { FieldItemLabels, FieldNote } from '../../kits/api-docs/utils/field'

defineOptions({ name: 'PlaygroundFieldValueStructure' })

const props = defineProps<{
  value: FieldValueNode
  labels?: FieldItemLabels & FieldValueLabels
  /**
   * The disclosure verb, resolved by the owner field row. Passed in rather than
   * re-defaulted here so the string exists once: on promotion this template
   * folds into FieldItem, where `showChildren` / `hideChildren` already live.
   */
  showVerb: string
  hideVerb: string
}>()

const t = computed(() => ({ ...fieldValueLabelDefaults, ...props.labels }))



// The chain of value levels starting at this node: element of element, JSON
// inside JSON. Materialized once so both render paths read the same order.
const chain = computed(() => {
  const nodes: FieldValueNode[] = []
  for (let node: FieldValueNode | undefined = props.value; node; node = node.value) nodes.push(node)
  return nodes
})

const opensRegion = computed(() => hasStructureBelow(props.value))

/** No structure anywhere below → every level's rules are short enough to read
 *  in place. An empty collapsible around one sentence is chrome, not structure. */
const inlineNodes = computed(() => (opensRegion.value ? [] : chain.value))

/** Levels that share this region. More than one only for a JSON-encoded array. */
const regionNodes = computed(() => {
  if (!opensRegion.value) return []
  const nodes: FieldValueNode[] = [props.value]
  let child = props.value.value
  while (child && foldsIntoParentRegion(nodes[nodes.length - 1]!, child)) {
    nodes.push(child)
    child = child.value
  }
  return nodes
})

/** The boundary that did NOT fold — rendered as its own nested region so two
 *  same-named headings can never land side by side in one panel. */
const regionTail = computed(() => (opensRegion.value ? regionNodes.value[regionNodes.value.length - 1]?.value : undefined))

const regionLast = computed(() => regionNodes.value[regionNodes.value.length - 1])
const regionFields = computed(() => regionLast.value?.fields ?? [])
const regionComposition = computed(() => regionLast.value?.composition)

// Counter only when this fold directly reveals real fields. A nested boundary
// reveals another fold, not N parameters, and claiming a number there would
// re-introduce exactly the miscount this candidate exists to remove.
const revealedCount = computed(() => regionFields.value.length)

const schemaComposition = computed(() => {
  if (!regionComposition.value) return null
  const resolved = resolveComponent('SchemaComposition')
  return typeof resolved === 'string' ? null : resolved
})

// Requirement blocks are derived by the model, not the template: the density
// rule (one constraint → one row) is the same fact whether it is rendered here
// or asserted in a test.
const inlineBlocks = computed(() =>
  inlineNodes.value.flatMap(n => describeValueRequirements(n, t.value) ?? []))
const regionBlocks = computed(() =>
  regionNodes.value.flatMap(n => describeValueRequirements(n, t.value) ?? []))


// Deep linking, same contract as the field row: a link into a collapsed value
// root or one of its properties must reveal itself. Membership in the collected
// path set — never a string prefix — decides descendancy.
const anchor = useFieldAnchor()
const regionPaths = computed(() => collectValuePaths(props.value))
const open = shallowRef(false)
watch([() => regionPaths.value.includes(anchor.active.value), anchor.revision], ([hit]) => {
  if (hit) open.value = true
}, { immediate: true })
</script>

<template>
  <div class="mt-3 flex flex-col gap-3">
    <!-- Value format — the fact that keeps the parent row honest. The field
         above still says `string`, because that IS what goes on the wire; this
         row is where "and it carries a JSON object" belongs. -->

    <!-- Owner requirements — the array's / string's / record's OWN rules, under
         a scope heading so "at least 1 element" can never be mistaken for a
         rule about an element. -->

    <!-- Inline value requirements — no structure below, so no chevron. -->
    <template v-for="(block, i) in inlineBlocks" :key="`inline-${i}`">
      <PlaygroundFieldValueRequirements :block="block" :labels="labels" />
    </template>

    <!-- Structure region. One disclosure per boundary the reader crosses. -->
    <UCollapsible
      v-if="opensRegion"
      v-model:open="open"
      :unmount-on-hide="false"
    >
      <template #default="{ open: isOpen }">
        <button
          type="button"
          data-value-structure-toggle
          class="flex touch-manipulation items-center gap-1.5 rounded-sm text-sm font-medium text-primary transition-colors hover:text-primary/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 transition-transform duration-200"
            :class="{ 'rotate-90': isOpen }"
            aria-hidden="true"
          />
          <span>{{ isOpen ? hideVerb : showVerb }}</span>
          <span v-if="revealedCount" class="font-normal text-dimmed">({{ revealedCount }})</span>
        </button>
      </template>

      <template #content>
        <div
          :id="value.path"
          data-value-structure-region
          class="mt-2 flex flex-col gap-3 border-s border-default ps-3 @sm/field:ps-4"
          :class="anchor.SCROLL_MARGIN_CLASS"
        >
          <PlaygroundFieldValueRequirements
            v-for="(block, i) in regionBlocks"
            :key="`region-${i}`"
            :block="block"
            :labels="labels"
          />

          <!-- Real properties. Rendered as field rows, counted as fields,
               anchored by their own paths — nothing synthesized. -->
          <div v-if="regionFields.length" class="-my-1">
            <PlaygroundFieldRow
              v-for="field in regionFields"
              :key="field.path ?? field.name"
              v-bind="field"
              :labels="labels"
            />
          </div>

          <component
            :is="schemaComposition"
            v-if="regionComposition && schemaComposition"
            v-bind="regionComposition"
            :labels="labels?.composition"
            :field-labels="labels"
          />

          <!-- A boundary that did not fold (nested array, JSON inside JSON):
               its own region, one indent deeper. -->
          <PlaygroundFieldValueStructure
            v-if="regionTail"
            :value="regionTail"
            :labels="labels"
            :show-verb="showVerb"
            :hide-verb="hideVerb"
          />
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
