import { onBeforeUnmount, onMounted, shallowRef, toValue, watch, type MaybeRefOrGetter, type ShallowRef } from 'vue'
import { geistMinWidthQuery, type GeistBreakpoint } from '../utils/breakpoints'

/**
 * SSR-safe breakpoint gate: `true` from the given system breakpoint up.
 *
 * The single source of the "manual matchMedia" gate previously mirrored by
 * `<SplitPane>` and the api-docs `<CodeRail>`: the ref starts `false` on the
 * server so SSR and the first client render agree (stacked / gated-off), then
 * flips on the client after mount. `'always'` opts out of gating entirely —
 * the ref is `true` from the first (server) render.
 *
 * Deliberately NOT VueUse `useMediaQuery`: in this hydration-sensitive spot it
 * did not sync reliably after mount (see SplitPane's history), so the media
 * query list is owned and subscribed manually here.
 *
 * The breakpoint may be a ref/getter: changing it after mount re-subscribes,
 * so a prop-driven gate follows runtime changes instead of freezing the
 * mount-time value (both former copies froze it — centralizing fixes that
 * inconsistency once).
 */
export function useBreakpointGate(
  breakpoint: MaybeRefOrGetter<GeistBreakpoint | 'always'>,
): ShallowRef<boolean> {
  const enabled = shallowRef(toValue(breakpoint) === 'always')

  let mql: MediaQueryList | undefined
  function onChange(event: MediaQueryListEvent | MediaQueryList) {
    enabled.value = event.matches
  }
  function unbind() {
    mql?.removeEventListener('change', onChange)
    mql = undefined
  }

  onMounted(() => {
    // Registered inside onMounted so the watcher never runs during SSR; it is
    // created synchronously within the hook, so it still auto-stops on unmount.
    watch(() => toValue(breakpoint), (bp) => {
      unbind()
      if (bp === 'always') {
        enabled.value = true
        return
      }
      mql = window.matchMedia(geistMinWidthQuery(bp))
      onChange(mql)
      mql.addEventListener('change', onChange)
    }, { immediate: true })
  })
  onBeforeUnmount(unbind)

  return enabled
}
