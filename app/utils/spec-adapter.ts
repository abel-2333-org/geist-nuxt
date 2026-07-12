import type {
  AuthRequirement,
  EndpointLifecycle,
  EnumValue,
  EnumVariant,
  FieldContractNote,
  FieldLifecycleInfo,
  FieldNode,
  Nullability,
  RequestScenario,
  ResponseScenario,
} from '~/types/domain'
import type {
  EndpointSpec,
  Locale,
  Localized,
  RawConstraint,
  RawEnumValue,
  RawExample,
  RawField,
  RawNullability,
  RawResponseExample,
} from '~/types/spec'

/**
 * Adapter layer: turns the raw endpoint spec JSON (see `~/types/spec`) into the
 * domain props our reference components consume (see `~/types/domain`). The
 * spec is the single source of truth — edit the JSON and the page follows.
 * Nothing here is hand-transcribed per field.
 */

// Which locale to surface. Switching to `'zh'` renders the whole page in
// Chinese with no other changes.
const LOCALE: Locale = 'en'

function loc(v: Localized | undefined): string | undefined {
  return v?.[LOCALE]
}

// Human-readable tag per constraint kind. The label carries the category so the
// note text itself can stay a bare clause (no redundant "Allowed range:" prefix).
const CONSTRAINT_LABEL: Record<RawConstraint['kind'], string> = {
  range: 'Range',
  rule: 'Rule',
  consistency: 'Consistency',
  values: 'Values',
  unsupported: 'Unsupported',
}

/** Map a spec constraint to a contract note, formatting structured kinds to prose. */
function constraintToNote(c: RawConstraint): FieldContractNote {
  const label = CONSTRAINT_LABEL[c.kind]
  if (c.kind === 'range') {
    const unit = loc(c.unit)
    const span = `${c.min}\u2013${c.max}${unit ? ` ${unit}` : ''}`
    return { tone: 'info', label, text: span }
  }
  // `unsupported` is a real "you can't do this here" caveat → caution.
  const tone = c.kind === 'unsupported' ? 'caution' : 'info'
  return { tone, label, text: loc(c.text) ?? '' }
}

/**
 * Resolve the raw nullability union to the display shape (localized `when`).
 * Returns undefined for always-present values so the field stays clean.
 */
function resolveNullability(
  n: RawNullability | undefined,
): Extract<Nullability, { nullable: true }> | undefined {
  if (!n?.nullable) return undefined
  const when = loc(n.when)
  return when ? { nullable: true, when } : { nullable: true }
}

/** Derive the display note for a nullable value (rendered under the field). */
function nullabilityToNote(n: Extract<Nullability, { nullable: true }>): FieldContractNote {
  return {
    tone: 'info',
    label: 'Nullable',
    text: n.when ?? 'This value may be empty.',
  }
}

function toEnumValues(values: RawEnumValue[]): EnumValue[] {
  return values.map(v => ({ value: v.value, description: loc(v.description) ?? '' }))
}

// Build a stable, unique, hierarchical id for deep linking. Segments keep the
// raw (camelCase) field name so the anchor stays readable and matches the API
// contract; the dash-cased scope prefix disambiguates same-named fields across
// headers/body/response. Segments are joined with `_` — a URL-unreserved char
// that (unlike `.`) doesn't collide with CSS selectors, e.g.
// `request-body_txnOrderMsg_periodValue`.
function mapField(f: RawField, parentPath: string): FieldNode {
  const path = `${parentPath}_${f.name}`
  const notes: FieldContractNote[] = []
  for (const c of f.constraints ?? []) {
    const n = constraintToNote(c)
    if (n.text) notes.push(n)
  }
  const nullability = resolveNullability(f.nullability)
  if (nullability) notes.push(nullabilityToNote(nullability))

  const examples
    = f.example === undefined
      ? undefined
      : Array.isArray(f.example)
        ? f.example
        : [f.example]

  let enumValues: EnumValue[] | undefined
  let enumVariants: EnumVariant[] | undefined
  if (f.enum?.kind === 'flat') {
    enumValues = toEnumValues(f.enum.values)
  }
  else if (f.enum?.kind === 'variants') {
    enumVariants = f.enum.variants.map(v => ({
      title: v.title,
      when: loc(v.when),
      values: toEnumValues(v.values),
    }))
  }

  let lifecycle: FieldLifecycleInfo | undefined
  if (f.lifecycle) {
    lifecycle = {
      status: f.lifecycle.status,
      since: f.lifecycle.since,
      description: loc(f.lifecycle.description),
    }
  }

  return {
    path,
    name: f.name,
    type: f.type,
    format: f.format,
    required: f.required === true ? true : f.required === 'conditional' ? 'conditional' : undefined,
    condition: loc(f.condition),
    description: loc(f.description),
    examples,
    nullability,
    notes: notes.length ? notes : undefined,
    enumValues,
    enumVariants,
    lifecycle,
    children: f.children?.length ? f.children.map(c => mapField(c, path)) : undefined,
  }
}

/** Render an example body verbatim as pretty-printed JSON. */
function formatBody(body: unknown): string {
  if (typeof body === 'string') return body
  try {
    return JSON.stringify(body, null, 2)
  }
  catch {
    return String(body)
  }
}

/**
 * Map spec request examples → RequestExample scenarios. Each spec example is a
 * single JSON body (no language variants), surfaced as one `json` variant; the
 * component's scenario switch lets the reader move between them.
 */
function mapRequestExamples(examples: RawExample[] | undefined): RequestScenario[] {
  return (examples ?? []).map(ex => ({
    id: ex.id,
    label: loc(ex.title) ?? ex.id,
    variants: [{ language: 'json', code: formatBody(ex.body) }],
  }))
}

/**
 * Map spec response examples → ResponseExample scenarios. The spec carries no
 * HTTP status on these success shapes, so default to 200 OK unless one is given.
 */
function mapResponseExamples(examples: RawResponseExample[] | undefined): ResponseScenario[] {
  return (examples ?? []).map(ex => ({
    id: ex.id,
    label: loc(ex.title) ?? ex.id,
    statuses: [{
      status: ex.status ?? 200,
      statusText: ex.statusText ?? (ex.status ? undefined : 'OK'),
      variants: [{ language: 'json', code: formatBody(ex.body) }],
    }],
  }))
}

export interface AdaptedSpec {
  method: string
  path: string
  endpointStatus?: EndpointLifecycle
  authRequirements: AuthRequirement[]
  requestHeaders: FieldNode[]
  requestFields: FieldNode[]
  responseFields: FieldNode[]
  requestExamples: RequestScenario[]
  responseExamples: ResponseScenario[]
}

export function adaptSpec(spec: EndpointSpec): AdaptedSpec {
  return {
    method: spec.endpoint.method,
    path: spec.endpoint.path,
    endpointStatus: spec.endpoint.lifecycle,
    authRequirements: spec.request.authentication?.requirements ?? [],
    // Headers are just fields — reuse mapField so they inherit the same
    // required/description/example/enum rendering as body fields.
    requestHeaders: spec.request.headers?.map(f => mapField(f, 'request-headers')) ?? [],
    requestFields: spec.request.body.map(f => mapField(f, 'request-body')),
    responseFields: spec.response.body.map(f => mapField(f, 'response-body')),
    requestExamples: mapRequestExamples(spec.request.examples),
    responseExamples: mapResponseExamples(spec.response.examples),
  }
}
