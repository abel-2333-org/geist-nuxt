import type { InjectionKey } from 'vue'

/**
 * Playground candidate → foundation (travels with TermAnnotation).
 *
 * A glossary is page-scoped data: the page (or layout) provides a map of
 * term ids → entries once, and every `:term[…]{id="…"}` annotation in the
 * narrative below resolves against it. Markdown only ever references ids, so
 * definitions stay maintained in one place per consumer.
 */
export interface GlossaryEntry {
  /** Display name of the concept (used as the popover title). */
  term: string
  /** Inline-markdown definition (rendered through InlineMarkdown). */
  definition: string
  /** Optional deep link to the canonical explanation. */
  to?: string
}

export type GlossaryMap = Record<string, GlossaryEntry>

const GLOSSARY_KEY: InjectionKey<GlossaryMap> = Symbol('geist-glossary')

/** Call in a page/layout/demo setup to expose a glossary to descendants. */
export function provideGlossary(map: GlossaryMap) {
  provide(GLOSSARY_KEY, map)
}

/** Resolve the nearest provided glossary; empty map when none is provided. */
export function useGlossary(): GlossaryMap {
  return inject(GLOSSARY_KEY, {})
}
