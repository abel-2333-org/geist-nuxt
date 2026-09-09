<script setup lang="ts">
// Renders "what this field's VALUE requires and contains", for values that are
// array elements, record members, or the content inside an encoded string.
// Internal helper of FieldItem: distributed with the api-docs-field-item
// slice, imported relatively by FieldItem, never used directly by a consumer.
//
// WHAT IT IS NOT
// It is not a field renderer. Every block below describes a value that has no
// business name, which is exactly why a consumer could not express it through
// `children` without inventing one. Real properties are handed straight back
// to <FieldItem> and are the only things counted.
//
// DISCLOSURE POLICY (the whole design, in three lines)
//   · nothing structural below  → no chevron at all; the rules read inline.
//   · structure below           → exactly one region, opened by the boundary
//                                 the reader actually crosses.
//   · encoded array             → decode boundary and element boundary share
//                                 that one region (see foldsIntoParentRegion).
//
// Anatomy: inline requirements
//          | region( requirements per folded node → real fields → composition
//                    → nested region for a deeper boundary )
import {
  collectValuePaths,
  describeValueRequirements,
  foldsIntoParentRegion,
  hasStructureBelow,
} from '../utils/field'
import type { FieldItemLabels, FieldValueChrome, FieldValueNode } from '../utils/field'
import FieldValueRequirements from './FieldValueRequirements.vue'

// Self-recursion (a boundary that did not fold renders as a nested region).
defineOptions({ name: 'FieldValueStructure' })

const props = defineProps<{
  value: FieldValueNode
  /**
   * Chrome already resolved by the owner FieldItem against its defaults, so
   * every default string exists once. The fold reuses `showChildren` /
   * `hideChildren` from it and adds no verb strings of its own.
   */
  chrome: FieldValueChrome
  /** The owner row's raw labels object — recursive FieldItem rows and nested
   *  chrome (EnumTable, SchemaComposition) read it unchanged. */
  labels?: FieldItemLabels
}>()

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

/** Levels that share this region. More than one only for an encoded array. */
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
const regionLast = computed(() => regionNodes.value[regionNodes.value.length - 1])
const regionTail = computed(() => (opensRegion.value ? regionLast.value?.value : undefined))
const regionFields = computed(() => regionLast.value?.fields ?? [])
const regionComposition = computed(() => regionLast.value?.composition)

// Counter only when this fold directly reveals real fields. A nested boundary
// reveals another fold, not N parameters, and claiming a number there would
// re-introduce exactly the miscount the value model exists to remove.
const revealedCount = computed(() => regionFields.value.length)

// Same one-way optional lookup as FieldItem: SchemaComposition is a higher
// slice that depends on FieldItem, so it is resolved only when present.
const schemaComposition = computed(() => {
  if (!regionComposition.value) return null
  const resolved = resolveComponent('SchemaComposition')
  return typeof resolved === 'string' ? null : resolved
})

// Requirement blocks are derived by the model, not the template: the density
// rule (one constraint → one row) is the same fact whether it is rendered here
// or asserted in a test.
const inlineBlocks = computed(() =>
  inlineNodes.value.flatMap(n => describeValueRequirements(n, props.chrome) ?? []))
// Identity-only nodes still own public anchors. They overlay the containing
// field (or enclosing value region) without creating an empty requirements row.
const inlineAnchorNodes = computed(() => inlineNodes.value.filter(node =>
  node.path && !describeValueRequirements(node, props.chrome)))
const regionEntries = computed(() => regionNodes.value.map(node => ({
  node,
  block: describeValueRequirements(node, props.chrome),
})).filter(entry => entry.block || entry.node === regionLast.value))

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
  <span
    v-for="node in inlineAnchorNodes"
    :id="node.path"
    :key="node.path"
    class="pointer-events-none absolute inset-0 rounded-md outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="anchor.SCROLL_MARGIN_CLASS"
  >
    <span
      data-field-arrival-cue
      class="pointer-events-none absolute inset-0 rounded-md bg-primary/10 opacity-0 ring-1 ring-primary"
      aria-hidden="true"
    />
  </span>
  <!-- A value that only states identity facts (codec / type, already printed
       on the owner's identity line) has nothing to add below the row. -->
  <div v-if="inlineBlocks.length || opensRegion" class="mt-3 flex flex-col gap-3">
    <!-- Inline value requirements — no structure below, so no chevron. -->
    <div
      v-for="(block, i) in inlineBlocks"
      :key="`inline-${i}`"
      :id="block.node.path"
      class="relative rounded-md outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary"
      :class="anchor.SCROLL_MARGIN_CLASS"
    >
      <span
        v-if="block.node.path"
        data-field-arrival-cue
        class="pointer-events-none absolute inset-0 rounded-md bg-primary/10 opacity-0 ring-1 ring-primary"
        aria-hidden="true"
      />
      <FieldValueRequirements :block="block" :chrome="chrome" :labels="labels" />
    </div>

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
          <span>{{ isOpen ? chrome.hideChildren : chrome.showChildren }}</span>
          <span v-if="revealedCount" class="font-normal text-dimmed">({{ revealedCount }})</span>
        </button>
      </template>

      <template #content>
        <!-- The region is the value root's own anchor target (`value.path`),
             so it carries the same arrival cue overlay and focus outline as a
             field row: useFieldAnchor focuses the id'd element and flashes the
             first cue inside it, which must be this region's, not a nested
             row's. -->
        <div
          :id="value.path"
          data-value-structure-region
          class="relative mt-2 flex flex-col gap-3 rounded-md border-s border-default ps-3 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary @sm/field:ps-4"
          :class="anchor.SCROLL_MARGIN_CLASS"
        >
          <span
            v-if="value.path"
            data-field-arrival-cue
            class="pointer-events-none absolute inset-0 rounded-md bg-primary/10 opacity-0 ring-1 ring-primary"
            aria-hidden="true"
          />
          <!-- A folded node retains its own anchor around its actual content;
               sharing a disclosure does not merge public path identities. -->
          <div
            v-for="(entry, i) in regionEntries"
            :key="`region-${i}`"
            :id="entry.node !== value ? entry.node.path : undefined"
            class="relative flex flex-col gap-3 rounded-md outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="anchor.SCROLL_MARGIN_CLASS"
          >
            <span
              v-if="entry.node !== value && entry.node.path"
              data-field-arrival-cue
              class="pointer-events-none absolute inset-0 rounded-md bg-primary/10 opacity-0 ring-1 ring-primary"
              aria-hidden="true"
            />
            <FieldValueRequirements
              v-if="entry.block"
              :block="entry.block"
              :chrome="chrome"
              :labels="labels"
            />

            <!-- Real properties. Rendered as field rows, counted as fields,
                 anchored by their own paths — nothing synthesized. -->
            <div v-if="entry.node === regionLast && regionFields.length" class="-my-1">
              <FieldItem
                v-for="field in regionFields"
                :key="field.path ?? field.name"
                v-bind="field"
                :labels="labels"
              />
            </div>

            <component
              :is="schemaComposition"
              v-if="entry.node === regionLast && regionComposition && schemaComposition"
              v-bind="regionComposition"
              :labels="labels?.composition"
              :field-labels="labels"
            />

            <!-- A boundary that did not fold (nested array, JSON inside JSON):
                 its own region, one indent deeper. -->
            <FieldValueStructure
              v-if="entry.node === regionLast && regionTail"
              :value="regionTail"
              :chrome="chrome"
              :labels="labels"
            />
          </div>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
