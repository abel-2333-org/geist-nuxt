import type { BadgeProps } from '@nuxt/ui'
// `BadgeTone` is provided by the foundation badge utility and auto-imported from
// app/utils after copy-in. No source-layout alias is needed.

/** The HTTP methods this preset calibrates. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * OPINIONATED PRESET: maps each HTTP method to SemanticBadge atom props.
 *
 * Mirrors `lifecycle-preset.ts` — the layer that "knows" the HTTP method
 * vocabulary, split from the foundation atom so the atom stays reusable and this
 * calibration is easy to override without touching rendering.
 *
 * Tone calibration (color is a *reinforcement*, never the sole signal — the
 * method text always spells out the verb):
 *   GET    → info      — safe, read-only, no side effects
 *   POST   → success   — creates a resource
 *   PUT    → warning   — full replace, proceed with care
 *   PATCH  → secondary — partial update, an alternate mutating accent
 *   DELETE → error     — destructive / terminal
 *
 * Methods have no leading icon by design: the uppercase mono verb is the mark.
 */
export interface MethodPresetEntry {
  tone: BadgeTone
  variant: BadgeProps['variant']
}

export const methodPreset: Record<HttpMethod, MethodPresetEntry> = {
  GET: { tone: 'info', variant: 'subtle' },
  POST: { tone: 'success', variant: 'subtle' },
  PUT: { tone: 'warning', variant: 'subtle' },
  PATCH: { tone: 'secondary', variant: 'subtle' },
  DELETE: { tone: 'error', variant: 'subtle' },
}

/** Fallback tone for an unknown/unsupported method string. */
export const methodFallback: MethodPresetEntry = { tone: 'neutral', variant: 'subtle' }
