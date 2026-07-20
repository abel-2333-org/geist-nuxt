import type { InjectionKey } from 'vue'
import type { FieldNode } from '../../kits/api-docs/components/FieldItem.vue'

/**
 * Playground candidate → kits/api-docs (travels with FieldAnnotation).
 *
 * Mirror of useGlossary for API fields: the page (or layout) registers the
 * fields its narrative wants to reference — including fields documented on
 * OTHER pages — and markdown only ever references ids:
 *
 *   :field[repoId]{field-ref="create-deployment.gitSource.repoId"}
 *
 * Same-page entries omit `page`; the annotation deep-links via useFieldAnchor
 * (scroll + expand + flash on this page). Cross-page entries set `page` to the
 * route documenting the field; the annotation then links to `{page}#{path}`,
 * and the target page's own `initFromHash()` handles expand + scroll + flash
 * on arrival — no extra wiring needed beyond what reference pages already do.
 */
export interface FieldSourceEntry {
  /** The field to preview — typically re-exported from the page's field tree. */
  field: FieldNode
  /** Route of the page documenting this field. Omit for the current page. */
  page?: string
}

export type FieldSourceMap = Record<string, FieldSourceEntry>

const FIELD_SOURCE_KEY: InjectionKey<FieldSourceMap> = Symbol('geist-field-source')

/** Call in a page/layout/demo setup to expose referenced fields to descendants. */
export function provideFieldSource(map: FieldSourceMap) {
  provide(FIELD_SOURCE_KEY, map)
}

/** Resolve the nearest provided field source; empty map when none is provided. */
export function useFieldSource(): FieldSourceMap {
  return inject(FIELD_SOURCE_KEY, {})
}
