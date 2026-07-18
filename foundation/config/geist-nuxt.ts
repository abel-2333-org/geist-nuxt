/** Nuxt UI capabilities required by the Source-first foundation. */
export const geistNuxtConfig = {
  colorMode: {
    preference: 'system' as const,
    fallback: 'light' as const,
  },
  ui: {
    prose: true,
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error'],
    },
  },
}
