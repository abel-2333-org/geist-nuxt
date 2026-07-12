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
