<script setup lang="ts">
// Playground candidate → kits/api-docs (ApiDocsSchemaComposition).
// Renders an OpenAPI / JSON Schema composition block faithfully:
//   oneOf  → exclusive alternatives   → UTabs (one variant at a time)
//   anyOf  → non-exclusive options    → stacked collapsible sections
//   allOf  → conjunction              → fully expanded sections, no selector
// plus the optional discriminator (property + complete wire-value mapping).
//
// Input is a presentation-neutral display model (CompositionNode) — the
// component never parses an OpenAPI document and never depends on a
// consumer's contract types. Schema variants and example scenarios are two
// different concepts: this API does not assume shared ids or any linkage.
//
// Anchor strategy: field `path`s are real anchor ids namespaced by variant id
// (e.g. `request-body_card_token`) — identity layer only, never shown as a
// wire path. The component watches the shared active anchor and reveals the
// containing variant (switch tab / expand section) so useFieldAnchor's
// existing element polling + stable-layout scroll works unchanged. oneOf
// panels stay in the DOM via `unmount-on-hide=false`.
//
// Spec: playground/composition.spec.md (issue #31).

import type { TabsItem } from '@nuxt/ui'
import type { FieldItemLabels, FieldNode } from '../../kits/api-docs/components/FieldItem.vue'

export type CompositionKind = 'oneOf' | 'anyOf' | 'allOf'

export interface CompositionVariant {
  /** Stable identity: tab selection, discriminator mapping target, and anchor
   *  namespace segment. Never rendered as part of a wire path. */
  id: string
  /** Localized variant title (user content, rendered verbatim). */
  label: string
  description?: string
  /** The variant's field tree; each `path` is a real anchor id. */
  fields: FieldNode[]
  /** Nested composition inside this variant (recursive). */
  composition?: CompositionNode
}

export interface CompositionDiscriminator {
  /** The discriminating payload property, e.g. `type`. */
  propertyName: string
  /** Complete wire value → variant id mapping, order preserved. */
  mapping: Array<{ value: string, variantId: string }>
}

export interface CompositionNode {
  kind: CompositionKind
  /** Order preserved, ids stable. */
  variants: CompositionVariant[]
  discriminator?: CompositionDiscriminator
}

/** Component-owned chrome copy, overridable for i18n (FieldItem convention). */
export interface SchemaCompositionLabels {
  oneOf?: string
  anyOf?: string
  allOf?: string
  /** Assistive sentence under the kind eyebrow. Visible text, not color-only. */
  oneOfHint?: string
  anyOfHint?: string
  allOfHint?: string
  /** Lead-in before the discriminator property. */
  discriminatedBy?: string
  /** Lead-in before a variant's wire form, e.g. `type = "card"`. */
  sentAs?: string
  showFields?: string
  hideFields?: string
  empty?: string
  /** aria-label factory for a mapping row (full sentence, caller-owned). */
  goToVariant?: (variantLabel: string) => string
}

// Recursive self-reference name (playground prefix; becomes
// ApiDocsSchemaComposition on promotion).
defineOptions({ name: 'PlaygroundSchemaComposition' })

const props = withDefaults(
  defineProps<CompositionNode & {
    labels?: SchemaCompositionLabels
    /** Passed through to the ApiDocsFieldItem rows. */
    fieldLabels?: FieldItemLabels
    /** Outline level of variant section headings (anyOf/allOf); nested
     *  compositions render one level deeper, capped at 6. */
    headingLevel?: 3 | 4 | 5
  }>(),
  {
    labels: () => ({}),
    headingLevel: 4,
  },
)

// Merge caller copy over neutral English defaults. Chrome text only —
// variant labels/descriptions are data and render verbatim.
const t = computed<Required<SchemaCompositionLabels>>(() => ({
  oneOf: 'One of',
  anyOf: 'Any of',
  allOf: 'All of',
  oneOfHint: 'Exactly one of the following applies.',
  anyOfHint: 'One or more of the following may apply.',
  allOfHint: 'All of the following apply.',
  discriminatedBy: 'Discriminated by',
  sentAs: 'Sent as',
  showFields: 'Show Fields',
  hideFields: 'Hide Fields',
  empty: 'No variants documented',
  goToVariant: (variantLabel: string) => `Go to variant ${variantLabel}`,
  ...props.labels,
}))

const hint = computed(() => t.value[`${props.kind}Hint` as const])

// ---------------------------------------------------------------------------
// Anchor containment. A variant "contains" the active anchor when the anchor
// equals or descends from any real field path inside it — including paths in
// nested compositions, so an inner deep link also reveals the outer variant.
// ---------------------------------------------------------------------------
function collectPaths(variant: CompositionVariant): string[] {
  const out: string[] = []
  const walkFields = (fields: FieldNode[]) => {
    for (const f of fields) {
      if (f.path) out.push(f.path)
      if (f.children?.length) walkFields(f.children)
    }
  }
  walkFields(variant.fields)
  if (variant.composition) {
    for (const nested of variant.composition.variants) out.push(...collectPaths(nested))
  }
  return out
}

const variantPaths = computed(() =>
  props.variants.map(v => ({ id: v.id, paths: collectPaths(v) })),
)

function containingVariantId(active: string): string | undefined {
  if (!active) return undefined
  return variantPaths.value.find(({ paths }) =>
    paths.some(p => active === p || active.startsWith(`${p}_`)),
  )?.id
}

const anchor = useFieldAnchor()

// ---------------------------------------------------------------------------
// oneOf — controlled tab per variant (value = stable variant id). Panels are
// real tabpanels kept in the DOM (unmount-on-hide=false) so hash polling can
// find rows inside unselected variants; switching the tab reactively makes
// the target visible before the composable's stable-layout scroll runs.
// ---------------------------------------------------------------------------
const activeTab = ref(props.variants[0]?.id ?? '')

const tabItems = computed<TabsItem[]>(() =>
  props.variants.map(v => ({ label: v.label, value: v.id })),
)

// ---------------------------------------------------------------------------
// anyOf — independent open state per variant (non-exclusive by design: any
// number of sections can be open at once). Auto-open mirrors FieldItem's
// descendant-active pattern: a real mutation on/after mount, not a computed
// getter, so SSR renders closed and hydration animates reliably.
// ---------------------------------------------------------------------------
const open = reactive<Record<string, boolean>>(
  Object.fromEntries(props.variants.map(v => [v.id, false])),
)

function reveal(active: string) {
  const id = containingVariantId(active)
  if (!id) return
  if (props.kind === 'oneOf') activeTab.value = id
  else if (props.kind === 'anyOf') open[id] = true
}

onMounted(() => reveal(anchor.active.value))
watch(anchor.active, reveal)

// ---------------------------------------------------------------------------
// Discriminator helpers.
// ---------------------------------------------------------------------------
const variantById = computed(() => new Map(props.variants.map(v => [v.id, v])))

/** Reverse lookup: this variant's wire value under the discriminator. */
function wireValueFor(variantId: string): string | undefined {
  return props.discriminator?.mapping.find(m => m.variantId === variantId)?.value
}

// A mapping row is a shortcut, not the semantics: it switches/expands the
// variant the wire value points at. Never navigates or scrolls on its own.
function focusVariant(variantId: string) {
  if (props.kind === 'oneOf') activeTab.value = variantId
  else open[variantId] = true
}

const headingTag = computed(() => `h${props.headingLevel}`)
const nestedHeadingLevel = computed(() => Math.min(props.headingLevel + 1, 5) as 3 | 4 | 5)
</script>

<template>
  <section class="space-y-3">
    <!-- Semantic head: kind eyebrow in the FieldGroup `LABEL (N)` grammar,
         plus a visible assistive sentence so the composition rule is read,
         not inferred from layout. -->
    <div class="space-y-1">
      <p class="font-mono text-xs font-semibold uppercase tracking-widest text-muted">
        {{ t[kind] }}
        <span class="text-dimmed">({{ variants.length }})</span>
      </p>
      <p class="text-sm leading-relaxed text-muted">
        {{ hint }}
      </p>
    </div>

    <!-- Discriminator: property lead-in + complete wire-value mapping. Rows
         are real buttons that reveal the mapped variant. Copy stays neutral —
         the discriminator hints at the concrete schema, it does not validate. -->
    <div v-if="discriminator" class="space-y-2">
      <p class="text-sm leading-relaxed">
        <span class="mr-2 text-xs font-medium uppercase tracking-wide text-dimmed">{{ t.discriminatedBy }}</span>
        <InlineCode>{{ discriminator.propertyName }}</InlineCode>
      </p>
      <!-- One shared grid (subgrid rows) so every variant label starts at the
           same x — same table language as EnumTable/constraints. -->
      <div class="grid grid-cols-[fit-content(12rem)_1fr_auto] divide-y divide-default overflow-hidden rounded-lg border border-default">
        <button
          v-for="row in discriminator.mapping"
          :key="row.value"
          type="button"
          :aria-label="t.goToVariant(variantById.get(row.variantId)?.label ?? row.variantId)"
          class="col-span-3 grid grid-cols-subgrid items-baseline gap-x-4 bg-muted/40 px-3 py-2.5 text-start transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          @click="focusVariant(row.variantId)"
        >
          <InlineCode class="break-all">{{ row.value }}</InlineCode>
          <span class="min-w-0 text-sm leading-relaxed text-muted">
            {{ variantById.get(row.variantId)?.label ?? row.variantId }}
          </span>
          <UIcon
            name="i-lucide-corner-down-right"
            class="size-3.5 self-center text-dimmed"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <p
      v-if="!variants.length"
      class="rounded-lg border border-default bg-muted/40 px-3 py-4 text-sm text-dimmed"
    >
      {{ t.empty }}
    </p>

    <!-- oneOf: exclusive alternatives → tabs. Same pill/xs language as the
         EnumTable variant selector. Panels keep their DOM for deep links. -->
    <UTabs
      v-else-if="kind === 'oneOf'"
      v-model="activeTab"
      :items="tabItems"
      :unmount-on-hide="false"
      color="neutral"
      variant="pill"
      size="xs"
      class="w-full gap-3"
    >
      <template #content="{ item }">
        <div
          v-if="variantById.get(String(item.value))"
          class="flex flex-col gap-3"
        >
          <template v-for="v in [variantById.get(String(item.value))!]" :key="v.id">
            <!-- Wire form marker ties the tab back to the discriminator table.
                 Identity (`v.id`) never renders; only the real payload shape. -->
            <p v-if="discriminator && wireValueFor(v.id)" class="text-sm leading-relaxed">
              <span class="mr-2 text-xs font-medium uppercase tracking-wide text-dimmed">{{ t.sentAs }}</span>
              <InlineCode>{{ discriminator.propertyName }} = "{{ wireValueFor(v.id) }}"</InlineCode>
            </p>
            <p v-if="v.description" class="text-sm leading-relaxed text-toned">
              <InlineMarkdown :text="v.description" />
            </p>
            <div v-if="v.fields.length">
              <ApiDocsFieldItem
                v-for="field in v.fields"
                :key="field.path ?? field.name"
                v-bind="field"
                :labels="fieldLabels"
              />
            </div>
            <PlaygroundSchemaComposition
              v-if="v.composition"
              v-bind="v.composition"
              :labels="labels"
              :field-labels="fieldLabels"
              :heading-level="nestedHeadingLevel"
              class="border-s border-default ps-4"
            />
          </template>
        </div>
      </template>
    </UTabs>

    <!-- anyOf: non-exclusive options → independently collapsible sections.
         Never a selector: any number can be open at once. -->
    <div
      v-else-if="kind === 'anyOf'"
      class="divide-y divide-default overflow-hidden rounded-lg border border-default"
    >
      <UCollapsible
        v-for="v in variants"
        :key="v.id"
        v-model:open="open[v.id]"
        :unmount-on-hide="false"
      >
        <template #default="{ open: isOpen }">
          <component :is="headingTag">
            <button
              type="button"
              class="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-start transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 shrink-0 text-dimmed transition-transform duration-200"
                :class="{ 'rotate-90': isOpen }"
                aria-hidden="true"
              />
              <span class="text-sm font-medium text-highlighted">{{ v.label }}</span>
              <InlineCode v-if="discriminator && wireValueFor(v.id)" class="text-xs">
                {{ discriminator.propertyName }} = "{{ wireValueFor(v.id) }}"
              </InlineCode>
              <!-- `(N)` count grammar: how much is behind the fold. -->
              <span class="text-sm font-normal text-dimmed">({{ v.fields.length }})</span>
              <span class="sr-only">{{ isOpen ? t.hideFields : t.showFields }}</span>
            </button>
          </component>
        </template>
        <template #content>
          <div class="flex flex-col gap-3 px-3 pb-3 ps-9">
            <p v-if="v.description" class="text-sm leading-relaxed text-toned">
              <InlineMarkdown :text="v.description" />
            </p>
            <div v-if="v.fields.length">
              <ApiDocsFieldItem
                v-for="field in v.fields"
                :key="field.path ?? field.name"
                v-bind="field"
                :labels="fieldLabels"
              />
            </div>
            <PlaygroundSchemaComposition
              v-if="v.composition"
              v-bind="v.composition"
              :labels="labels"
              :field-labels="fieldLabels"
              :heading-level="nestedHeadingLevel"
            />
          </div>
        </template>
      </UCollapsible>
    </div>

    <!-- allOf: conjunction → every part fully expanded in order. Never tabs,
         never collapsibles: nothing here is optional to read. -->
    <div v-else class="flex flex-col gap-5">
      <section v-for="v in variants" :key="v.id" class="space-y-2">
        <component
          :is="headingTag"
          class="flex flex-wrap items-baseline gap-x-2 border-b border-default pb-1.5 text-sm font-medium text-highlighted"
        >
          {{ v.label }}
          <span class="text-sm font-normal text-dimmed">({{ v.fields.length }})</span>
        </component>
        <p v-if="v.description" class="text-sm leading-relaxed text-toned">
          <InlineMarkdown :text="v.description" />
        </p>
        <div v-if="v.fields.length">
          <ApiDocsFieldItem
            v-for="field in v.fields"
            :key="field.path ?? field.name"
            v-bind="field"
            :labels="fieldLabels"
          />
        </div>
        <PlaygroundSchemaComposition
          v-if="v.composition"
          v-bind="v.composition"
          :labels="labels"
          :field-labels="fieldLabels"
          :heading-level="nestedHeadingLevel"
          class="border-s border-default ps-4"
        />
      </section>
    </div>
  </section>
</template>
