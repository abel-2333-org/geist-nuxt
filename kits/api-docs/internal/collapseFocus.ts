import type { ObjectDirective } from 'vue'

// Limit inert to collapsing and clipped expansion. Stable hidden-until-found content must stay
// discoverable by native find and fragment navigation, which emit beforematch.
type FocusState = { opening: boolean, hidden: MutationObserver, size: ResizeObserver }
const states = new WeakMap<HTMLElement, FocusState>()

// Each directive sits on the existing content-slot root: Nuxt UI 4.9 renders
// that slot directly inside Reka CollapsibleContent. Recheck on dependency upgrades.
function contentFor(region: HTMLElement) {
  return region.parentElement as HTMLElement
}

function release(content: HTMLElement) {
  content.removeAttribute('inert')
}

export const vCollapseFocus: ObjectDirective<HTMLElement, boolean | undefined> = {
  mounted(region) {
    const content = contentFor(region)
    const releaseExpanded = () => {
      const state = states.get(region)
      // The visible box must accommodate its content before descendants can
      // receive Tab. ResizeObserver follows the real geometry, including
      // reduced motion and reversals; no animation duration is assumed.
      if (state?.opening && !content.hasAttribute('hidden')
        && content.clientHeight > 0 && content.clientHeight >= region.offsetHeight) {
        state.opening = false
        release(content)
      }
    }
    const hidden = new MutationObserver(() => {
      if (!states.get(region)?.opening && content.hasAttribute('hidden')) release(content)
      else releaseExpanded()
    })
    const size = new ResizeObserver(releaseExpanded)
    states.set(region, { opening: false, hidden, size })
    hidden.observe(content, { attributes: true, attributeFilter: ['hidden'] })
    size.observe(content)
  },
  beforeUpdate(region, { value, oldValue }) {
    if (Boolean(value) === Boolean(oldValue)) return
    const content = contentFor(region)
    const state = states.get(region)
    if (state) state.opening = Boolean(value)
    if (value) {
      content.setAttribute('inert', '')
      return
    }

    // Restore before applying inert (which can itself blur active descendants).
    // The public ARIA relation covers both Reka's trigger and anyOf's external
    // trigger, without inventing IDs or coupling to Vue component instances.
    if (content.contains(content.ownerDocument.activeElement)) {
      const ids = [content.id, region.id].filter(Boolean)
      const selector = ids.map(id => `button[aria-controls="${CSS.escape(id)}"]`).join(',')
      const trigger = selector ? content.ownerDocument.querySelector<HTMLElement>(selector) : null
      if (trigger && !trigger.closest('[hidden], [inert], [data-slot="content"][data-state="closed"]')) {
        trigger.focus({ preventScroll: true })
      }
    }
    if (content.hasAttribute('hidden')) release(content)
    else content.setAttribute('inert', '')
  },
  unmounted(region) {
    const state = states.get(region)
    state?.hidden.disconnect()
    state?.size.disconnect()
    states.delete(region)
  },
}
