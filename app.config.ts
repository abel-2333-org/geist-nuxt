// Runtime UI configuration — semantic color aliases and default variants.
// The actual color *values* (violet primary ramp, Geist gray scale) are defined
// as CSS variables in app/assets/css/main.css; these aliases only tell Nuxt UI
// which Tailwind palette backs each non-overridden semantic role.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'violet',   // overridden by the custom ramp in main.css
      secondary: 'teal',   // Geist accent (Geist has no cyan)
      success: 'green',
      info: 'blue',
      warning: 'amber',
      error: 'red',
      neutral: 'neutral',  // true-gray; exact Geist values overridden in main.css
    },
    // Elevation: Nuxt UI defaults every overlay to `shadow-lg`. Geist gives
    // modals/dialogs a heavier shadow than popovers, so we bump modal &
    // slideover to the `shadow-xl` tier (defined in main.css). tailwind-merge
    // dedupes the shadow class, so shadow-xl wins over the default shadow-lg.
    modal: {
      slots: { content: 'shadow-xl' },
    },
    slideover: {
      slots: { content: 'shadow-xl' },
    },
  },
})
