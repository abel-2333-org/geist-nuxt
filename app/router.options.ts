import type { RouterConfig } from '@nuxt/schema'

// Consumer-layer scroll policy (NOT shipped by the api-docs kit — global
// routing is the app's concern). This is the optional polish the field-item
// slice documents: when a URL carries a field hash (e.g. #body_gitSource_ref),
// let useFieldAnchor own the scroll — it waits for ancestor collapsibles to
// expand, then scrolls once to the settled position. Returning false here
// suppresses the router's own cold-load jump to the hash, which would otherwise
// land at a pre-expansion offset and flash. Non-hash navigations keep the
// default (restore saved position, else top).
export default <RouterConfig>{
  scrollBehavior(to, _from, savedPosition) {
    if (to.hash) return false
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
}
