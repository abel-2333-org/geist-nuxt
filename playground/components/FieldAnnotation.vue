<script setup lang="ts">
// Playground candidate → kits/api-docs (ApiDocsFieldAnnotation). Field form of
// the Annotation family: previews a FieldNode summary (name / type /
// requiredness / description) and deep-links into the reference field row.
//
// Two ways to bind a field:
//  1. `field` prop — the page passes the FieldNode directly (it already owns
//     the endpoint's field tree for <ApiDocsFieldItem>).
//  2. `field-ref` prop — resolved against the page-provided field source
//     (useFieldSource), which is what narrative markdown uses:
//       :field-annotation[amount]{field-ref="create-payment.amount"}
//     Cross-page references work the same way: the source entry carries the
//     documenting page's route, and the action becomes a `{page}#{path}` link;
//     the target page's initFromHash() expands + scrolls + flashes on arrival.
//
// Unresolvable `field-ref` degrades to plain text (same policy as
// TermAnnotation) so stale ids never break the narrative.

import type { AnnotationPopoverLabels } from './AnnotationPopover.vue'
import type { FieldNode } from '../../kits/api-docs/components/FieldItem.vue'

export interface FieldAnnotationLabels extends AnnotationPopoverLabels {
  /** Eyebrow caption of the popover. */
  category?: string
  required?: string
  conditional?: string
  /** Caption of the jump-to-field action. */
  viewField?: string
}

const props = withDefaults(
  defineProps<{
    /** The field to preview, passed directly by pages that own the tree. */
    field?: FieldNode
    /** Id resolved against the provided field source (narrative markdown use). */
    fieldRef?: string
    /** Explicit cross-page link; overrides what the field source derives. */
    to?: string
    labels?: FieldAnnotationLabels
  }>(),
  { labels: () => ({}) },
)

const t = computed<Required<Pick<FieldAnnotationLabels, 'category' | 'required' | 'conditional' | 'viewField'>>>(() => ({
  category: 'Field',
  required: 'Required',
  conditional: 'Conditional',
  viewField: 'View field details',
  ...props.labels,
}))

const source = useFieldSource()
const entry = computed(() => (props.fieldRef ? source[props.fieldRef] : undefined))
const node = computed<FieldNode | undefined>(() => props.field ?? entry.value?.field)

const route = useRoute()
const anchor = useFieldAnchor()

/** Cross-page when the source entry names a different documenting page. */
const crossPageTo = computed(() => {
  if (props.to) return props.to
  const page = entry.value?.page
  if (!page || page === route.path) return undefined
  // Without an anchor path the link still navigates to the documenting page.
  return node.value?.path ? `${page}#${node.value.path}` : page
})

/** Same-page deep link only works when the node carries its anchor path. */
const canJump = computed(() => !crossPageTo.value && Boolean(node.value?.path))

function jump(close: () => void) {
  close()
  if (node.value?.path) void anchor.goTo(node.value.path)
}
</script>

<template>
  <PlaygroundAnnotationPopover
    v-if="node"
    :label="t.category"
    icon="i-lucide-braces"
    trigger-class="font-mono text-code decoration-(--ui-primary)/50 hover:decoration-(--ui-primary)"
    :labels="labels"
  >
    <slot>{{ node.name }}</slot>

    <template #content>
      <p class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <InlineCode>{{ node.name }}</InlineCode>
        <span class="font-mono text-xs text-muted">{{ node.type }}</span>
        <span v-if="node.required === true" class="text-xs font-medium text-error">
          {{ t.required }}
        </span>
        <span v-else-if="node.required === 'conditional'" class="text-xs font-medium text-warning">
          {{ t.conditional }}
        </span>
      </p>
      <p v-if="node.description" class="line-clamp-4 leading-relaxed text-muted">
        <InlineMarkdown :text="node.description" />
      </p>
    </template>

    <template v-if="canJump || crossPageTo" #actions="{ close }">
      <UButton
        v-if="canJump"
        color="neutral"
        variant="ghost"
        size="xs"
        trailing-icon="i-lucide-arrow-right"
        @click="jump(close)"
      >
        {{ t.viewField }}
      </UButton>
      <UButton
        v-else
        :to="crossPageTo"
        color="neutral"
        variant="ghost"
        size="xs"
        trailing-icon="i-lucide-arrow-right"
      >
        {{ t.viewField }}
      </UButton>
    </template>
  </PlaygroundAnnotationPopover>

  <!-- Unresolvable ref: degrade to plain text, never a broken control. -->
  <span v-else><slot>{{ fieldRef }}</slot></span>
</template>
