// INPUT contract for the API reference DSL — the raw shape a spec author (or a
// doc project's `defineEndpointSpec`) writes. This is intentionally SEPARATE
// from `reference.ts`:
//
//   • reference.ts  = domain OUTPUT (what components render / the adapter emits)
//   • spec.ts       = authoring INPUT (what the spec JSON / DSL looks like)
//
// Keeping the input contract in a type-only module (not inside the adapter)
// lets the documentation project import `EndpointSpec` to type-constrain its
// DSL, without pulling in the adapter's runtime logic. The adapter consumes
// these to produce the `reference.ts` domain types.

import type {
  AuthRequirement,
  EndpointLifecycle,
  FieldLifecycle,
} from './domain'

/** Locales the DSL carries copy for. `Localized` values hold every locale. */
export type Locale = 'en' | 'zh'

/** A bilingual string in the raw spec; the adapter picks the active locale. */
export type Localized = Record<Locale, string>

export interface RawEnumValue {
  value: string
  description?: Localized
}
export interface RawEnumFlat {
  kind: 'flat'
  values: RawEnumValue[]
}
export interface RawEnumVariants {
  kind: 'variants'
  variants: { title: string, when?: Localized, values: RawEnumValue[] }[]
}
export type RawEnum = RawEnumFlat | RawEnumVariants

export interface RawConstraint {
  kind: 'rule' | 'consistency' | 'unsupported' | 'values' | 'range'
  text?: Localized
  min?: number
  max?: number
  unit?: Localized
}

// Discriminated union mirroring the resolved `Nullability`, but with a
// localized `when`. The union guarantees `when` can only appear alongside
// `nullable: true` — no "not nullable but here's when it's empty" state.
export type RawNullability =
  | { nullable: false }
  | { nullable: true, when?: Localized }

export interface RawFieldLifecycle {
  status: FieldLifecycle
  since?: string
  description?: Localized
}

export interface RawField {
  name: string
  type: string
  format?: string
  required?: boolean | 'conditional'
  condition?: Localized
  description?: Localized
  example?: string | string[]
  enum?: RawEnum
  constraints?: RawConstraint[]
  nullability?: RawNullability
  lifecycle?: RawFieldLifecycle
  children?: RawField[]
}

// A worked example carries a full request/response BODY (an object), plus a
// localized title used as the scenario label. The body is rendered verbatim as
// formatted JSON — we don't synthesize curl/node/python variants the spec
// doesn't contain.
export interface RawExample {
  id: string
  title: Localized
  body: unknown
}
// Response examples additionally may declare the HTTP status they illustrate.
// Absent → treated as a 200 OK success shape (all current examples are success).
export interface RawResponseExample extends RawExample {
  status?: number
  statusText?: string
}

/** The full raw endpoint spec — the authoring contract the adapter consumes. */
export interface EndpointSpec {
  endpoint: { domain: string, method: string, path: string, lifecycle?: EndpointLifecycle }
  request: {
    authentication?: { requirements: AuthRequirement[] }
    headers?: RawField[]
    body: RawField[]
    examples?: RawExample[]
  }
  response: { body: RawField[], examples?: RawResponseExample[] }
}
