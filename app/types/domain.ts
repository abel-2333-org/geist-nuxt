/**
 * Domain (OUTPUT) types: the resolved model the reference components render and
 * the spec adapter produces. Pairs with `~/types/spec` (the authoring INPUT
 * contract) — spec.ts is what an author writes, domain.ts is what the UI
 * consumes. Kept in a dedicated module (not inside a .vue component) so both the
 * field components and the adapter import them without a circular dependency.
 */

export type RequiredState = boolean | 'conditional'

/**
 * Curated semantic tones for status badges — the design-system vocabulary the
 * StatusBadge atom accepts. Deliberately a small subset (not every UBadge
 * color) so meaning stays consistent: success = healthy/available, warning =
 * proceed with care, neutral = de-emphasized/winding down, error = severe/
 * terminal. Mapping a domain concept (lifecycle, HTTP status…) to one of these
 * tones is a *preset* concern, kept out of the atom so the atom is reusable.
 */
export type BadgeTone = 'success' | 'warning' | 'neutral' | 'error'

/**
 * Two orthogonal lifecycle dimensions rendered by the same StatusBadge:
 *  - FieldLifecycle    — applies to an individual parameter.
 *  - EndpointLifecycle — applies to the whole operation (shown in the header).
 * `deprecated` is the only value common to both.
 */
export type FieldLifecycle = 'new' | 'beta' | 'deprecated'
export type EndpointLifecycle = 'active' | 'maintenance' | 'deprecated' | 'sunset'
export type LifecycleStatus = FieldLifecycle | EndpointLifecycle

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

/** A short contract note shown under a field (constraints, consistency rules…). */
export interface FieldContractNote {
  tone?: 'caution' | 'info'
  /** Category tag (Range / Rule / Unsupported…) rendered as a leading pill. */
  label?: string
  text: string
}

/**
 * Whether a field's VALUE can be empty/null. The field itself is always
 * structurally present (e.g. a CSV column always exists, a JSON key is always
 * returned) — this only describes the value. Modelled as a discriminated union
 * so `when` is only expressible on the nullable branch: it's impossible to
 * write "not nullable, but here's when it's empty". Absence of the whole field
 * means the value is always present.
 */
export type Nullability =
  | { nullable: false }
  | { nullable: true, when?: string }

/** A single enum member. */
export interface EnumValue {
  value: string
  description: string
}

/** A named group of enum members — e.g. bank lists that apply under a condition. */
export interface EnumVariant {
  title: string
  /** When this group of values applies (already localized). */
  when?: string
  values: EnumValue[]
}

/** A field node. `children` (object/array subfields) is what makes it expandable. */
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
  /**
   * Whether the value can be empty/null. Omit for always-present values.
   * Kept as structured data (not just a note) so the row can style it
   * independently later; the adapter also derives a note from it for display.
   */
  nullability?: Nullability
  notes?: FieldContractNote[]
  /** Flat enum (single list of allowed values). */
  enumValues?: EnumValue[]
  /** Grouped enum (values that vary by condition). */
  enumVariants?: EnumVariant[]
  /** Object/array subfields. Presence of children is the only thing that makes a row expandable. */
  children?: FieldNode[]
}

/**
 * One authentication requirement for an endpoint. Discriminated on `scheme` so
 * each variant only carries its own fields — e.g. `ip-allowlist` can't
 * accidentally carry a signing `algorithm`, mirroring how `Nullability` makes
 * illegal states unrepresentable. An endpoint's requirements are an array;
 * multiple entries mean ALL must be satisfied (AND).
 */
export type AuthRequirement =
  | { scheme: 'body-sign', field: string, algorithm: 'sha256', rule: string, reference?: string }
  | { scheme: 'header-api-key', header: string, reference?: string }
  | { scheme: 'ip-allowlist', reference?: string }

/** The supported auth scheme discriminants (drives the auth preset map). */
export type AuthScheme = AuthRequirement['scheme']

/* ------------------------------------------------------------------ *
 * Worked-example display types
 *
 * These describe what CodeBlock / RequestExample / ResponseExample RENDER
 * (the display shape), and are also what the adapter PRODUCES. They live here
 * — the shared domain module — so the dependency flows components → types ←
 * adapter, exactly like FieldNode. Neither the adapter nor a sibling component
 * imports another component just to borrow a type.
 * ------------------------------------------------------------------ */

/** A single language variant of a code sample (curl / json / node …). */
export interface CodeVariant {
  /** Language id used for selection, e.g. 'curl' | 'json' | 'node' | 'python' | 'go'. */
  language: string
  /** Display label for the language switch. Falls back to a humanized id. */
  label?: string
  /** Raw source — this is what gets copied and rendered. */
  code: string
}

/**
 * Component-owned ("chrome") copy for CodeBlock, so a doc site can localize the
 * block in one place — e.g. pass `$t()` values from @nuxtjs/i18n. Content
 * strings (language labels, titles) come from the data props, rendered verbatim.
 */
export interface ApiCodeLabels {
  language?: string
  copy?: string
  copied?: string
  wrapOn?: string
  wrapOff?: string
  emptyTitle?: string
  emptyHint?: string
}

/** A request example scenario (e.g. 收银台支付), carrying its language variants. */
export interface RequestScenario {
  /** Stable id for selection. */
  id: string
  /** Scenario label, already localized upstream, e.g. '收银台支付'. */
  label: string
  /** Language variants for this scenario. Empty → unavailable state. */
  variants: CodeVariant[]
}

/** Adds request-level chrome copy on top of CodeBlock's labels. */
export interface ApiRequestLabels extends ApiCodeLabels {
  title?: string
  scenario?: string
}

/** One HTTP status shape within a response scenario (200 / 400 / 401 …). */
export interface ResponseStatus {
  /** Numeric HTTP status, e.g. 200 | 400 | 401. */
  status: number
  /** Short human label, e.g. 'OK' | 'Bad Request'. */
  statusText?: string
  /** Language variants for this status (usually one, e.g. JSON). */
  variants: CodeVariant[]
}

/** A response example scenario, carrying one or more HTTP statuses. */
export interface ResponseScenario {
  /** Stable id for selection. */
  id: string
  /** Scenario label, already localized upstream, e.g. '收银台支付'. */
  label: string
  /** Statuses available for this scenario. */
  statuses: ResponseStatus[]
}

/** Adds response-level chrome copy on top of CodeBlock's labels. */
export interface ApiResponseLabels extends ApiCodeLabels {
  title?: string
  scenario?: string
  status?: string
}
