// CANDIDATE display model (issue #117) — "field value requirements & structure".
//
// Not a distributed asset. Lives in `playground/` until a human accepts the
// reading model; promotion folds it into `kits/api-docs/utils/field.ts` and the
// names below become public contract. Nothing here is imported by `foundation/`,
// `kits/` or `registry.json`.
//
// THE PROBLEM IT SOLVES
// A consumer that wants to keep an array element's or an encoded payload's
// description/constraints/composition today has exactly one slot for them:
// `FieldNode.children`. So it invents a field — `[]`, "JSON string content" —
// and the reader gets a fake parameter name, a second disclosure and a child
// count that is one too high. `children` is the wrong slot because those nodes
// have no business field name: they are the SHAPE OF A VALUE, not a field.
//
// THE MODEL
// A field may carry one `value` node. A value node has no name, is never
// counted as a child, and may recurse (`value.value`) so an element of an
// element, or JSON inside JSON, stays expressible. `relation` says how the node
// hangs off the thing above it, which is the only fact the renderer needs to
// pick chrome copy and decide whether a disclosure is warranted.
//
// The component still never parses a schema, decodes a string, or reads a wire
// path: the consumer's adapter decides what the relation and the localized
// `encoding` sentence are, exactly as it already decides `type` and `format`.
import type { EnumValue, EnumVariant } from '../../kits/api-docs/utils/enum'
import type {
  CompositionNode,
  FieldNode,
  FieldNote,
} from '../../kits/api-docs/utils/field'

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
 * fabricates.
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
  /** The element/content type, e.g. `object`, `string`, `integer`. */
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
  fields?: ValueBearingField[]
  /** This value is itself a oneOf/anyOf/allOf. */
  composition?: CompositionNode
  /** One level further in: element of an element, JSON inside JSON, … */
  value?: FieldValueNode
}

/** A field plus its candidate value shape. Additive: every existing FieldNode
 *  stays valid, and a field without `value` renders exactly as it does today. */
export interface ValueBearingField extends FieldNode {
  value?: FieldValueNode
  /** Children are still real subfields. A field that models its shape through
   *  `value` leaves this empty — that is the whole point. */
  children?: ValueBearingField[]
}

// ---------------------------------------------------------------------------
// Chrome copy. Component-owned, English defaults, overridable per doc site.
// The JSON wording is a DEFAULT, not an assumption: a consumer whose encoding
// is not JSON overrides these four strings the same way it localizes them.
// ---------------------------------------------------------------------------

export interface FieldValueLabels {
  // No heading for the FIELD's own constraints — reviewed and rejected. Such a
  // heading has to guess what the author's note is about, and on the consumer's
  // real endpoint it guessed wrong: `retailers`' rules describe marketplace
  // semantics, and labelling them "String requirements" asserted they were
  // rules about the wire string. Author-supplied note labels already carry that
  // meaning; the field's constraints stay in the field's own band.
  /** Element constraints shown inline (no structure behind them). */
  eachItem?: string
  /** Element constraints shown inside the structure region. */
  itemRequirements?: string
  /** Record member equivalents of the two above. */
  eachMember?: string
  memberRequirements?: string
  /** Decoded-content constraints. `decodedArrayRequirements` applies when the
   *  decoded root is itself an array, so its length/uniqueness rules do not
   *  read as rules about the element.
   *  Neither says "JSON": the identity line's `json<…>` token already did, and
   *  repeating the codec here is the same 30px-apart echo the kit rejects for
   *  the CONDITIONAL tag. The scope word is what carries meaning — these rules
   *  govern the VALUE, not the field. */
  decodedRequirements?: string
  decodedArrayRequirements?: string
  // NO disclosure verbs here — reviewed and rejected. A per-boundary verb only
  // repeats what the row above it already states: `format` on the identity line
  // and the VALUE FORMAT fact, both component-rendered, both present on every
  // encoded row. On the consumer endpoint that settled this (11 of its
  // structured fields are `string` + `json_string`) a dedicated JSON verb landed
  // on nearly every row and discriminated nothing. The disclosure reuses
  // FieldItem's existing `showChildren` / `hideChildren`, so this model adds no
  // verb strings to localize and the wording stays in one place.
}

export const fieldValueLabelDefaults: Required<FieldValueLabels> = {
  eachItem: 'Each item',
  itemRequirements: 'Item requirements',
  eachMember: 'Each member',
  memberRequirements: 'Member requirements',
  decodedRequirements: 'Value requirements',
  decodedArrayRequirements: 'Array requirements',
}

// ---------------------------------------------------------------------------
// Derivation. Pure functions, so the disclosure policy is testable without a
// DOM and cannot drift between the row and any future consumer of the model.
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
 * Exactly one fold exists, and it is the one issue #117 asks for by name: a
 * JSON-encoded array. Its decode boundary and its element boundary are two
 * different facts, but only one of them is something the reader has to open —
 * "show JSON structure" already means "show me what is inside", and the array
 * root's own rules belong in that same panel rather than behind a second
 * chevron labelled "show item structure".
 *
 * Every other chain (item → item for a nested array, decoded → decoded for
 * doubly-encoded content) keeps its own region. Folding those would stack two
 * "Item requirements" headings in one panel with nothing to tell them apart,
 * which is the ambiguity the `[]` row created in the first place.
 */
export function foldsIntoParentRegion(parent: FieldValueNode, child: FieldValueNode): boolean {
  return parent.relation === 'decoded' && child.relation === 'item' && !hasOwnStructure(parent)
}

/** Requirements heading for a value node, given where it will be rendered.
 *  Inline placement uses the "every one of them" voice (Each item); placement
 *  inside a structure region uses the noun voice (Item requirements). */
export function valueScopeLabelKey(
  value: FieldValueNode,
  placement: 'inline' | 'region',
): keyof FieldValueLabels {
  if (value.relation === 'item') return placement === 'inline' ? 'eachItem' : 'itemRequirements'
  if (value.relation === 'member') return placement === 'inline' ? 'eachMember' : 'memberRequirements'
  return value.type?.endsWith('[]') || value.type?.startsWith('array')
    ? 'decodedArrayRequirements'
    : 'decodedRequirements'
}

/**
 * Real fields reachable inside a value chain. Used for the disclosure's `(N)`
 * counter and for anchor collection — value roots are NOT counted, because a
 * count of "how much is behind this fold" that includes the fold's own headings
 * is the fake-field count issue #117 rejects.
 */
export function countValueFields(value: FieldValueNode): number {
  if (value.fields?.length) return value.fields.length
  return value.value ? countValueFields(value.value) : 0
}

/**
 * Every anchor reachable from a candidate field: today's field graph PLUS the
 * value chain the kit's own collector cannot see.
 *
 * These three functions are mutually recursive on purpose, and the playground
 * proved why: with `collectValuePaths` delegating to the kit's
 * `collectFieldPaths`, a deep link to a property inside a DOUBLY encoded
 * payload opened only the inner region — the outer one never learned the active
 * anchor was below it, because the kit's walker stops at `children` and the
 * path lived under `value.fields[].value.fields[]`.
 *
 * So the promotion shape is settled by evidence rather than taste: this cannot
 * ship as a helper NEXT TO `collectFieldPaths`; the `value` branch has to land
 * INSIDE it, or every consumer that collects paths itself (FieldAnnotation's
 * source registry, a page's ancestor reveal) inherits the same blind spot.
 */
export function collectCandidateFieldPaths(fields: readonly ValueBearingField[]): string[] {
  const paths: string[] = []
  for (const field of fields) {
    if (field.path) paths.push(field.path)
    if (field.children?.length) paths.push(...collectCandidateFieldPaths(field.children))
    if (field.composition) paths.push(...collectCandidateCompositionPaths(field.composition))
    if (field.value) paths.push(...collectValuePaths(field.value))
  }
  return paths
}

/** Composition variants can hold value-bearing fields too, so the candidate
 *  walks them with the candidate collector rather than the kit's. */
export function collectCandidateCompositionPaths(composition: CompositionNode): string[] {
  const paths: string[] = []
  for (const variant of composition.variants) {
    paths.push(...collectCandidateFieldPaths(variant.fields))
    if (variant.composition) paths.push(...collectCandidateCompositionPaths(variant.composition))
  }
  return paths
}

/** Anchors inside one value chain: the value roots that declare a `path`, plus
 *  the real field subtrees hanging off them. */
export function collectValuePaths(value: FieldValueNode): string[] {
  const paths: string[] = []
  if (value.path) paths.push(value.path)
  if (value.fields?.length) paths.push(...collectCandidateFieldPaths(value.fields))
  if (value.composition) paths.push(...collectCandidateCompositionPaths(value.composition))
  if (value.value) paths.push(...collectValuePaths(value.value))
  return paths
}

/**
 * One value level's requirements, resolved for rendering. Pure, so the density
 * rule below is a property of the model rather than a template accident.
 *
 * `compact` is the rule that makes the simple case read like the issue's mock:
 * one constraint and nothing else becomes a single `SCOPE │ text` row, the same
 * grammar the field band already uses for a lone constraint. The moment a level
 * also carries a description, enum, example or default, one row can no longer
 * hold it and the block gets a heading instead.
 */
export interface ValueRequirementsBlock {
  node: FieldValueNode
  /** Localized scope heading (Each item / JSON value requirements / …). */
  label: string
  constraints: FieldNote[]
  caveats: FieldNote[]
  compact: boolean
}

export function describeValueRequirements(
  node: FieldValueNode,
  placement: 'inline' | 'region',
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
    label: labels[valueScopeLabelKey(node, placement)],
    constraints,
    caveats,
    compact: constraints.length === 1 && !extras,
  }
}
