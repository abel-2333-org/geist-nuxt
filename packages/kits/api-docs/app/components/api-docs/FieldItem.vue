<script setup lang="ts">
// Domain component (API docs): renders one field row of an endpoint's schema —
// name/type/requiredness summary, a secondary metadata band (condition, enum,
// constraints, example, lifecycle), and recursive object/array subfields.
//
// Self-contained per the kit slice convention: the field data model (FieldNode
// and friends) travels inline with the component, mirroring how EnumTable/
// CodeBlock carry their own display types. The types it shares with the sibling
// slices it already depends on — EnumValue/EnumVariant (enum-table) and
// FieldLifecycle (lifecycle-badge) — are imported from those slices rather than
// re-declared, so the shared contract is compiler-enforced (see imports below).
//
// Composed from Nuxt UI primitives (UIcon, UCollapsible) + core atoms
// (InlineCode, InlineMarkdown, auto-imported from @geist-nuxt/core) + kit
// siblings (ApiDocsEnumTable, ApiDocsLifecycleBadge). Deep linking is handled
// by the kit's useFieldAnchor composable (auto-imported).
//
// Anatomy:  summary row  ── anchor · name · type · format · requiredness
//                           (required/conditional only; optional is unmarked) ·
//                           default · lifecycle badge
//           leaf detail  ── condition callout (if any) → description +
//                           secondary band (deprecation-first → enum →
//                           constraints → example → new/beta lifecycle callout)
//           children     ── UCollapsible of nested <ApiDocsFieldItem>
// States:   active-anchor highlight, descendant-active auto-expand, deprecated
//           (name strike-through), expanded/collapsed. A11y: anchor buttons
//           carry dynamic aria-labels; copied state announced politely.

// Types shared with sibling slices are imported from their canonical owner (not
// re-declared) so drift is a compile error, not a silent structural mismatch.
// Both slices are declared in this component's registryDependencies, so they're
// always copied alongside field-item and these relative paths resolve in the
// consuming project. Re-exported to keep one import surface for FieldNode users.
import type { EnumValue, EnumVariant } from './EnumTable.vue'
import type { FieldLifecycle } from '../../utils/lifecycle-preset'
export type { EnumValue, EnumVariant, FieldLifecycle }

/** `true` / `false`(absent) / `'conditional'` (required only in certain cases). */
export type RequiredState = boolean | 'conditional'

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
  /** Full toast sentence after copying a field's link. Receives the field name
   *  so the whole string is owned here (not concatenated in the composable),
   *  e.g. `(name) => `${name} 的链接已复制``. */
  linkCopied?: (fieldName: string) => string
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
  linkCopied: (fieldName: string) => `${fieldName} link copied to clipboard`,
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
  // Build the *complete* toast sentence here via our own labels, so it flows
  // through the same localization surface as every other chrome string (aria,
  // required, etc.) — no half-sentence concatenation inside the composable.
  if (props.path) anchor.copyLink(props.path, t.value.linkCopied(props.name))
}

// Collapsible open state is a real ref (v-model:open) so the user can toggle
// it. It is also forced open when a descendant is the active anchor so deep
// links resolve. We push the auto-open as an actual mutation (not a computed
// getter): the initial render matches SSR (closed), and the open happens after
// hydration, which Reka's controlled Collapsible reliably animates — a
// getter-driven `open` left the SSR-closed state stuck after hydration.
const open = ref(false)

// Open on (or after) mount when this row is an ancestor of the active anchor.
onMounted(() => {
  if (descendantActive.value) open.value = true
})
watch(descendantActive, (v) => {
  if (v) open.value = true
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

// Requirement marker. Optional is the default state of a field, so it renders
// nothing — absence of a Required/Conditional tag IS the "optional" signal
// (industry convention: Stripe, Mintlify). Tagging every optional row would
// add a non-informative word to the majority of rows and dilute the contrast
// of the tags that matter.
const requiredState = computed<'required' | 'conditional' | null>(() =>
  props.required === true ? 'required' : props.required === 'conditional' ? 'conditional' : null,
)
// Localized label for the rendered requirement states (chrome copy).
const requiredLabel = computed(() => (requiredState.value ? t.value[requiredState.value] : ''))

// Everything below the main description is secondary metadata. Grouping it lets
// the template pull the description up as the primary content and set the band
// apart with a larger rhythm gap.
// The condition and the deprecation note are rendered above the description
// as gates, so neither counts toward the secondary band; only a new/beta
// lifecycle callout (rendered at the band's end) does.
const hasSecondary = computed(
  () =>
    hasEnum.value
    || (props.notes?.length ?? 0) > 0
    || (props.examples?.length ?? 0) > 0
    || (hasLifecycleCallout.value && !isDeprecated.value),
)

// A deprecated field gets its name struck through so the "on its way out"
// state reads instantly, even before the badge. The strike inherits the
// dimmed text color (currentColor) — neutral, not red — since deprecation is
// de-emphasis, not an error.
const isDeprecated = computed(() => props.lifecycle?.status === 'deprecated')

// Field-lifecycle tone, rendered as a plain-text metadata row (no filled box)
// so it shares one visual language with the constraint rows. The tone comes
// from the shared lifecyclePreset (single source of truth with the badge);
// here we only translate the semantic tone into a text color. The preset's
// status label is NOT used in the callout — its lead-in is SINCE, and the
// status word lives exclusively on the badge.
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
  return { cls: TONE_TEXT[preset.tone] }
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
        class="absolute -start-6 top-1/2 hidden translate-y-[calc(-50%+1px)] rounded-sm p-0.5 text-dimmed opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary group-hover/field:opacity-100 lg:block"
        :class="{ 'opacity-100': isActive || anchor.copied.value, 'text-primary': anchor.copied.value }"
        @click="onCopyLink"
      >
        <UIcon
          :name="anchor.copied.value ? 'i-lucide-check' : 'i-lucide-link-2'"
          class="size-3.5"
          aria-hidden="true"
        />
      </button>
      <!-- No per-row live region: useCopy() already fires an app-level toast
           ("Link copied to clipboard") announced through Nuxt UI's single
           polite live region, and each button reflects the copied state via its
           own aria-label. A per-row status node would be a third, redundant
           announcement (and dozens of empty regions on a large table). -->

      <code
        class="font-mono text-sm font-medium"
        :class="isDeprecated ? 'text-dimmed line-through' : 'text-highlighted'"
      >{{ name }}</code>
      <!-- Data type (string, integer, object, enum…): plain mono text, no
           surface/border, so it never competes with the method/status badges. -->
      <span class="font-mono text-xs text-muted">{{ type }}</span>

      <!-- Serialization hint (e.g. json_string) sits next to the type. -->
      <span
        v-if="format"
        class="font-mono text-xs text-dimmed"
      >{{ format }}</span>

      <!-- Requirement tag — only for required/conditional; optional rows carry
           no tag (absence is the signal, see requiredState above).
           This is the requirement-strength axis: red = required (a hard rule),
           amber = conditional (required only in some cases). Conditional keeps
           amber — NOT neutral — so it stays visibly ON the same axis as red
           rather than blending into the neutral type/format metadata beside it.
           The amber here points AT the amber condition callout below (label →
           block), a same-meaning echo, not the ambiguous cross-axis wash we
           removed. Beta stays a badge (a different shape), so it never blurs
           with this text tag even on a conditional + beta field. -->
      <span
        v-if="requiredState"
        class="text-xs font-medium uppercase tracking-wide"
        :class="requiredState === 'required' ? 'text-error' : 'text-warning'"
      >
        {{ requiredLabel }}
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
           end; padding grows the tap target to 32px while negative margins
           keep the visual footprint inside the row's rhythm. -->
      <button
        v-if="path"
        type="button"
        :aria-label="anchor.copied.value ? t.copiedLink : t.copyLink"
        class="ms-auto -my-1 -me-1 inline-flex shrink-0 items-center rounded-sm p-2 text-dimmed transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
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
           state; the amber callout shape stays reserved for the condition. -->
      <p
        v-if="isDeprecated && hasLifecycleCallout && lifecycle && lifecycleMeta"
        class="text-sm leading-relaxed text-muted"
      >
        <!-- Lead-in is SINCE (the version marker), NOT the status word: the
             summary badge already carries "Deprecated"; SINCE explains what
             the number means. Label omitted when there's no version. -->
        <span
          v-if="lifecycle.since"
          class="mr-2 text-xs font-medium uppercase tracking-wide"
          :class="lifecycleMeta.cls"
        >{{ t.since }}</span>
        <template v-if="lifecycle.since">{{ lifecycle.since }}<template v-if="lifecycle.description"> — </template></template>
        <InlineMarkdown v-if="lifecycle.description" :text="lifecycle.description" />
      </p>

      <!-- 2. Condition — contained in a tinted callout so amber reads as one
           bounded object (the rule), not a scattered wash — this keeps
           amber's single meaning ("has strings attached": beta, caution,
           condition) intact even when a field is conditional + beta.
           The summary-row CONDITIONAL tag is amber too — a same-meaning echo
           pointing at this block (label → block). Disambiguation from beta is
           carried by SHAPE (text tag / callout block / badge), not by hue. -->
      <div
        v-if="condition"
        class="flex items-start gap-2 rounded-md border-l-2 border-warning bg-warning/10 px-3 py-2 text-sm leading-relaxed text-toned"
      >
        <!-- Icon optically centered on the first line (which often holds a
             taller inline code pill); items-start keeps it top-aligned when the
             condition wraps. Amber matches the callout it lives in. -->
        <span class="flex h-[1.6875rem] shrink-0 items-center" aria-hidden="true">
          <UIcon name="i-lucide-git-branch" class="size-3.5 text-warning" />
        </span>
        <InlineMarkdown :text="condition" />
      </div>

      <p v-if="description" class="text-sm leading-relaxed text-toned">
        <InlineMarkdown :text="description" />
      </p>

      <!-- Secondary metadata band, ordered by a developer's call-time flow:
           what values → boundaries → sample → maturity. (The gating condition
           is hoisted above the description as its own callout.) All rows share
           one label language: a plain uppercase tag whose color carries tone
           (neutral = dimmed, caution/warning = amber). No filled boxes, so the
           band reads as compact structured metadata. -->
      <div v-if="hasSecondary" class="flex flex-col gap-3">
        <!-- 2. Allowed values — the most actionable metadata. The field's
             default is passed down so its row is marked in the table. -->
        <ApiDocsEnumTable
          v-if="hasEnum"
          :values="enumValues"
          :variants="enumVariants"
          :default-value="defaultValue"
          :default-label="t.default"
        />

        <!-- 3a. Single constraint — an inline lead-in row (same grammar as
             Example / Condition), NOT a boxed table. Unlike an enum (rarely a
             single value), a constraint is often exactly one line; a titled
             bordered table with a "(1)" counter is disproportionate chrome for
             one sentence. Downgrading to inline is MORE consistent with the
             band, whose other single-fact rows are all "LABEL + text". -->
        <p
          v-if="notes?.length === 1 && notes[0]"
          class="text-sm leading-relaxed"
        >
          <span
            class="mr-2 text-xs font-medium uppercase tracking-wide"
            :class="notes[0].tone === 'caution' ? 'text-warning' : 'text-dimmed'"
          >{{ notes[0].label ?? t.note }}</span>
          <InlineMarkdown :text="notes[0].text" />
        </p>

        <!-- 3b. Multiple constraints — NOW the table earns its chrome: column
             alignment across rows and hairline dividers let you scan them.
             Two columns: a fit-content label column (tone carried by label
             color, unsupported = amber) and the value. -->
        <div v-else-if="notes && notes.length > 1" class="space-y-2">
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
                :class="note.tone === 'caution' ? 'text-warning' : 'text-dimmed'"
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

        <!-- 5. Lifecycle (new/beta) — maturity context, last. Inline lead-in
             label matching the constraint language; the summary badge carries
             glance. Deprecated renders at position 0 instead (see above). -->
        <p
          v-if="!isDeprecated && hasLifecycleCallout && lifecycle && lifecycleMeta"
          class="text-sm leading-relaxed text-muted"
        >
          <!-- Lead-in is SINCE (the version marker), NOT the status word: the
               summary badge already carries "New/Beta/Deprecated", so repeating
               it here is noise. SINCE actually explains what the number means,
               and keeping the badge's tone color on it ties the callout back to
               the badge without duplicating the word. Label omitted when there's
               no version (a description-only note stands on its own). -->
          <span
            v-if="lifecycle.since"
            class="mr-2 text-xs font-medium uppercase tracking-wide"
            :class="lifecycleMeta.cls"
          >{{ t.since }}</span>
          <template v-if="lifecycle.since">{{ lifecycle.since }}<template v-if="lifecycle.description"> — </template></template>
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
          <!-- Count matches the `(N)` grammar used by the enum/constraints
               table headers — tells the reader how much is behind the fold
               before they commit to expanding. Muted so the verb stays the
               button's voice; count is metadata, not part of the action. -->
          <span class="font-normal text-dimmed">({{ children?.length }})</span>
        </button>
      </template>

      <template #content>
        <div class="mt-1 border-s border-default ps-4">
          <ApiDocsFieldItem
            v-for="child in children"
            :key="child.path ?? child.name"
            v-bind="child"
            :labels="labels"
          />
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
