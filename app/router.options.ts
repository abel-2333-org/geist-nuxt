import type { RouterConfig } from '@nuxt/schema'

// Field deep links use hierarchical, underscore-separated ids (e.g.
// `request-body_txnOrderMsg_periodValue`). The target often lives inside a
// collapsed section that must expand before it can be scrolled to, so Vue
// Router's default hash scrollBehavior would scroll to a stale position (or the
// top) and fight our anchor logic. `useFieldAnchor` owns that whole flow
// (expand ancestors → wait for layout → scroll → flash), so we opt the router
// out of hash scrolling entirely and let the composable drive it.
export default <RouterConfig>{
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return false
    return { top: 0 }
  },
}
