<script setup lang="ts">
// Domain component (API docs): renders one field row of an endpoint's schema —
// name/type/requiredness summary, a secondary metadata band (condition, enum,
// constraints, example, lifecycle), and recursive object/array subfields.
//
// Self-contained per the kit slice convention: the field data model travels
// inline with the component (exported below), mirroring how EnumTable/CodeBlock
// carry their own display types. `EnumValue`/`EnumVariant` are intentionally
// the same shape as EnumTable's — structural typing lets this row hand them
// straight to <ApiDocsEnumTable> without a shared module (copy-in philosophy).
//
// Composed from Nuxt UI primitives (UIcon, UCollapsible) + core atoms
// (InlineCode, InlineMarkdown, auto-imported from @geist-nuxt/core) + kit
// siblings (ApiDocsEnumTable, ApiDocsLifecycleBadge). Deep linking is handled
// by the kit's useFieldAnchor composable (auto-imported).
//
// Anatomy:  summary row  ── anchor · name · type · format · requiredness ·
//                           default · lifecycle badge
//           leaf detail  ── description + secondary band (condition → enum →
//                           constraints → example → lifecycle callout)
//           children     ── UCollapsible of nested <ApiDocsFieldItem>
// States:   active-anchor highlight, descendant-active auto-expand, deprecated
//           (name strike-through), expanded/collapsed. A11y: anchor buttons
//           carry dynamic aria-labels; copied state announced politely.

/** `true` / `false`(absent) / `'conditional'` (required only in certain cases). */
export type RequiredState = boolean | 'conditional'

/** Field lifecycle stage (a parameter-level maturity signal). */
export type FieldLifecycle = 'new' | 'beta' | 'deprecated'

/**
 * Field lifecycle metadata. `status` drives the badge; `since` and
 * `description` (already localized) surface in a callout under the field.
 */
export interface FieldLifecycleInfo {
  status: FieldLifecycle
  /** Version/date the status took effect, e.g. `v2.3` or `2026-03`. */
  since?: string
  /** What the status means for this field (migration hint, etc.). */
  description?: string
}

/** A short note shown under a field (constraints, consistency rules, caveats…). */
export interface FieldNote {
  tone?: 'caution' | 'info'
  /** Category tag (Range / Rule / Unsupported…) rendered as a leading pill. */
  label?: string
  text: string
}

/** A single enum member. Same shape EnumTable consumes. */
export interface EnumValue {
  value: string
  description: string
}

/** A named group of enum members — e.g. bank lists that apply under a condition. */
export interface EnumVariant {
  title?: string
  /** When this group of values applies (already localized). */
  when?: string
  values: EnumValue[]
}

/**
 * A field node. `children` (object/array subfields) is what makes it
 * expandable. This is the data contract of the component: everything the row
 * can render, and the recursive shape passed to child rows.
 */
export interface FieldNode {
  /**
   * Stable, unique, hierarchical id used as the DOM id and URL hash for deep
   * linking, e.g. `request-body_txnOrderMsg_periodValue`. Underscore-separated
   * so a row can tell whether the active anchor lives among its descendants
   * (prefix match) and auto-expand.
   */
  path?: string
  name: string
  type: string
  /** Serialization hint from the spec, e.g. `json_string`. */
  format?: string
  /** `true`, `false`/absent, or `'conditional'` (required only in certain cases). */
  required?: RequiredState
  /** Explains when a conditional field becomes required (already localized). */
  condition?: string
  defaultValue?: string
  /** Field lifecycle (new/beta/deprecated) with optional since + description. */
  lifecycle?: FieldLifecycleInfo
  description?: string
  /** One or more example values. */
  examples?: string[]
  notes?: FieldNote[]
  /** Flat enum (single list of allowed values). */
  enumValues?: EnumValue[]
  /** Grouped enum (values that vary by condition). */
  enumVariants?: EnumVariant[]
  /** Object/array subfields. Presence of children is the only thing that makes a row expandable. */
  children?: FieldNode[]
}

/**
 * Component-owned ("chrome") copy, so a doc site can localize every field row
 * in one place — e.g. pass `$t()` values from @nuxtjs/i18n. Content strings
 * (names, descriptions, notes) come from the data and are rendered verbatim.
 */
export interface FieldItemLabels {
  required?: string
  optional?: string
  conditional?: string
  default?: string
  example?: string
  constraints?: string
  /** Fallback category tag for a note without its own `label`. */
  note?: string
  /** Lead-in before a lifecycle `since` version, e.g. "Since v2.3". */
  since?: string
  showChildren?: string
  hideChildren?: string
  copyLink?: string
  copiedLink?: string
}

// Recursive self-reference name (kit uses pathPrefix, so the global name is
// ApiDocsFieldItem); declared explicitly so the template's recursion resolves.
defineOptions({ name: 'ApiDocsFieldItem' })

const props = withDefaults(
  defineProps<FieldNode & {
    /** Overridable UI copy for localization. See FieldItemLabels. */
    labels?: FieldItemLabels
  }>(),
  {
    required: false,
    labels: () => ({}),
  },
)

// Merge caller copy over neutral English defaults. Chrome text only.
const t = computed<Required<FieldItemLabels>>(() => ({
  required: 'Required',
  optional: 'Optional',
  conditional: 'Conditional',
  default: 'Default',
  example: 'Example',
  constraints: 'Constraints',
  note: 'Note',
  since: 'Since',
  showChildren: 'Show Child Parameters',
  hideChildren: 'Hide Child Parameters',
  copyLink: 'Copy link to this field',
  copiedLink: 'Link copied',
  ...props.labels,
}))

// Deep-linking. A row highlights when it is the active anchor, and auto-expands
// when the active anchor lives among its descendants (prefix match) so a link
// into a collapsed subfield reveals itself.
const anchor = useFieldAnchor()
const isActive = computed(() => !!props.path && anchor.active.value === props.path)
const descendantActive = computed(
  () => !!props.path && anchor.active.value.startsWith(`${props.path}_`),
)

function onCopyLink() {
  if (props.path) anchor.copyLink(props.path)
}

// Collapsible open state is controlled by a real ref. The user can toggle it,
// and it is also forced open when a descendant is the active anchor so deep
// links resolve. We push the auto-open as an actual mutation (not a computed
// getter): the initial render matches SSR (closed), and the open happens after
// hydration, which Reka's controlled Collapsible reliably animates — a
// getter-driven `open` left the SSR-closed state stuck after hydration.
const manualOpen = ref(false)
const open = computed({
  get: () => manualOpen.value,
  set: (v: boolean) => {
    manualOpen.value = v
  },
})

// Open on (or after) mount when this row is an ancestor of the active anchor.
onMounted(() => {
  if (descendantActive.value) manualOpen.value = true
})
watch(descendantActive, (v) => {
  if (v) manualOpen.value = true
})

const hasChildren = computed(() => (props.children?.length ?? 0) > 0)
const hasEnum = computed(
  () => (props.enumValues?.length ?? 0) > 0 || (props.enumVariants?.length ?? 0) > 0,
)
// A lifecycle callout renders only when there's something to say beyond the badge.
const hasLifecycleCallout = computed(
  () => !!props.lifecycle && (!!props.lifecycle.since || !!props.lifecycle.description),
)

const hasDetail = computed(
  () =>
    !!props.description
    || !!props.condition
    || (props.examples?.length ?? 0) > 0
    || (props.notes?.length ?? 0) > 0
    || hasEnum.value
    || hasLifecycleCallout.value,
)

// Which of the three requirement states this row is in.
const requiredState = computed<'required' | 'conditional' | 'optional'>(() =>
  props.required === true ? 'required' : props.required === 'conditional' ? 'conditional' : 'optional',
)

// Everything below the main description is secondary metadata. Grouping it lets
// the template pull the description up as the primary content and set the band
// apart with a larger rhythm gap.
const hasSecondary = computed(
  () =>
    !!props.condition
    || hasEnum.value
    || (props.notes?.length ?? 0) > 0
    || (props.examples?.length ?? 0) > 0
    || hasLifecycleCallout.value,
)

// A deprecated field gets its name struck through so the "on its way out"
// state reads instantly, even before the badge. The strike is neutral-toned
// (not red) since deprecation is de-emphasis, not an error.
const isDeprecated = computed(() => props.lifecycle?.status === 'deprecated')

// Field-lifecycle label + tone, rendered as a plain-text metadata row (no
// filled box) so it shares one visual language with the constraint rows. Label
// and tone come from the shared lifecyclePreset (single source of truth with
// the badge); here we only translate the semantic tone into a text color.
const TONE_TEXT: Record<BadgeTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  neutral: 'text-dimmed',
  error: 'text-error',
  info: 'text-info',
  secondary: 'text-secondary',
}
const lifecycleMeta = computed(() => {
  if (!props.lifecycle) return undefined
  const preset = lifecyclePreset[props.lifecycle.status]
  return { label: preset.label, cls: TONE_TEXT[preset.tone] }
})
</script>

<template>
  <div
    :id="path"
    class="relative border-b border-default py-3.5 last:border-b-0"
    :class="anchor.SCROLL_MARGIN_CLASS"
  >
    <!-- Summary row — always visible. Owns the hover group so the anchor icon
         reveals only for THIS row; child rows are siblings (in the collapsible
         below), not descendants, so hovering a child no longer lights up every
         ancestor's icon. -->
    <div class="group/field relative flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <!-- Anchor affordance (desktop) — hangs in the left gutter, revealed on
           hover or when this row is the active anchor. Vertically centered on
           the summary row so it lines up with the field name at any row height. -->
      <button
        v-if="path"
        type="button"
        :aria-label="anchor.copied.value ? t.copiedLink : t.copyLink"
        class="absolute -start-6 top-1/2 hidden translate-y-[calc(-50%+1px)] rounded-sm p-0.5 text-dimmed opacity-0 outline-primary transition-opacity hover:text-primary focus-visible:opacity-100 focus-visible:outline-2 group-hover/field:opacity-100 lg:block"
        :class="{ 'opacity-100': isActive || anchor.copied.value, 'text-primary': anchor.copied.value }"
        @click="onCopyLink"
      >
        <UIcon
          :name="anchor.copied.value ? 'i-lucide-check' : 'i-lucide-link-2'"
          class="size-3.5"
          aria-hidden="true"
        />
      </button>
      <span v-if="path" role="status" aria-live="polite" class="sr-only">
        {{ anchor.copied.value ? t.copiedLink : '' }}
      </span>

      <code
        class="font-mono text-sm font-medium"
        :class="isDeprecated ? 'text-dimmed line-through decoration-muted' : 'text-highlighted'"
      >{{ name }}</code>
      <!-- Data type (string, integer, object, enum…): plain mono text, no
           surface/border, so it never competes with the method/status badges. -->
      <span class="font-mono text-xs text-muted">{{ type }}</span>

      <!-- Serialization hint (e.g. json_string) sits next to the type. -->
      <span
        v-if="format"
        class="font-mono text-[0.6875rem] text-dimmed"
      >{{ format }}</span>

      <span
        class="text-xs font-medium uppercase tracking-wide"
        :class="{
          'text-error': requiredState === 'required',
          'text-warning': requiredState === 'conditional',
          'text-dimmed': requiredState === 'optional',
        }"
      >
        {{ requiredState === 'required' ? t.required : requiredState === 'conditional' ? t.conditional : t.optional }}
      </span>

      <span v-if="defaultValue !== undefined" class="inline-flex items-center gap-1.5">
        <span class="text-xs font-medium uppercase tracking-wide text-dimmed">
          {{ t.default }}
        </span>
        <InlineCode>{{ defaultValue }}</InlineCode>
      </span>

      <ApiDocsLifecycleBadge v-if="lifecycle" :status="lifecycle.status" />

      <!-- Anchor affordance (touch) — inline and always visible on small
           screens, where there's no hover or left gutter. Pushed to the row
           end and sized as a comfortable tap target. -->
      <button
        v-if="path"
        type="button"
        :aria-label="t.copyLink"
        class="ms-auto inline-flex shrink-0 items-center rounded-sm p-1 text-dimmed transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary lg:hidden"
        :class="{ 'text-primary': isActive }"
        @click="onCopyLink"
      >
        <UIcon name="i-lucide-link-2" class="size-4" aria-hidden="true" />
      </button>
    </div>

    <!-- Leaf detail — always visible (no disclosure for non-object fields).
         Primary description sits closest to the summary row; a larger gap sets
         it apart from the secondary metadata band below. -->
    <div v-if="hasDetail" class="mt-2.5 flex flex-col gap-4">
      <p v-if="description" class="text-sm leading-relaxed text-toned">
        <InlineMarkdown :text="description" />
      </p>

      <!-- Secondary metadata band, ordered by a developer's call-time flow:
           when to send it → what values → boundaries → sample → maturity.
           All rows share one label language: a plain uppercase tag whose color
           carries tone (neutral = dimmed, caution/warning = amber). No filled
           boxes, so the band reads as compact structured metadata. -->
      <div v-if="hasSecondary" class="flex flex-col gap-3">
        <!-- 1. Condition — when a conditional field becomes required. The
             condition text reads as the explanation, so no redundant prefix. -->
        <p v-if="condition" class="flex items-start gap-1.5 text-sm leading-relaxed text-muted">
          <!-- Center the icon on the first line rather than pinning it to the
               top: the condition text usually includes a taller inline code
               pill (a field value), which grows the first line's box. A flex
               box sized to that line box keeps the icon optically centered on
               the pill, and — thanks to items-start on the paragraph — still
               aligns to the first line when the condition wraps. -->
          <span class="flex h-[1.6875rem] shrink-0 items-center" aria-hidden="true">
            <UIcon name="i-lucide-git-branch" class="size-3.5 text-warning" />
          </span>
          <InlineMarkdown :text="condition" />
        </p>

        <!-- 2. Allowed values — the most actionable metadata. -->
        <ApiDocsEnumTable
          v-if="hasEnum"
          :values="enumValues"
          :variants="enumVariants"
        />

        <!-- 3. Constraints — boundaries and caveats grouped into one titled
             table, echoing the enum table's container so the field has a single
             consistent tabular language. Two columns: a fit-content label
             column (tone carried by label color, unsupported = amber) and the
             value. Rows share hairline dividers instead of per-item boxes. -->
        <div v-if="notes?.length" class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-dimmed">
            {{ t.constraints }}
            <span class="text-dimmed/70">({{ notes.length }})</span>
          </p>
          <!-- One shared grid: the label column is sized once to the widest
               label across all rows (capped at 8rem) via subgrid, so every
               value starts at the same x. -->
          <dl class="grid grid-cols-[fit-content(8rem)_1fr] gap-x-4 divide-y divide-default overflow-hidden rounded-lg border border-default">
            <div
              v-for="(note, i) in notes"
              :key="i"
              class="col-span-2 grid grid-cols-subgrid items-baseline gap-y-1 bg-muted/40 px-3 py-2.5 text-sm leading-relaxed"
            >
              <dt
                class="min-w-0 text-xs font-medium uppercase tracking-wide"
                :class="(note.tone ?? 'info') === 'caution' ? 'text-warning' : 'text-dimmed'"
              >
                {{ note.label ?? t.note }}
              </dt>
              <dd class="min-w-0 text-toned">
                <InlineMarkdown :text="note.text" />
              </dd>
            </div>
          </dl>
        </div>

        <!-- 4. Example — its own line, inline lead-in label + code. -->
        <p v-if="examples?.length" class="text-sm leading-relaxed">
          <span class="mr-2 text-xs font-medium uppercase tracking-wide text-dimmed">{{ t.example }}</span>
          <InlineCode v-for="(ex, i) in examples" :key="i" :class="i > 0 ? 'ml-2' : ''">{{ ex }}</InlineCode>
        </p>

        <!-- 5. Lifecycle — maturity context, last. Inline lead-in label matching
             the constraint language; the summary badge carries glance. -->
        <p
          v-if="hasLifecycleCallout && lifecycle && lifecycleMeta"
          class="text-sm leading-relaxed text-muted"
        >
          <span class="mr-2 text-xs font-medium uppercase tracking-wide" :class="lifecycleMeta.cls">{{ lifecycleMeta.label }}</span>
          <template v-if="lifecycle.since">{{ t.since }} {{ lifecycle.since }}<template v-if="lifecycle.description">. </template></template>
          <InlineMarkdown v-if="lifecycle.description" :text="lifecycle.description" />
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
        </button>
      </template>

      <template #content>
        <div class="mt-1 border-s border-default ps-4">
          <ApiDocsFieldItem
            v-for="child in children"
            :key="child.name"
            v-bind="child"
            :labels="labels"
          />
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
