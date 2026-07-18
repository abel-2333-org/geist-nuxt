// Source-first runtime UI configuration — semantic color aliases and defaults.
// The actual color *values* are all defined as CSS variables in
// foundation/assets/css/geist.css: the violet primary ramp, Geist gray scale, and
// the Geist functional scales (green/blue/amber/red/teal) for success/info/
// warning/error/secondary. These aliases name the Tailwind palette each role
// falls back to, but geist.css overrides every role's `--ui-color-*` scale with
// exact Geist values, so nothing renders in stock Tailwind hues.
export const geistAppConfig = {
  ui: {
    colors: {
      primary: 'violet',   // custom violet ramp in geist.css
      secondary: 'teal',   // Geist teal scale in geist.css
      success: 'green',    // Geist green scale in geist.css
      info: 'blue',        // Geist blue scale in geist.css
      warning: 'amber',    // Geist amber scale in geist.css
      error: 'red',        // Geist red scale in geist.css
      neutral: 'neutral',  // true-gray; exact Geist values in geist.css
    },
    // Elevation: Nuxt UI defaults every overlay to `shadow-lg`. Geist gives
    // modals/dialogs a heavier shadow than popovers, so we bump modal &
    // slideover to the `shadow-xl` tier (defined in geist.css). tailwind-merge
    // dedupes the shadow class, so shadow-xl wins over the default shadow-lg.
    modal: {
      slots: { content: 'shadow-xl' },
    },
    slideover: {
      slots: { content: 'shadow-xl' },
    },
  },
}
