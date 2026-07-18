import type { BadgeProps } from '@nuxt/ui'
// `BadgeTone` is provided by the foundation badge utility and auto-imported from
// app/utils after copy-in. No source-layout alias is needed.

/**
 * Two orthogonal lifecycle dimensions rendered by the same SemanticBadge:
 *  - FieldLifecycle    — applies to an individual parameter (new/beta/deprecated).
 *  - EndpointLifecycle — applies to the whole operation (active/maintenance/
 *                        deprecated/sunset), shown in the operation header.
 * `deprecated` is the only value common to both. Kept here (the preset that
 * "knows" the lifecycle vocabulary) so the slice is self-contained: the domain
 * type and its tone calibration travel together.
 */
export type FieldLifecycle = 'new' | 'beta' | 'deprecated'
export type EndpointLifecycle = 'active' | 'maintenance' | 'deprecated' | 'sunset'
export type LifecycleStatus = FieldLifecycle | EndpointLifecycle

/**
 * OPINIONATED PRESET: maps each lifecycle value to SemanticBadge atom props.
 *
 * This is the layer that "knows" the lifecycle vocabulary — deliberately split
 * from the foundation atom so the atom stays reusable and this calibration is easy to
 * override/extend (add a value, retune a tone) without touching rendering.
 *
 * Tone calibration (each hue owns ONE meaning; a lifecycle value is singular
 * per entity, so states never co-occur):
 *   new / active        → success  — healthy / available
 *   beta / maintenance  → warning  — usable, proceed with care
 *   deprecated          → neutral  — winding down, de-emphasized but usable;
 *                                    NOT red, which frees red for the terminal
 *                                    state and avoids clashing with the red
 *                                    "Required" role on the same field row
 *   sunset              → error + solid — the most severe, terminal step,
 *                                    clearly escalated beyond deprecated
 *
 * `label` is the built-in English default; callers may override per-render for
 * i18n. Keeping labels here (not in the atom) means one place to localize.
 */
export interface LifecyclePresetEntry {
  tone: BadgeTone
  variant: BadgeProps['variant']
  icon: string
  label: string
}

export const lifecyclePreset: Record<LifecycleStatus, LifecyclePresetEntry> = {
  // Field dimension
  new: { tone: 'success', variant: 'subtle', icon: 'i-lucide-sparkles', label: 'New' },
  beta: { tone: 'warning', variant: 'subtle', icon: 'i-lucide-flask-conical', label: 'Beta' },
  // Endpoint dimension
  active: { tone: 'success', variant: 'subtle', icon: 'i-lucide-circle-check', label: 'Active' },
  maintenance: { tone: 'warning', variant: 'subtle', icon: 'i-lucide-wrench', label: 'Maintenance' },
  // Shared terminal-ish states
  deprecated: { tone: 'neutral', variant: 'subtle', icon: 'i-lucide-ban', label: 'Deprecated' },
  sunset: { tone: 'error', variant: 'solid', icon: 'i-lucide-calendar-clock', label: 'Sunsetting' },
}
