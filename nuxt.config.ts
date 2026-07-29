import { createResolver } from '@nuxt/kit'
import base from './foundation/config/nuxt'

const { resolve } = createResolver(import.meta.url)

// Source-first design system + living gallery. Foundation atoms, promoted kits,
// gallery chrome, and the playground are plain source directories in one app.
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxt/ui'],
  css: [resolve('./app/assets/css/main.css')],

  colorMode: base.colorMode,
  ui: base.ui,

  // Public source roots expose neutral component names. Gallery/demo prefixes
  // remain private namespaces and never leak into the registry contract.
  components: [
    {
      path: resolve('./app/components/gallery/showcase'),
      prefix: 'Showcase',
      pathPrefix: false,
    },
    {
      path: resolve('./app/components/gallery'),
      prefix: 'Gallery',
      pathPrefix: false,
      ignore: ['showcase/**'],
    },
    { path: resolve('./app/components/demo'), prefix: 'Demo', pathPrefix: true },
    { path: resolve('./playground/components'), prefix: 'Playground', pathPrefix: false },
    { path: resolve('./kits/api-docs/components'), pathPrefix: false },
    { path: resolve('./foundation/compositions'), pathPrefix: false },
    { path: resolve('./foundation/components'), pathPrefix: false },
  ],

  // Nuxt normally scans only app/composables. These explicit roots restore the
  // shared and kit composables that previously arrived through nested layers.
  imports: {
    dirs: [
      resolve('./app/composables'),
      resolve('./foundation/composables'),
      resolve('./foundation/utils'),
      resolve('./kits/api-docs/composables'),
      resolve('./kits/api-docs/utils'),
      resolve('./playground/composables'),
    ],
  },
})
