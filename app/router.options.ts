import type { RouterConfig } from '@nuxt/schema'

// Consumer-layer scroll policy (NOT shipped by the api-docs kit — global
// routing is the app's concern). Two hash regimes coexist:
//
// - Cold load with a hash: return false. Anchor owners handle it themselves —
//   useFieldAnchor.initFromHash waits for ancestor collapsibles to expand and
//   then scrolls once to the settled position (the router's own eager jump
//   would land at a pre-expansion offset and flash).
// - Client-side navigation to a hash (sidebar anchor links, prev/next into a
//   reference section): the router MUST scroll — these links go through vue-
//   router, and field anchors never do (useFieldAnchor updates the hash via
//   history.replaceState), so there is no double-scroll risk. We scroll
//   manually with scrollIntoView and resolve(false) instead of returning
//   `{ el }`: vue-router's own element scroll ignores CSS scroll-margin, so
//   targets would land flush at the viewport top, hidden under sticky chrome —
//   scrollIntoView honors the targets' scroll-mt-*. Cross-page navigations
//   wait for the destination page to finish rendering first; the second
//   scrollIntoView on the next frame re-settles after late reflow (images,
//   code blocks above the target), mirroring useFieldAnchor.goTo.
export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    if (to.hash) {
      if (from.matched.length === 0) return false // cold load → anchor owners

      const scrollToHash = (resolve: (v: false | { top: number }) => void) => {
        const el = document.getElementById(decodeURIComponent(to.hash.slice(1)))
        if (!el) return resolve({ top: 0 })
        el.scrollIntoView({ block: 'start' })
        requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
        resolve(false)
      }

      if (to.path === from.path) {
        return new Promise((resolve) => {
          requestAnimationFrame(() => scrollToHash(resolve))
        })
      }
      const nuxtApp = useNuxtApp()
      return new Promise((resolve) => {
        nuxtApp.hooks.hookOnce('page:finish', () => {
          requestAnimationFrame(() => scrollToHash(resolve))
        })
      })
    }
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
}
