<script setup lang="ts">
// Domain component (API docs): ApiDocsSchemaComposition.
// Renders an OpenAPI / JSON Schema composition block faithfully:
//   oneOf  → exclusive alternatives   → UTabs (one variant at a time)
//   anyOf  → non-exclusive options    → stacked collapsible sections
//   allOf  → conjunction              → fully expanded sections, no selector
// plus the optional discriminator, rendered as the first real field row of
// each mapped variant ("provider · string · required · Always `google_pay`.")
// — one vocabulary (the field list), no caption labels, no mapping table.
//
// Input is a presentation-neutral display model (CompositionNode) — the
// component never parses an OpenAPI document and never depends on a
// consumer's contract types. Schema variants and example scenarios are two
// different concepts: this API does not assume shared ids or any linkage.
//
// Anchor strategy: field `path`s are real anchor ids namespaced by variant id
// (e.g. `request-body_card_token`) — identity layer only, never shown as a
// wire path. The component watches the shared active anchor and reveals the
// containing variant (switch tab / expand section) on every navigation event,
// including a repeated link to the same path. oneOf
// panels stay in the DOM via `unmount-on-hide=false`.
//
// Reference: references/kits/api-docs/schema-composition.md (issue #31).

import type { TabsItem } from '@nuxt/ui'
// The composition + field display model lives in the co-slice util
// `utils/field.ts`. Nuxt auto-imports this kit's `utils/` dir, so the types
// (CompositionNode, CompositionVariant, CompositionDiscriminator,
// SchemaCompositionLabels, HeadingLevel, FieldNode, FieldItemLabels) are
// referenced bare here with no import statement — same pattern as the
// lifecycle/method preset types. Callers import the model from `~/utils/field`.

// Recursive self-reference name (kit uses pathPrefix: false, so the global
// component name is ApiDocsSchemaComposition); declared explicitly so the
// template's recursion resolves.
defineOptions({ name: 'ApiDocsSchemaComposition' })

type SchemaCompositionProps = CompositionNode & {
  labels?: SchemaCompositionLabels
  /** Passed through to the ApiDocsFieldItem rows. */
  fieldLabels?: FieldItemLabels
  /** Outline level of variant section headings (anyOf/allOf); nested
   *  compositions render one level deeper, capped at 6. */
  headingLevel?: HeadingLevel
}

const props = withDefaults(
  defineProps<SchemaCompositionProps>(),
  {
    labels: () => ({}),
    headingLevel: 4,
  },
)

// Merge caller copy over neutral English defaults. Chrome text only —
// variant labels/descriptions are data and render verbatim.
function discriminatorValue(value: string) {
  return value === '' ? '`""`' : `\`${value}\``
}

const t = computed<Required<SchemaCompositionLabels>>(() => ({
  oneOf: 'One of',
  anyOf: 'Any of',
  allOf: 'All of',
  oneOfHint: 'Exactly one of the following applies.',
  anyOfHint: 'One or more of the following may apply.',
  allOfHint: 'All of the following apply.',
  discriminatorDescription: (values: readonly string[]) => values.length === 1
    ? `Always ${discriminatorValue(values[0]!)}.`
    : `One of ${values.map(discriminatorValue).join(', ')}.`,
  empty: 'No variants documented',
  ...props.labels,
}))

const hint = computed(() => t.value[`${props.kind}Hint` as const])

// FieldItem has one labels object for its own chrome and every nested slice.
// Merge this component's labels into that object so a field-level composition
// nested anywhere below inherits the same localized schema vocabulary.
const itemLabels = computed<FieldItemLabels>(() => ({
  ...props.fieldLabels,
  composition: {
    ...props.fieldLabels?.composition,
    ...props.labels,
  },
}))

// ---------------------------------------------------------------------------
// Anchor containment. A variant "contains" the active anchor when the anchor
// equals or descends from any real field path inside it — including paths in
// nested compositions, so an inner deep link also reveals the outer variant.
// ---------------------------------------------------------------------------
function collectPaths(variant: CompositionVariant): string[] {
  const out = collectFieldPaths(variant.fields)
  if (variant.composition) {
    out.push(...collectCompositionPaths(variant.composition))
  }
  return out
}

const variantPaths = computed(() =>
  props.variants.map(v => ({ id: v.id, paths: collectPaths(v) })),
)

function containingVariantId(active: string): string | undefined {
  if (!active) return undefined
  const exact = variantPaths.value.find(({ paths }) => paths.includes(active))
  if (exact) return exact.id

  // Prefixes may overlap (`item` and `item_detail`). Prefer the most specific
  // path globally; ties preserve variant/path order.
  let match: { id: string, length: number } | undefined
  for (const variant of variantPaths.value) {
    for (const path of variant.paths) {
      if (active.startsWith(`${path}_`) && (!match || path.length > match.length)) {
        match = { id: variant.id, length: path.length }
      }
    }
  }
  return match?.id
}

const anchor = useFieldAnchor()

// ---------------------------------------------------------------------------
// oneOf — controlled tab per variant (value = stable variant id). Panels are
// real tabpanels kept in the DOM (unmount-on-hide=false) so hash polling can
// find rows inside unselected variants; switching the tab reactively makes
// the target visible before the composable's stable-layout scroll runs.
// ---------------------------------------------------------------------------
const activeTab = shallowRef('')

const variantIds = computed(() => props.variants.map(v => v.id))

// ---------------------------------------------------------------------------
// anyOf — independent open state per variant (non-exclusive by design: any
// number of sections can be open at once). Auto-open mirrors FieldItem's
// descendant-active pattern: a real mutation on/after mount, not a computed
// getter, so SSR renders closed and hydration animates reliably.
// ---------------------------------------------------------------------------
const open = reactive<Record<string, boolean>>({})

function syncOpen(ids: string[]) {
  const current = new Set(ids)
  for (const id of Object.keys(open)) {
    if (!current.has(id)) delete open[id]
  }
  for (const id of ids) {
    if (!(id in open)) open[id] = false
  }
}

function reveal(active: string) {
  const id = containingVariantId(active)
  if (!id) return
  if (props.kind === 'oneOf') activeTab.value = id
  else if (props.kind === 'anyOf') open[id] = true
}

watch(
  [() => props.kind, variantIds, variantPaths, anchor.active, anchor.revision],
  ([kind, ids, _paths, active]) => {
    syncOpen(ids)
    if (kind === 'oneOf' && !ids.includes(activeTab.value)) {
      activeTab.value = ids[0] ?? ''
    }
    reveal(active)
  },
  { immediate: true },
)

// ---------------------------------------------------------------------------
// Discriminator → a real field row. The discriminator IS a payload property,
// so it renders as the first FieldItem of each mapped variant (`provider`
// string · required · "Always `google_pay`.") — same language as every other
// field, no dedicated caption vocabulary. No `path`: the row repeats across
// variants, so it is not individually deep-linkable.
// ---------------------------------------------------------------------------
function buildFields(variant: CompositionVariant): FieldNode[] {
  if (props.kind === 'allOf' || !props.discriminator) return variant.fields

  const values = props.discriminator.mapping
    .filter(mapping => mapping.variantId === variant.id)
    .map(mapping => mapping.value)
  if (!values.length) return variant.fields

  const index = variant.fields.findIndex(field => field.name === props.discriminator!.propertyName)
  const current = index >= 0 ? variant.fields[index] : undefined
  const mappingDescription = t.value.discriminatorDescription(values)
  const discriminator: FieldNode = current
    ? {
        ...current,
        required: true,
        description: current.description
          ? `${mappingDescription} ${current.description}`
          : mappingDescription,
      }
    : {
        name: props.discriminator.propertyName,
        type: 'string',
        required: true,
        description: mappingDescription,
      }

  return [discriminator, ...variant.fields.filter((_, fieldIndex) => fieldIndex !== index)]
}

interface CompositionVariantView {
  variant: CompositionVariant
  fields: FieldNode[]
  /** Top-level documented items behind a variant: fields + nested block. */
  count: number
}

type CompositionTabItem = TabsItem & { view: CompositionVariantView }

const variantViews = computed<CompositionVariantView[]>(() =>
  props.variants.map((variant) => {
    const fields = buildFields(variant)
    return {
      variant,
      fields,
      count: fields.length + (variant.composition ? 1 : 0),
    }
  }),
)

const tabItems = computed<CompositionTabItem[]>(() =>
  variantViews.value.map(view => ({
    label: view.variant.label,
    value: view.variant.id,
    view,
  })),
)

const headingTag = computed(() => `h${props.headingLevel}`)
const nestedHeadingLevel = computed(() => Math.min(props.headingLevel + 1, 6) as HeadingLevel)
const contentIdBase = useId()

function contentId(variantId: string) {
  // ARIA resolves ids as opaque strings. Callers and tests must use
  // getElementById rather than interpolating this encoded id into a selector.
  return `${contentIdBase}-composition-${encodeURIComponent(variantId)}`
}

function toggleVariant(variantId: string) {
  open[variantId] = !open[variantId]
}
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
      <!-- One short plain-language sentence; discriminator details live in
           the field list, not up here. -->
      <p class="text-sm leading-relaxed text-muted">
        {{ hint }}
      </p>
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
        <div class="flex flex-col gap-3">
          <p v-if="item.view.variant.description" class="text-sm leading-relaxed text-toned">
            <InlineMarkdown :text="item.view.variant.description" />
          </p>
          <!-- The discriminator renders as the first real field row
               (synthesized in buildFields), not as a caption. -->
          <div v-if="item.view.fields.length">
            <ApiDocsFieldItem
              v-for="field in item.view.fields"
              :key="field.path ?? field.name"
              v-bind="field"
              :labels="itemLabels"
            />
          </div>
          <ApiDocsSchemaComposition
            v-if="item.view.variant.composition"
            v-bind="item.view.variant.composition"
            :labels="labels"
            :field-labels="fieldLabels"
            :heading-level="nestedHeadingLevel"
            class="border-s border-default ps-4"
          />
        </div>
      </template>
    </UTabs>

    <!-- anyOf: non-exclusive options → independently collapsible sections.
         Never a selector: any number can be open at once. -->
    <div
      v-else-if="kind === 'anyOf'"
      class="divide-y divide-default overflow-hidden rounded-lg border border-default"
    >
      <section
        v-for="view in variantViews"
        :key="view.variant.id"
      >
        <component :is="headingTag">
          <button
            type="button"
            class="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-start transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            :aria-expanded="open[view.variant.id] ?? false"
            :aria-controls="contentId(view.variant.id)"
            @click="toggleVariant(view.variant.id)"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 shrink-0 text-dimmed transition-transform duration-200"
              :class="{ 'rotate-90': open[view.variant.id] }"
              aria-hidden="true"
            />
            <span class="text-sm font-medium text-highlighted">{{ view.variant.label }}</span>
            <!-- `(N)` count grammar: how much is behind the fold. -->
            <span v-if="view.count" class="text-sm font-normal text-dimmed">({{ view.count }})</span>
          </button>
        </component>
        <UCollapsible
          v-model:open="open[view.variant.id]"
          :unmount-on-hide="false"
        >
          <template #content>
            <div
              :id="contentId(view.variant.id)"
              class="flex flex-col gap-3 px-3 pb-3 ps-9"
            >
              <p v-if="view.variant.description" class="text-sm leading-relaxed text-toned">
                <InlineMarkdown :text="view.variant.description" />
              </p>
              <div v-if="view.fields.length">
                <ApiDocsFieldItem
                  v-for="field in view.fields"
                  :key="field.path ?? field.name"
                  v-bind="field"
                  :labels="itemLabels"
                />
              </div>
              <ApiDocsSchemaComposition
                v-if="view.variant.composition"
                v-bind="view.variant.composition"
                :labels="labels"
                :field-labels="fieldLabels"
                :heading-level="nestedHeadingLevel"
              />
            </div>
          </template>
        </UCollapsible>
      </section>
    </div>

    <!-- allOf: conjunction → every part fully expanded in order. Never tabs,
         never collapsibles: nothing here is optional to read. -->
    <div v-else class="flex flex-col gap-5">
      <section v-for="view in variantViews" :key="view.variant.id" class="space-y-2">
        <component
          :is="headingTag"
          class="flex flex-wrap items-baseline gap-x-2 border-b border-default pb-1.5 text-sm font-medium text-highlighted"
        >
          {{ view.variant.label }}
          <span v-if="view.count" class="text-sm font-normal text-dimmed">({{ view.count }})</span>
        </component>
        <p v-if="view.variant.description" class="text-sm leading-relaxed text-toned">
          <InlineMarkdown :text="view.variant.description" />
        </p>
        <div v-if="view.fields.length">
          <ApiDocsFieldItem
            v-for="field in view.fields"
            :key="field.path ?? field.name"
            v-bind="field"
            :labels="itemLabels"
          />
        </div>
        <ApiDocsSchemaComposition
          v-if="view.variant.composition"
          v-bind="view.variant.composition"
          :labels="labels"
          :field-labels="fieldLabels"
          :heading-level="nestedHeadingLevel"
          class="border-s border-default ps-4"
        />
      </section>
    </div>
  </section>
</template>
