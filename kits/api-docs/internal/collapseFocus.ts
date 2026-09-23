import type { ObjectDirective } from 'vue'

// Limit inert to collapsing and clipped expansion. Stable hidden-until-found content must stay
// discoverable by native find and fragment navigation, which emit beforematch.
type FocusState = {
  content: HTMLElement
  opening: boolean
  nativeReveal: boolean
  frame: number
  beforematch: (event: Event) => void
  hidden: MutationObserver
  size: ResizeObserver
}
const states = new WeakMap<HTMLElement, FocusState>()
// A class avoids contaminating Reka's cached inline animationName. Keep it
// until this open cycle ends: removing it while open restarts the keyframes.
const nativeRevealAnimation = 'animate-none!'

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
    const beforematch = (event: Event) => {
      if (!event.isTrusted || event.target !== content || content.getAttribute('hidden') !== 'until-found') return
      const state = states.get(region)!
      state.nativeReveal = true
      content.classList.add(nativeRevealAnimation)
      cancelAnimationFrame(state.frame)
      // Reka toggles open in its own RAF. Allow that frame and Vue's patch
      // before discarding a reveal which never became an open transition.
      state.frame = requestAnimationFrame(() => {
        state.frame = requestAnimationFrame(() => {
          state.frame = 0
          if (states.get(region) !== state || !state.nativeReveal) return
          state.nativeReveal = false
          content.classList.remove(nativeRevealAnimation)
        })
      })
    }
    states.set(region, { content, opening: false, nativeReveal: false, frame: 0, beforematch, hidden, size })
    content.addEventListener('beforematch', beforematch)
    hidden.observe(content, { attributes: true, attributeFilter: ['hidden'] })
    size.observe(content)
  },
  beforeUpdate(region, { value, oldValue }) {
    if (Boolean(value) === Boolean(oldValue)) return
    const content = contentFor(region)
    const state = states.get(region)
    if (state) state.opening = Boolean(value)
    if (value) {
      if (state?.nativeReveal) {
        state.nativeReveal = false
        state.opening = false
        cancelAnimationFrame(state.frame)
        state.frame = 0
        release(content)
        return
      }
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
    if (state) {
      state.nativeReveal = false
      cancelAnimationFrame(state.frame)
      state.frame = 0
    }
  },
  updated(region, { value, oldValue }) {
    // The content's closed data-state is patched before resuming keyframes.
    if (!value && oldValue) contentFor(region).classList.remove(nativeRevealAnimation)
  },
  unmounted(region) {
    const state = states.get(region)
    if (state) {
      cancelAnimationFrame(state.frame)
      state.content.removeEventListener('beforematch', state.beforematch)
      state.content.classList.remove(nativeRevealAnimation)
    }
    state?.hidden.disconnect()
    state?.size.disconnect()
    states.delete(region)
  },
}
