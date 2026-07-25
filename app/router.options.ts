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
//
// Smooth vs instant mirrors useFieldAnchor: a same-page hash change is a
// JOURNEY (travel smoothly, so the reader sees where the target sits relative
// to where they were), while every arrival — cross-page hash, page change,
// restored history position — is INSTANT. Smooth is opted into per journey
// rather than set globally in CSS; foundation main.css records why.
export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    if (to.hash) {
      if (from.matched.length === 0) return false // cold load → anchor owners

      // `smooth` mirrors useFieldAnchor.goTo so every in-page hash jump feels
      // the same regardless of which mechanism moves the page: without this the
      // router's instant scroll would land first and make the kit's smooth
      // scroll a no-op. Instant keeps the next-frame re-settle for late reflow;
      // smooth must not re-settle, since a second scrollIntoView retargets the
      // in-flight animation instead of correcting it.
      const scrollToHash = (
        resolve: (v: false | { top: number }) => void,
        smooth: boolean,
      ) => {
        const el = document.getElementById(decodeURIComponent(to.hash.slice(1)))
        if (!el) return resolve({ top: 0 })
        el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
        if (!smooth) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
        resolve(false)
      }

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (to.path === from.path) {
        // Same-page hash change is a journey: travel smoothly so the reader can
        // see where the target sits relative to where they were.
        return new Promise((resolve) => {
          requestAnimationFrame(() => scrollToHash(resolve, !reduced))
        })
      }
      // Cross-page hash navigation is an arrival, not a journey: the reader
      // lands on a page they were not looking at, so there is no spatial
      // relationship to preserve and animating would just drift down from the
      // top of freshly rendered content. Instant, mirroring initFromHash.
      const nuxtApp = useNuxtApp()
      return new Promise((resolve) => {
        nuxtApp.hooks.hookOnce('page:finish', () => {
          requestAnimationFrame(() => scrollToHash(resolve, false))
        })
      })
    }
    // Arrivals, not journeys — and instant by default, since there is no global
    // CSS smooth rule to opt out of (see the note in foundation main.css).
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
}
