// Source-first runtime UI configuration — semantic color aliases and defaults.
// The actual color *values* are all defined as CSS variables in
// foundation/assets/css/main.css. These aliases name the Tailwind palette each
// semantic role falls back to, while main.css supplies the distributed token
// values so nothing renders in stock Tailwind hues.
export default {
  ui: {
    colors: {
      primary: 'violet',   // custom violet ramp in main.css
      secondary: 'teal',   // secondary scale in main.css
      success: 'green',    // success scale in main.css
      info: 'blue',        // info scale in main.css
      warning: 'amber',    // warning scale in main.css
      error: 'red',        // error scale in main.css
      neutral: 'neutral',  // true-gray semantic values in main.css
    },
    // Elevation: modals and slideovers use the heavier `shadow-xl` tier from
    // main.css; tailwind-merge dedupes the default `shadow-lg` class.
    modal: {
      slots: { content: 'shadow-xl' },
    },
    slideover: {
      slots: { content: 'shadow-xl' },
    },
  },
}
