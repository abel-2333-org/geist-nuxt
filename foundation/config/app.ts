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
    // Opaque solid states keep the parent surface out of the color pairing.
    // Full class literals are intentional: Tailwind scans this copy-in file.
    // Preserve upstream inverse text, disabled behavior and focus indicators.
    button: {
      compoundVariants: [
        {
          color: ['primary', 'secondary', 'success', 'info', 'warning', 'error'],
          variant: 'solid',
          // Mixed-color endpoints interpolate through Oklab in Chromium and
          // can leave sRGB between states. Keep the accepted opaque state
          // feedback without introducing unverified intermediate paint.
          // Keep the mix direction local so ordinary instance hover/active
          // utilities still override the same modifiers in both themes.
          class: 'transition-none [--geist-button-state-mix:black] dark:[--geist-button-state-mix:white]',
        },
        {
          color: 'primary', variant: 'solid',
          class: 'hover:bg-[color-mix(in_srgb,var(--ui-primary)_90%,var(--geist-button-state-mix))] active:bg-[color-mix(in_srgb,var(--ui-primary)_80%,var(--geist-button-state-mix))]',
        },
        {
          color: 'secondary', variant: 'solid',
          class: 'hover:bg-[color-mix(in_srgb,var(--ui-secondary)_90%,var(--geist-button-state-mix))] active:bg-[color-mix(in_srgb,var(--ui-secondary)_80%,var(--geist-button-state-mix))]',
        },
        {
          color: 'success', variant: 'solid',
          class: 'hover:bg-[color-mix(in_srgb,var(--ui-success)_90%,var(--geist-button-state-mix))] active:bg-[color-mix(in_srgb,var(--ui-success)_80%,var(--geist-button-state-mix))]',
        },
        {
          color: 'info', variant: 'solid',
          class: 'hover:bg-[color-mix(in_srgb,var(--ui-info)_90%,var(--geist-button-state-mix))] active:bg-[color-mix(in_srgb,var(--ui-info)_80%,var(--geist-button-state-mix))]',
        },
        {
          color: 'warning', variant: 'solid',
          class: 'hover:bg-[color-mix(in_srgb,var(--ui-warning)_90%,var(--geist-button-state-mix))] active:bg-[color-mix(in_srgb,var(--ui-warning)_80%,var(--geist-button-state-mix))]',
        },
        {
          color: 'error', variant: 'solid',
          class: 'hover:bg-[color-mix(in_srgb,var(--ui-error)_90%,var(--geist-button-state-mix))] active:bg-[color-mix(in_srgb,var(--ui-error)_80%,var(--geist-button-state-mix))]',
        },
        // Link state is communicated by decoration without fading its text.
        { color: 'primary', variant: 'link', class: 'hover:text-primary active:text-primary' },
        { color: 'secondary', variant: 'link', class: 'hover:text-secondary active:text-secondary' },
        { color: 'success', variant: 'link', class: 'hover:text-success active:text-success' },
        { color: 'info', variant: 'link', class: 'hover:text-info active:text-info' },
        { color: 'warning', variant: 'link', class: 'hover:text-warning active:text-warning' },
        { color: 'error', variant: 'link', class: 'hover:text-error active:text-error' },
        {
          color: ['primary', 'secondary', 'success', 'info', 'warning', 'error'],
          variant: 'link',
          class: 'hover:underline active:underline disabled:no-underline aria-disabled:no-underline',
        },
      ],
    },
    alert: {
      compoundVariants: [{
        color: ['primary', 'secondary', 'success', 'info', 'warning', 'error'],
        class: { description: 'opacity-100' },
      }],
    },
    // Elevation: modals and slideovers use the heavier `shadow-xl` tier from
    // main.css; tailwind-merge dedupes the default `shadow-lg` class.
    modal: {
      slots: { content: 'shadow-xl' },
    },
    slideover: {
      slots: { content: 'shadow-xl' },
    },
    // Normal text roles target neutral surfaces. Solid variants use an inverse
    // surface, so these supporting slots must follow text-inverted too. Keep
    // each slot's upstream typography/layout and every other variant intact.
    card: {
      variants: { variant: { solid: { description: 'text-inverted' } } },
    },
    empty: {
      variants: { variant: { solid: { description: 'text-inverted' } } },
    },
    pageCTA: {
      variants: { variant: { solid: { description: 'text-inverted' } } },
    },
    pageCard: {
      variants: { variant: { solid: { description: 'text-inverted' } } },
    },
    pricingPlan: {
      variants: {
        variant: {
          solid: {
            description: 'text-inverted',
            discount: 'text-inverted',
            billingCycle: 'text-inverted',
            billingPeriod: 'text-inverted',
            featureTitle: 'text-inverted',
            tagline: 'text-inverted',
            terms: 'text-inverted',
          },
        },
      },
    },
    // Class merging: Nuxt UI feeds this into tailwind-variants' createTV, which
    // builds every component's tailwind-merge instance from it. tailwind-merge
    // only recognises the stock t-shirt sizes (text-xs/sm/…) as font-size
    // classes; the foundation's own `text-code` utility (main.css `--text-code`)
    // would otherwise be filed under text-color, so it neither replaces a
    // theme's `text-sm` nor survives a caller's `text-error` (see
    // tests/component/inline-code.spec.ts). Registering it here makes the
    // override priority (class prop → theme default) hold for the 13px tier.
    tv: {
      twMergeConfig: {
        extend: {
          classGroups: {
            'font-size': [{ text: ['code'] }],
          },
        },
      },
    },
  },
}
