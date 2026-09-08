// Field & composition display model (API docs kit).
//
// This is the data contract shared by the recursive field renderer
// (FieldItem) and the schema-composition renderer
// (SchemaComposition). It lives in a util — not inside a component — so
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
   * (e.g. a polymorphic payload). Rendered by FieldItem via
   * SchemaComposition after the children collapsible, so a field can
   * carry both concrete subfields and an alternative-shaped value.
   */
  composition?: CompositionNode
  /**
   * The shape of this field's VALUE — an array's element, a record's member,
   * or the content carried inside an encoded string. A value node has no
   * name, is never counted as a child and may recurse (`value.value`), so an
   * element of an element or JSON inside JSON stays expressible without
   * inventing a `[]` / "JSON string content" child. `children` and `value`
   * are semantically exclusive: plain object subfields go in `children`,
   * anything without a business field name goes in `value`.
   */
  value?: FieldValueNode
}

/**
 * How a value node relates to the field (or value) directly above it.
 *   item    — every element of an array.
 *   decoded — the content carried inside an encoded string (JSON today).
 *   member  — the value behind every dynamic key of a record/map.
 * There is deliberately no `self`: a value node always answers "what is one
 * level in", never "what is this field", which the field row already says.
 */
export type ValueRelation = 'item' | 'decoded' | 'member'

/**
 * One level of a field's value shape. Carries everything a field row can say
 * about a value EXCEPT identity (`name`, `required`, `condition`, `lifecycle`)
 * — those belong to a field and are precisely what a synthesized `[]` row
 * fabricates. The component never parses a schema, decodes a string or reads
 * a wire path: the consumer's adapter decides the relation, codec and type
 * exactly as it already decides a field's `type` and `format`.
 */
export interface FieldValueNode {
  relation: ValueRelation
  /**
   * Opaque anchor id for this value root, same rules as `FieldNode.path`: used
   * verbatim as the DOM id, never suffixed or split on separators. Present only
   * when the consumer actually links to the element/content root.
   */
  path?: string
  /**
   * Codec token for a `decoded` node — `json`, `base64`, … NOT a sentence and
   * NOT localized: it joins `type` on the identity line as `json<object[]>`,
   * beside the wire type the field really has (`string`). JSON is not assumed
   * anywhere; a consumer with another codec passes its own token.
   *
   * This replaced a localized "Value format" fact row. On the consumer endpoint
   * that settled it, the row repeated the identity line on every encoded field
   * (11 of them) while the one fact a reader scans for — the DECODED SHAPE —
   * sat below the fold-line where a long field list never surfaces it.
   */
  codec?: string
  /** The element/content type, e.g. `object`, `object[]`, `integer`. */
  type?: string
  description?: string
  notes?: FieldNote[]
  enumValues?: EnumValue[]
  enumVariants?: EnumVariant[]
  examples?: string[]
  defaultValue?: string
  /** Real properties of this value. These ARE fields and render as field rows —
   *  including, recursively, fields that carry a value shape of their own (a
   *  property that is itself an encoded string opens the next boundary). */
  fields?: FieldNode[]
  /** This value is itself a oneOf/anyOf/allOf. */
  composition?: CompositionNode
  /** One level further in: element of an element, JSON inside JSON, … */
  value?: FieldValueNode
}

/**
 * Scope labels for the levels of a field's value. They name the SUBJECT of a
 * rule, in the same register as the author's own category labels beside them
 * (MAX LENGTH, FORMAT, RULE): the column is already requirements, so the word
 * is dropped in English and the `each` voice is what marks a scope apart from
 * a category (`EACH ITEM` cannot be misread as a rule category the way a bare
 * `ITEM` could). One scope has one name wherever it renders — a rule that
 * changes voice depending on whether it landed inline or behind a disclosure
 * is a rule about layout, not about meaning.
 *
 * There is NO heading for the field's own constraints (reviewed and rejected:
 * such a heading has to guess what the author's note is about, and on the
 * consumer's real endpoint it guessed wrong), and NO per-boundary disclosure
 * verb (the fold reuses `showChildren` / `hideChildren`; a dedicated JSON verb
 * landed on nearly every row of an endpoint whose 11 structured fields are all
 * `string` + `json_string` and discriminated nothing).
 */
export interface FieldValueLabels {
  /** Every element of an array. */
  eachItem?: string
  /** Every dynamic key of a record. */
  eachMember?: string
  /** Decoded-content constraints. Neither says the codec: the identity line's
   *  `json<…>` token already did, 30px above. */
  decodedRequirements?: string
  /** Applies when the decoded root is itself an array, so its length /
   *  uniqueness rules do not read as rules about one element. */
  decodedArrayRequirements?: string
}

/** English defaults for the value scope labels. Lives here (not in a
 *  component) so FieldItem and its internal value renderer share one copy. */
export const fieldValueLabelDefaults: Required<FieldValueLabels> = {
  eachItem: 'Each item',
  eachMember: 'Each key',
  decodedRequirements: 'Value',
  decodedArrayRequirements: 'Array',
}

/**
 * Component-owned ("chrome") copy, so a doc site can localize every field row
 * in one place — e.g. pass `$t()` values from @nuxtjs/i18n. Content strings
 * (names, descriptions, notes) come from the data and are rendered verbatim.
 */
export interface FieldItemLabels extends FieldValueLabels {
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
  /** Chrome labels for a field-level SchemaComposition block. */
  composition?: SchemaCompositionLabels
}

/** Chrome copy FieldItem has already resolved against its defaults and hands
 *  to its internal value renderers, so every default string exists once. */
export type FieldValueChrome = Required<Pick<
  FieldItemLabels,
  'caveat' | 'note' | 'default' | 'example' | 'showChildren' | 'hideChildren'
  | 'eachItem' | 'eachMember' | 'decodedRequirements' | 'decodedArrayRequirements'
>>

/** Public props contract for FieldItem. Kept outside the SFC so its
 *  legacy type re-exports remain separate from Vue's prop-type extraction. */
export interface FieldItemProps extends FieldNode {
  labels?: FieldItemLabels
}

// ---------------------------------------------------------------------------
// Schema composition model (oneOf / anyOf / allOf + discriminator).
// Rendered by SchemaComposition. Presentation-neutral: the component
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

/** Collect every real field anchor reachable through children, field-level
 *  compositions and the value chain. Order follows the display model and
 *  duplicate paths remain visible to callers that need to diagnose invalid
 *  input.
 *
 *  The `value` branch lives INSIDE this walker on purpose, not in a helper
 *  beside it: the playground proved that with value paths collected
 *  separately, a deep link to a property inside a DOUBLY encoded payload
 *  opened only the inner region — the outer one never learned the active
 *  anchor was below it, because the path lived under
 *  `value.fields[].value.fields[]`. Every caller that collects paths itself
 *  (FieldAnnotation's source registry, a page's ancestor reveal) would
 *  inherit that blind spot. */
export function collectFieldPaths(fields: readonly FieldNode[]): string[] {
  const paths: string[] = []
  for (const field of fields) {
    if (field.path) paths.push(field.path)
    if (field.children?.length) paths.push(...collectFieldPaths(field.children))
    if (field.composition) paths.push(...collectCompositionPaths(field.composition))
    if (field.value) paths.push(...collectValuePaths(field.value))
  }
  return paths
}

/** Anchors inside one value chain: the value roots that declare a `path`, plus
 *  the real field subtrees and compositions hanging off them. */
export function collectValuePaths(value: FieldValueNode): string[] {
  const paths: string[] = []
  if (value.path) paths.push(value.path)
  if (value.fields?.length) paths.push(...collectFieldPaths(value.fields))
  if (value.composition) paths.push(...collectCompositionPaths(value.composition))
  if (value.value) paths.push(...collectValuePaths(value.value))
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

// ---------------------------------------------------------------------------
// Value shape derivation. Pure functions, so the disclosure policy is testable
// without a DOM and cannot drift between the row and any other consumer of
// the model.
//
// Disclosure policy, in three lines:
//   · nothing structural below  → no chevron at all; the rules read inline.
//   · structure below           → exactly one region, opened by the boundary
//                                 the reader actually crosses.
//   · encoded array             → decode boundary and element boundary share
//                                 that one region (see foldsIntoParentRegion).
// ---------------------------------------------------------------------------

/** A value node says something beyond its own structure. */
export function hasValueDetail(value: FieldValueNode): boolean {
  return !!value.description
    || (value.notes?.length ?? 0) > 0
    || (value.examples?.length ?? 0) > 0
    || (value.enumValues?.length ?? 0) > 0
    || (value.enumVariants?.length ?? 0) > 0
    || value.defaultValue !== undefined
}

/** This node carries real fields or an alternative shape of its own. */
export function hasOwnStructure(value: FieldValueNode): boolean {
  return (value.fields?.length ?? 0) > 0 || !!value.composition
}

/** This node, or anything further in, carries structure. Drives whether the
 *  node's requirements are read inline or behind a disclosure. */
export function hasStructureBelow(value: FieldValueNode): boolean {
  return hasOwnStructure(value) || (!!value.value && hasStructureBelow(value.value))
}

/**
 * Whether the boundary between two chained value nodes gets FOLDED into one
 * disclosure region.
 *
 * Exactly one fold exists: an encoded array. Its decode boundary and its
 * element boundary are two different facts, but only one of them is something
 * the reader has to open — "show me what is inside" already means the array,
 * and the array root's own rules belong in that same panel rather than behind
 * a second chevron.
 *
 * Every other chain (item → item for a nested array, decoded → decoded for
 * doubly-encoded content) keeps its own region. Folding those would stack two
 * identical scope headings in one panel with nothing to tell them apart,
 * which is the ambiguity the synthesized `[]` row created in the first place.
 */
export function foldsIntoParentRegion(parent: FieldValueNode, child: FieldValueNode): boolean {
  return parent.relation === 'decoded' && child.relation === 'item' && !hasOwnStructure(parent)
}

/** The scope label for a value node — what the rules below it are ABOUT. */
export function valueScopeLabelKey(value: FieldValueNode): keyof FieldValueLabels {
  if (value.relation === 'item') return 'eachItem'
  if (value.relation === 'member') return 'eachMember'
  return value.type?.endsWith('[]') || value.type?.startsWith('array')
    ? 'decodedArrayRequirements'
    : 'decodedRequirements'
}

/**
 * One value level's requirements, resolved for rendering.
 *
 * `compact` is the density rule: one unlabelled constraint and nothing else
 * becomes a single `SCOPE │ text` row, the same grammar the field band already
 * uses for a lone constraint. The moment a level says a second thing — the
 * author's own category label on that constraint, a description, enum,
 * example, default or caveat — one row can no longer hold it and the block
 * gets a heading instead, so no author-supplied label is ever dropped.
 */
export interface ValueRequirementsBlock {
  node: FieldValueNode
  /** Localized scope heading (Each item / Value / Array / …). */
  label: string
  constraints: FieldNote[]
  caveats: FieldNote[]
  compact: boolean
}

export function describeValueRequirements(
  node: FieldValueNode,
  labels: Required<FieldValueLabels>,
): ValueRequirementsBlock | null {
  if (!hasValueDetail(node)) return null
  const notes = node.notes ?? []
  const constraints = notes.filter(n => n.kind !== 'caveat')
  const caveats = notes.filter(n => n.kind === 'caveat')
  const extras = !!node.description
    || (node.examples?.length ?? 0) > 0
    || (node.enumValues?.length ?? 0) > 0
    || (node.enumVariants?.length ?? 0) > 0
    || node.defaultValue !== undefined
    || caveats.length > 0
  return {
    node,
    label: labels[valueScopeLabelKey(node)],
    constraints,
    caveats,
    compact: constraints.length === 1 && !constraints[0]!.label && !extras,
  }
}

/** Outline level of variant section headings. Nested compositions render one
 *  level deeper, capped at 6. */
export type HeadingLevel = 3 | 4 | 5 | 6

/** Component-owned chrome copy for SchemaComposition, overridable for
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
