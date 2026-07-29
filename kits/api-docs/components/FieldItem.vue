<script lang="ts">
// Keep the pre-util public type surface for existing consumers. New code should
// import from `~/utils/field`, while these type-only exports bridge copy-in
// projects that still import directly from FieldItem.vue.
export type {
  EnumValue,
  EnumVariant,
  FieldItemLabels,
  FieldLifecycle,
  FieldLifecycleInfo,
  FieldNode,
  FieldNote,
  RequiredState,
} from '#imports'
</script>

<script setup lang="ts">
// Domain component (API docs): renders one field row of an endpoint's schema —
// name/type/requiredness summary, a secondary metadata band (condition, enum,
// constraints, example, lifecycle), and recursive object/array subfields.
//
// The field data model (FieldNode, FieldItemLabels and friends) lives in the
// co-slice util `utils/field.ts`. Nuxt auto-imports this kit's `utils/` dir,
// so those types — and the composition model on `FieldNode.composition` — are
// referenced bare here with no import statement (same pattern as the lifecycle/
// method preset types). Callers that need the model import it from
// `~/utils/field`, the single canonical home.
//
// Composed from Nuxt UI primitives (UIcon, UCollapsible) + core atoms
// (InlineCode and InlineMarkdown from foundation) + kit siblings
// (ApiDocsEnumTable, ApiDocsLifecycleBadge, and ApiDocsSchemaComposition for
// field-level composition). Deep linking is handled by the kit's useFieldAnchor
// composable (auto-imported).
//
// Anatomy:  summary row  ── anchor · signature
//                           (name/type/format/requiredness/lifecycle) · trailing
//                           fallback fact (default); container-width responsive,
//                           optional remains unmarked
//           leaf detail  ── deprecation note → condition rule → description →
//                           caveat callout(s) → aligned fact band (enum →
//                           constraints → example → new/beta lifecycle metadata)
//           children     ── UCollapsible of nested <ApiDocsFieldItem>
//           composition  ── field-level oneOf/anyOf/allOf delegated to
//                           <ApiDocsSchemaComposition> after the children
// States:   active-anchor highlight, descendant-active auto-expand, deprecated
//           (name strike-through), expanded/collapsed. A11y: anchor buttons
//           carry dynamic aria-labels; copied state announced politely.

// Recursive self-reference name (kit uses pathPrefix, so the global name is
// ApiDocsFieldItem); declared explicitly so the template's recursion resolves.
defineOptions({ name: 'ApiDocsFieldItem' })

// Field-level composition is delegated to ApiDocsSchemaComposition — a
// HIGHER-level slice that itself depends on FieldItem. A static
// <ApiDocsSchemaComposition> tag here would either force a dependency cycle
// (if declared) or leave FieldItem un-installable on its own (if not). The
// optional lookup below preserves that one-way dependency.
const props = withDefaults(
  defineProps<FieldItemProps>(),
  {
    required: false,
    labels: () => ({}),
  },
)

// Resolve the higher-level slice only when this field actually needs it. Plain
// standalone FieldItem installs never attempt the optional lookup, while a
// composition-bearing field still gets Nuxt's normal component auto-import.
const schemaComposition = computed(() => {
  if (!props.composition) return null
  const resolved = resolveComponent('ApiDocsSchemaComposition')
  return typeof resolved === 'string' ? null : resolved
})

// Merge caller copy over neutral English defaults. Chrome text only.
// Passthrough labels (lifecycle / enum* / composition) are excluded: they have
// no defaults here and are read straight from `props.labels` at the passing site.
type PassthroughLabel =
  | 'lifecycle'
  | 'enumLabel' | 'enumFilter' | 'enumEmpty' | 'enumVariant'
  | 'enumResults' | 'enumVariantResults' | 'enumNoResults'
  | 'composition'
const t = computed<Required<Omit<FieldItemLabels, PassthroughLabel>>>(() => ({
  required: 'Required',
  conditional: 'Conditional',
  default: 'Default',
  example: 'Example',
  constraints: 'Constraints',
  note: 'Note',
  caveat: 'Caveat',
  since: 'Since',
  showChildren: 'Show Child Parameters',
  hideChildren: 'Hide Child Parameters',
  copyLink: (fieldName: string) => `Copy link to ${fieldName}`,
  copiedLink: (fieldName: string) => `${fieldName} link copied`,
  linkCopied: (fieldName: string) => `${fieldName} link copied to clipboard`,
  linkCopyFailed: () => 'Copy failed. Select the URL and copy it manually',
  ...props.labels,
}))

// Deep-linking. A row highlights when it is the active anchor, and auto-expands
// when the active anchor lives among its descendants so a link into a collapsed
// subfield reveals itself. Descendancy is decided by membership in the paths
// collected from this row's own subtree — NOT by string prefix — so the
// disclosure follows the real `children` graph rather than the id spelling.
const anchor = useFieldAnchor()
const isActive = computed(() => !!props.path && anchor.active.value === props.path)
const childPaths = computed(() => collectFieldPaths(props.children ?? []))
const descendantActive = computed(() => childPaths.value.includes(anchor.active.value))

function resolveAnchorLabel(label: string | ((fieldName: string) => string)) {
  return typeof label === 'function' ? label(props.name) : label
}

const anchorLabel = computed(() =>
  resolveAnchorLabel(anchor.copied.value ? t.value.copiedLink : t.value.copyLink),
)

function onCopyLink() {
  // Build the *complete* toast sentence here via our own labels, so it flows
  // through the same localization surface as every other chrome string (aria,
  // required, etc.) — no half-sentence concatenation inside the composable.
  if (props.path) {
    void anchor.copyLink(props.path, {
      successMessage: t.value.linkCopied(props.name),
      failureMessage: t.value.linkCopyFailed(props.name),
    })
  }
}

// Collapsible open state is a real ref (v-model:open) so the user can toggle
// it. It is also forced open when a descendant is the active anchor so deep
// links resolve. We push the auto-open as an actual mutation (not a computed
// getter): `active` is always empty during SSR, so the immediate watch is a
// no-op on the server and the initial render matches SSR (closed); the open
// mutation then lands client-side, which Reka's controlled Collapsible
// reliably animates — a getter-driven `open` left the SSR-closed state stuck
// after hydration.
const open = shallowRef(false)

// Re-run on every navigation event as well as path changes. This matters when
// a user follows the same descendant link after manually closing this row.
watch([descendantActive, anchor.revision], ([v]) => {
  if (v) open.value = true
}, { immediate: true })

const hasChildren = computed(() => (props.children?.length ?? 0) > 0)
const hasEnum = computed(
  () => (props.enumValues?.length ?? 0) > 0 || (props.enumVariants?.length ?? 0) > 0,
)
// Lifecycle detail renders only when there's something to say beyond the badge.
const hasLifecycleDetail = computed(
  () => !!props.lifecycle && (!!props.lifecycle.since || !!props.lifecycle.description),
)

// Notes are split by category BEFORE rendering. A caveat is a behavioural
// warning that earns its own amber callout next to the description; a
// constraint is neutral, scannable metadata that belongs in the band. Merging
// them under one "Constraints" heading mislabels the caveat as a validation
// boundary, which is the one thing it is not.
const constraints = computed(() => (props.notes ?? []).filter(n => n.kind !== 'caveat'))
const caveats = computed(() => (props.notes ?? []).filter(n => n.kind === 'caveat'))

const hasDetail = computed(
  () =>
    !!props.description
    || !!props.condition
    || (props.examples?.length ?? 0) > 0
    || (props.notes?.length ?? 0) > 0
    || hasEnum.value
    || hasLifecycleDetail.value,
)

// Requirement marker. Derived from `required` AND `condition` together (see
// fieldRequiredState in utils/field): a field that explains when it becomes
// required IS conditional, so the marker cannot go missing just because the
// author set only one of the two. Optional is the default state and renders
// nothing — absence of a Required/Conditional tag IS the "optional" signal
// (industry convention: Stripe, Mintlify). Tagging every optional row would
// add a non-informative word to the majority of rows and dilute the contrast
// of the tags that matter.
const requiredState = computed(() => fieldRequiredState(props))
// Localized label for the rendered requirement states (chrome copy).
const requiredLabel = computed(() => (requiredState.value ? t.value[requiredState.value] : ''))

// Everything below the main description is secondary metadata. Grouping it lets
// the template pull the description up as the primary content and set the band
// apart with a larger rhythm gap.
// The condition and the deprecation note are rendered above the description
// as gates, so neither counts toward the secondary band; only a new/beta
// lifecycle detail (rendered at the band's end) does.
const hasSecondary = computed(
  () =>
    hasEnum.value
    || constraints.value.length > 0
    || (props.examples?.length ?? 0) > 0
    || (hasLifecycleDetail.value && !isDeprecated.value),
)

// A deprecated field gets its name struck through so the "on its way out"
// state reads instantly, even before the badge. The strike inherits the
// dimmed text color (currentColor) — neutral, not red — since deprecation is
// de-emphasis, not an error.
const isDeprecated = computed(() => props.lifecycle?.status === 'deprecated')

// SINCE is deliberately NOT tinted by lifecycle status. It answers "when did
// this happen", not "how risky is this" — the status hue belongs to the badge
// alone. Tinting SINCE too made one meaning speak through two channels and let
// a bare version number read as a state word, which is also why the lifecycle
// row now renders as neutral metadata like DEFAULT and EXAMPLE.
</script>

<template>
  <div
    :id="path"
    class="@container/field relative rounded-md border-b border-default py-3.5 outline-hidden last:border-b-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="anchor.SCROLL_MARGIN_CLASS"
  >
    <!-- The summary follows the developer's scan order: identity answers what
         the field is, whether it may be omitted and how mature it is; the
         trailing fact covers fallback behavior (default). Container queries
         respond to the actual column width, including recursive fields. -->
    <div class="group/field relative flex items-start gap-2">
      <button
        v-if="path"
        type="button"
        :aria-label="anchorLabel"
        class="absolute -start-6 top-0 hidden h-5 items-center rounded-sm p-0.5 text-dimmed opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary group-hover/field:opacity-100 lg:flex"
        :class="{ 'opacity-100': isActive || anchor.copied.value, 'text-primary': anchor.copied.value }"
        @click="onCopyLink"
      >
        <UIcon
          :name="anchor.copied.value ? 'i-lucide-check' : 'i-lucide-link-2'"
          class="size-3.5"
          aria-hidden="true"
        />
      </button>

      <div
        data-field-summary
        class="grid min-w-0 flex-1 gap-2"
        :class="defaultValue !== undefined
          ? '@md/field:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] @md/field:items-start @md/field:gap-x-4'
          : ''"
      >
        <div data-field-identity class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <code
            class="wrap-anywhere min-w-0 font-mono text-sm font-medium"
            :class="isDeprecated ? 'text-dimmed line-through' : 'text-highlighted'"
          >{{ name }}</code>
          <span class="shrink-0 font-mono text-xs text-muted">{{ type }}</span>
          <span v-if="format" class="wrap-anywhere font-mono text-xs text-dimmed">{{ format }}</span>
          <span
            v-if="requiredState || lifecycle"
            data-field-qualifiers
            class="inline-flex shrink-0 items-center gap-2"
          >
            <span
              v-if="requiredState"
              data-field-requiredness
              class="shrink-0 text-xs font-medium uppercase tracking-wide"
              :class="requiredState === 'required' ? 'text-error' : 'text-warning'"
            >{{ requiredLabel }}</span>
            <ApiDocsLifecycleBadge
              v-if="lifecycle"
              data-field-lifecycle
              :status="lifecycle.status"
              :label="labels?.lifecycle?.[lifecycle.status]"
              size="sm"
              class="shrink-0 rounded-sm"
            />
          </span>
        </div>

        <div
          v-if="defaultValue !== undefined"
          data-field-facts
          class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 @md/field:justify-end"
        >
          <span class="inline-flex min-w-0 items-center gap-1.5">
            <span class="shrink-0 text-xs font-medium uppercase tracking-wide text-dimmed">{{ t.default }}</span>
            <InlineCode class="wrap-anywhere min-w-0">{{ defaultValue }}</InlineCode>
          </span>
        </div>
      </div>

      <button
        v-if="path"
        type="button"
        :aria-label="anchorLabel"
        class="-mt-1.5 -me-1 inline-flex shrink-0 items-center rounded-sm p-2 text-dimmed transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
        :class="{ 'text-primary': isActive || anchor.copied.value }"
        @click="onCopyLink"
      >
        <UIcon
          :name="anchor.copied.value ? 'i-lucide-check' : 'i-lucide-link-2'"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- Leaf detail — always visible (no disclosure for non-object fields).
         Primary description sits closest to the summary row; a larger gap sets
         it apart from the secondary metadata band below. -->
    <div v-if="hasDetail" class="mt-2.5 flex flex-col gap-4">
      <!-- Gates come before the description, strongest first:
           1. Deprecation — "should I use this field at all?" outranks
              everything; a deprecated field's migration note must be the
              first thing read.
           2. Condition — "when is this required?" decides whether you need
              it on this call.
           Only then the description ("what is it"). -->

      <!-- 1. Deprecation — migration note for deprecated fields. Plain text
           (not a tinted callout): the strikethrough + badge already carry the
           state, and amber stays reserved for the conditional/caveat family
           (see the fill ladder on the condition rule below). -->
      <dl
        v-if="isDeprecated && lifecycle?.since"
        data-field-lifecycle-detail
        class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed text-muted"
      >
        <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ t.since }}</dt>
        <dd class="wrap-anywhere min-w-0">
          {{ lifecycle.since }}<template v-if="lifecycle.description"> — </template>
          <InlineMarkdown v-if="lifecycle.description" :text="lifecycle.description" />
        </dd>
      </dl>
      <!-- Mirrors the new/beta lifecycle detail at the end of the secondary
           band below — same markup, different position (a deprecation is a
           gate, a new/beta note is metadata). Keep the two in sync; a
           migration note carries the same long unbroken tokens (upgrade URLs,
           replacement identifiers) and needs the same overflow guard. -->
      <p
        v-else-if="isDeprecated && lifecycle?.description"
        data-field-lifecycle-detail
        class="wrap-anywhere min-w-0 text-sm leading-relaxed text-muted"
      >
        <InlineMarkdown :text="lifecycle.description" />
      </p>

      <!-- 2. Condition — the amber family is graded by FILL, not by hue, so a
           field that is conditional + beta + caveated never reads as one amber
           wash: text tag (CONDITIONAL) → bordered rule (this) → filled callout
           (caveat) → badge (Beta). This rule is the LIGHTEST amber object,
           which is correct: it states a fact about requiredness, not a risk.
           Dropping the branch icon and the tint also removes the third
           redundant emphasis (border + fill + icon all said "look here") and
           with it a hardcoded optical-centering height.
           No lead-in tag here: the summary row's CONDITIONAL is *derived* from
           this very prop (fieldRequiredState), so the word is guaranteed to be
           on screen already — repeating it 30px below would be the same word
           twice, and the condition sentence ("Required when …") is itself the
           text channel that keeps amber from carrying the meaning alone. -->
      <div
        v-if="condition"
        data-field-condition
        class="border-s-2 border-warning ps-3 text-sm leading-relaxed text-toned"
      >
        <InlineMarkdown :text="condition" />
      </div>

      <p v-if="description" class="text-sm leading-relaxed text-toned">
        <InlineMarkdown :text="description" />
      </p>

      <!-- 3. Caveats — "the call will succeed, and you may still regret it".
           Ranked ABOVE the band because a caveat is usually a security or
           data-loss consequence, and BELOW the description because you have to
           know what the field is before you can weigh its risk. The filled
           amber surface makes it the heaviest amber object on the row, which
           is the point: this is the one that can cost you something. -->
      <p
        v-for="(note, i) in caveats"
        :key="i"
        data-field-caveat
        class="rounded-md border-s-2 border-warning bg-warning/10 px-3 py-2 text-sm leading-relaxed text-toned"
      >
        <span class="me-2 text-xs font-medium uppercase tracking-wide text-warning">
          {{ note.label ?? t.caveat }}
        </span>
        <InlineMarkdown :text="note.text" />
      </p>

      <!-- Secondary metadata band, ordered by a developer's call-time flow:
           what values → boundaries → sample → maturity. (The gating condition
           is hoisted above the description as its own callout.) Constraint rows
           share one neutral uppercase label language; caveats stay outside this
           band in their dedicated warning callouts. -->
      <div v-if="hasSecondary" class="flex flex-col gap-3">
        <!-- 2. Allowed values — the most actionable metadata. The field's
             default is passed down so its row is marked in the table. -->
        <!-- Structural chrome flows through: `undefined` lets the table's own
             English defaults apply, so those strings live in one place. -->
        <ApiDocsEnumTable
          v-if="hasEnum"
          :values="enumValues"
          :variants="enumVariants"
          :default-value="defaultValue"
          :default-label="t.default"
          :label="labels?.enumLabel"
          :search-placeholder="labels?.enumFilter"
          :empty-label="labels?.enumEmpty"
          :variant-label="labels?.enumVariant"
          :results-announcement="labels?.enumResults"
          :variant-results-announcement="labels?.enumVariantResults"
          :no-results-announcement="labels?.enumNoResults"
        />

        <!-- 3a. Single constraint — an inline lead-in row (same grammar as
             Example / Condition), NOT a boxed table. Unlike an enum (rarely a
             single value), a constraint is often exactly one line; a titled
             bordered table with a "(1)" counter is disproportionate chrome for
             one sentence. Downgrading to inline is MORE consistent with the
             band, whose other single-fact rows are all "LABEL + text". -->
        <dl
          v-if="constraints.length === 1 && constraints[0]"
          data-field-constraints
          class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed"
        >
          <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ constraints[0].label ?? t.note }}</dt>
          <dd class="wrap-anywhere min-w-0 text-toned">
            <InlineMarkdown :text="constraints[0].text" />
          </dd>
        </dl>

        <!-- 3b. Multiple constraints — NOW the table earns its chrome: column
             alignment across rows and hairline dividers let you scan them.
             Two columns: a fit-content category label and the value. -->
        <div v-else-if="constraints.length > 1" data-field-constraints class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-dimmed">
            {{ t.constraints }}
            <span class="text-dimmed/70">({{ constraints.length }})</span>
          </p>
          <!-- One shared grid: the label column is sized once to the widest
               label across all rows (capped at 8rem) via subgrid, so every
               value starts at the same x. -->
          <dl class="grid grid-cols-[fit-content(8rem)_1fr] gap-x-4 divide-y divide-default overflow-hidden rounded-lg border border-default">
            <div
              v-for="(note, i) in constraints"
              :key="i"
              class="col-span-2 grid grid-cols-subgrid items-baseline gap-y-1 bg-muted/40 px-3 py-2.5 text-sm leading-relaxed"
            >
              <dt class="min-w-0 text-xs font-medium uppercase tracking-wide text-dimmed">
                {{ note.label ?? t.note }}
              </dt>
              <dd class="min-w-0 text-toned">
                <InlineMarkdown :text="note.text" />
              </dd>
            </div>
          </dl>
        </div>

        <dl
          v-if="examples?.length"
          class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed"
        >
          <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ t.example }}</dt>
          <dd class="flex min-w-0 flex-wrap gap-2">
            <InlineCode v-for="(ex, i) in examples" :key="i" class="wrap-anywhere min-w-0">{{ ex }}</InlineCode>
          </dd>
        </dl>

        <dl
          v-if="!isDeprecated && lifecycle?.since"
          data-field-lifecycle-detail
          class="grid min-w-0 grid-cols-[fit-content(8rem)_minmax(0,1fr)] items-baseline gap-x-3 text-sm leading-relaxed text-muted"
        >
          <dt class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ t.since }}</dt>
          <dd class="wrap-anywhere min-w-0">
            {{ lifecycle.since }}<template v-if="lifecycle.description"> — </template>
            <InlineMarkdown v-if="lifecycle.description" :text="lifecycle.description" />
          </dd>
        </dl>
        <p
          v-else-if="!isDeprecated && lifecycle?.description"
          data-field-lifecycle-detail
          class="wrap-anywhere min-w-0 text-sm leading-relaxed text-muted"
        >
          <InlineMarkdown :text="lifecycle.description" />
        </p>
      </div>
    </div>

    <!-- Child parameters — ONLY object/array fields expand, and only to reveal their subfields. -->
    <UCollapsible
      v-if="hasChildren"
      v-model:open="open"
      :unmount-on-hide="false"
      class="mt-3"
    >
      <template #default="{ open }">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary transition-colors hover:text-primary/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 transition-transform duration-200"
            :class="{ 'rotate-90': open }"
            aria-hidden="true"
          />
          <span>{{ open ? t.hideChildren : t.showChildren }}</span>
          <!-- Count matches the `(N)` grammar used by the enum/constraints
               table headers — tells the reader how much is behind the fold
               before they commit to expanding. Muted so the verb stays the
               button's voice; count is metadata, not part of the action. -->
          <span class="font-normal text-dimmed">({{ children?.length }})</span>
        </button>
      </template>

      <template #content>
        <div class="mt-1 border-s border-default ps-3 @sm/field:ps-4">
          <ApiDocsFieldItem
            v-for="child in children"
            :key="child.path ?? child.name"
            v-bind="child"
            :labels="labels"
          />
        </div>
      </template>
    </UCollapsible>

    <!-- Field-level composition — this field's value is itself a
         oneOf/anyOf/allOf. Delegated to ApiDocsSchemaComposition (not flattened
         into rows) so the alternative shape keeps its own semantics, rendered
         after any concrete subfields. Rendered via a dynamically resolved
         component (see script) so FieldItem installs standalone without a
         dependency cycle; the block only appears when that slice is present.
         FieldItem passes both its own chrome and `labels.composition` through. -->
    <div v-if="composition && schemaComposition" class="mt-3 border-s border-default ps-4">
      <component
        :is="schemaComposition"
        v-bind="composition"
        :labels="labels.composition"
        :field-labels="labels"
      />
    </div>
  </div>
</template>
