// Field & composition display model (API docs kit).
//
// This is the data contract shared by the recursive field renderer
// (ApiDocsFieldItem) and the schema-composition renderer
// (ApiDocsSchemaComposition). It lives in a util — not inside a component — so
// every slice references one canonical, compiler-enforced definition. Nuxt
// auto-imports this kit's `utils/` dir, so components reference these types
// bare (no import), exactly like the lifecycle/method preset types.
//
// Cross-slice types come from sibling utils by relative path. Both this file
// and its dependencies live under `utils/`, so the relative specifier is
// identical in the source repo and after copy-in (everything flattens to
// `app/utils/`): FieldLifecycle from the lifecycle-badge slice's
// `lifecycle-preset`, EnumValue/EnumVariant from the enum-table slice's `enum`.
// Both owner slices are declared in api-docs-field-item's registryDependencies.
import type { EnumValue, EnumVariant } from './enum'
import type { FieldLifecycle } from './lifecycle-preset'

/** `true` / `false`(absent) / `'conditional'` (required only in certain cases). */
export type RequiredState = boolean | 'conditional'

/**
 * Field lifecycle metadata. `status` drives the badge; `since` and
 * `description` (already localized) surface as detail under the field.
 */
export interface FieldLifecycleInfo {
  status: FieldLifecycle
  /** Version/date the status took effect, e.g. `v2.3` or `2026-03`. */
  since?: string
  /** What the status means for this field (migration hint, etc.). */
  description?: string
}

/**
 * Note category. It drives BOTH grouping and color, so a doc author cannot file
 * a caveat under the "Constraints" heading by accident:
 *   constraint — an enforced input boundary (length, charset, format). Breaking
 *                it fails validation, so there is no hidden trap: neutral, and
 *                it belongs in the scannable constraints row/table.
 *   caveat     — the value IS accepted, but there is behaviour you would regret
 *                not knowing ("stored in plain text", "ignored on preview
 *                deployments"). Amber, and read right after the description.
 */
export type FieldNoteKind = 'constraint' | 'caveat'

/** A short note shown under a field (constraints, consistency rules, caveats…). */
export interface FieldNote {
  /** Defaults to `constraint`. */
  kind?: FieldNoteKind
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
   * Stable, unique, opaque id used verbatim as the DOM id and encoded once when
   * transported in a URL hash for deep linking. The renderer never appends a
   * suffix, slugifies it, or infers ancestry from separators. Hidden variants
   * and ancestor rows are revealed by exact membership in recursively collected
   * field/composition path sets.
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
  /**
   * Field-level composition: this field's value is itself a oneOf/anyOf/allOf
   * (e.g. a polymorphic payload). Rendered by ApiDocsFieldItem via
   * ApiDocsSchemaComposition after the children collapsible, so a field can
   * carry both concrete subfields and an alternative-shaped value.
   */
  composition?: CompositionNode
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
  /** Fallback category tag for a constraint note without its own `label`. */
  note?: string
  /** Fallback category tag for a caveat note without its own `label`. */
  caveat?: string
  /** Lead-in before a lifecycle `since` version, e.g. "Since v2.3". */
  since?: string
  showChildren?: string
  hideChildren?: string
  /** Accessible name for the field-anchor action. Strings remain complete
   *  labels for backward compatibility; functions receive the field name. */
  copyLink?: string | ((fieldName: string) => string)
  /** Accessible name after the field link is copied. Same resolution rule as
   *  `copyLink`: strings remain complete; functions receive the field name. */
  copiedLink?: string | ((fieldName: string) => string)
  /** Full toast sentence after copying a field's link. Receives the field name
   *  so the whole string is owned here (not concatenated in the composable),
   *  e.g. `(name) => `${name} 的链接已复制``. */
  linkCopied?: (fieldName: string) => string
  /** Complete failure toast sentence; receives the field name for i18n parity. */
  linkCopyFailed?: (fieldName: string) => string

  // Passthrough labels for nested chrome. These have NO defaults here — when
  // omitted they stay `undefined` and the child component's own English
  // default applies, so the default string lives in exactly one place (the
  // child) and cannot drift. They flow to recursive child rows via `labels`.

  /** Per-status override for the lifecycle badge label (e.g. for i18n),
   *  keyed by status so one map covers every row a labels object reaches. */
  lifecycle?: Partial<Record<FieldLifecycle, string>>
  /** EnumTable heading (default `Allowed values`). */
  enumLabel?: string
  /** EnumTable filter placeholder + aria-label (default `Filter values`). */
  enumFilter?: string
  /** EnumTable empty state after filtering (default `No matching values`). */
  enumEmpty?: string
  /** EnumTable fallback tab label for an unnamed variant; receives the
   *  0-based index (default `` i => `Option ${i + 1}` ``). */
  enumVariant?: (index: number) => string
  /** EnumTable live-region text when its filter yields hits; receives the count. */
  enumResults?: (count: number) => string
  /** EnumTable grouped live-region text; receives aggregate hits, active hits,
   *  and the localized active-group label. */
  enumVariantResults?: (totalCount: number, activeCount: number, activeLabel: string) => string
  /** EnumTable live-region text when its filter yields nothing; receives the query. */
  enumNoResults?: (query: string) => string
  /** Chrome labels for a field-level ApiDocsSchemaComposition block. */
  composition?: SchemaCompositionLabels
}

/** Public props contract for ApiDocsFieldItem. Kept outside the SFC so its
 *  legacy type re-exports remain separate from Vue's prop-type extraction. */
export interface FieldItemProps extends FieldNode {
  labels?: FieldItemLabels
}

// ---------------------------------------------------------------------------
// Schema composition model (oneOf / anyOf / allOf + discriminator).
// Rendered by ApiDocsSchemaComposition. Presentation-neutral: the component
// never parses an OpenAPI document and never depends on a consumer's contract
// types. Schema variants and example scenarios are two different concepts —
// this model does not assume shared ids or any linkage.
// ---------------------------------------------------------------------------

export type CompositionKind = 'oneOf' | 'anyOf' | 'allOf'

export interface CompositionVariant {
  /** Stable identity for tab selection and discriminator mapping. Never
   *  rendered as part of a wire path or used to derive field anchors. */
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

interface CompositionNodeBase {
  /** Order preserved, ids stable. */
  variants: CompositionVariant[]
}

/** A discriminator selects alternatives; it cannot describe an allOf
 * conjunction. The union keeps that invalid state out of typed callers while
 * field derivation still guards JavaScript/runtime input defensively. */
export type CompositionNode =
  | (CompositionNodeBase & {
    kind: 'oneOf' | 'anyOf'
    discriminator?: CompositionDiscriminator
  })
  | (CompositionNodeBase & {
    kind: 'allOf'
    discriminator?: never
  })

/**
 * Derive the requiredness marker from the whole field, not from `required`
 * alone. A `condition` ("Required when `type` is `git`") already asserts
 * conditional requiredness, so a field carrying one is conditional whether or
 * not the author also set `required: 'conditional'`.
 *
 * This is why the condition block needs no lead-in tag of its own: the word
 * appears exactly once, in the summary row, and the derivation — not the doc
 * author's discipline — guarantees it is there. An orphan condition (a
 * `condition` with no `required`) is fixed at the data layer instead of being
 * papered over with a duplicate label 30px below the first one.
 *
 * Conflict semantics are fail-soft: an explicit `required: true` wins the
 * marker (a hard requirement is the stronger claim, and downgrading it to
 * "conditional" would be a correctness bug), while the condition text still
 * renders — the reader sees both the hard marker and the qualifying sentence
 * rather than losing information the author supplied.
 *
 * Optional returns `null`: absence of a marker IS the optional signal
 * (Stripe/Mintlify convention), so there is no `'optional'` member to render.
 */
export function fieldRequiredState(
  field: Pick<FieldNode, 'required' | 'condition'>,
): 'required' | 'conditional' | null {
  if (field.required === true) return 'required'
  if (field.required === 'conditional' || field.condition) return 'conditional'
  return null
}

/** Collect every real field anchor reachable through children and field-level
 *  compositions. Order follows the display model and duplicate paths remain
 *  visible to callers that need to diagnose invalid input. */
export function collectFieldPaths(fields: readonly FieldNode[]): string[] {
  const paths: string[] = []
  for (const field of fields) {
    if (field.path) paths.push(field.path)
    if (field.children?.length) paths.push(...collectFieldPaths(field.children))
    if (field.composition) paths.push(...collectCompositionPaths(field.composition))
  }
  return paths
}

/** Collect every field anchor reachable through a composition graph, including
 *  both variant-level and FieldNode-level nested compositions. */
export function collectCompositionPaths(composition: CompositionNode): string[] {
  const paths: string[] = []
  for (const variant of composition.variants) {
    paths.push(...collectFieldPaths(variant.fields))
    if (variant.composition) paths.push(...collectCompositionPaths(variant.composition))
  }
  return paths
}

/** Outline level of variant section headings. Nested compositions render one
 *  level deeper, capped at 6. */
export type HeadingLevel = 3 | 4 | 5 | 6

/** Component-owned chrome copy for ApiDocsSchemaComposition, overridable for
 *  i18n (FieldItem convention). */
export interface SchemaCompositionLabels {
  oneOf?: string
  anyOf?: string
  allOf?: string
  /** Assistive sentence under the kind eyebrow. Visible text, not color-only. */
  oneOfHint?: string
  anyOfHint?: string
  allOfHint?: string
  /** Description factory for the synthesized discriminator field row. A
   *  variant may accept multiple wire values, including the empty string. */
  discriminatorDescription?: (values: readonly string[]) => string
  empty?: string
}
