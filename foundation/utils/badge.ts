import type { BadgeProps } from '@nuxt/ui'

/**
 * Curated semantic tones for badges — the design-system vocabulary the
 * SemanticBadge atom accepts. Deliberately a small subset (not every UBadge
 * color) so meaning stays consistent:
 *   success   = healthy / available          warning   = proceed with care
 *   neutral   = de-emphasized / winding down  error     = severe / terminal
 *   info      = informational / read-only     secondary = alternate accent
 *
 * `info`/`secondary` exist so preset wrappers that need a distinct hue per
 * value (e.g. HTTP methods: GET=info, PATCH=secondary) can still map onto the
 * atom instead of bypassing it. Mapping a domain concept (lifecycle, HTTP
 * method…) to one of these tones is a *preset* concern, kept out of the atom so
 * the atom stays reusable for any state vocabulary.
 */
export type BadgeTone = 'success' | 'warning' | 'neutral' | 'error' | 'info' | 'secondary'

/**
 * Tone → UBadge color. Typed as `Record<BadgeTone, …>` so the mapping is
 * *exhaustive*: adding a member to `BadgeTone` without adding its color here is
 * a compile error. The atom reads from this map instead of passing `tone`
 * straight through, keeping the semantic vocabulary the single source of truth.
 *
 * Today every tone maps to the identically-named Nuxt UI color, but the
 * indirection means a tone could be re-pointed (e.g. neutral → a custom gray)
 * in one place without touching the component.
 */
export const BADGE_TONE_COLOR: Record<BadgeTone, BadgeProps['color']> = {
  success: 'success',
  warning: 'warning',
  neutral: 'neutral',
  error: 'error',
  info: 'info',
  secondary: 'secondary',
}
