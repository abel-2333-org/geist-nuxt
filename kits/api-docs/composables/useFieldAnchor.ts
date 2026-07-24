/**
 * Deep-linking for reference fields (API docs kit).
 *
 * A single shared piece of state — the "active field path" — drives three
 * things at once, so every field row can stay self-governing:
 *  - a row highlights itself when its own path is active;
 *  - a row auto-expands when the active path is one of its descendants
 *    (prefix match), so deep links into collapsed subfields reveal themselves;
 *  - navigation (from a click or an incoming URL hash) sets the active path,
 *    waits for ancestor collapsibles to open, then scrolls + flashes the row.
 *
 * Self-contained: `useState`/`nextTick`/etc. are Nuxt auto-imports; `useCopy`
 * is provided by the foundation copy utility through Nuxt auto-import. No router
 * configuration is required for correctness — an optional `router.options.ts`
 * hash tweak only removes a one-time cold-load scroll flash (see kit docs).
 */

// Shared across all field rows for the current page.
export function useActiveFieldPath() {
  return useState<string>('reference-active-field', () => '')
}

// A path is state, but navigating is an event: choosing the same deep link
// again must still ask collapsed ancestors to reveal the target. Consumers
// watch this revision alongside the path so repeated goTo(path) calls are not
// collapsed by Vue's same-value ref semantics.
export function useFieldAnchorRevision() {
  return useState<number>('reference-active-field-revision', () => 0)
}

/** Height of the sticky header, so scrolled-to rows clear it (see scroll-mt). */
const SCROLL_MARGIN_CLASS = 'scroll-mt-24'

// Client-global navigation token: each goTo invalidates the previous one, so
// a stale in-flight positioning (e.g. waiting for an async field tree that
// mounted late) can never scroll/flash after the user already moved on.
let navigationToken = 0
let navigationOwner: symbol | undefined
let highlightAnimation: Animation | undefined
let highlightOwner: symbol | undefined
let scrollRestorationOwner: symbol | undefined
let previousScrollRestoration: ScrollRestoration | undefined

function stopHighlight(owner?: symbol) {
  if (owner && highlightOwner !== owner) return
  const animation = highlightAnimation
  highlightAnimation = undefined
  highlightOwner = undefined
  animation?.cancel()
}

export interface FieldAnchorCopyMessages {
  successMessage?: string
  failureMessage?: string
}

export interface FieldAnchorCopyOptions extends FieldAnchorCopyMessages {
  /** Preserve the legacy navigate-on-copy behavior unless a caller opts out. */
  navigate?: boolean
}

export function useFieldAnchor() {
  const owner = Symbol('field-anchor')
  const active = useActiveFieldPath()
  const revision = useFieldAnchorRevision()
  // `copied` is surfaced so an anchor button can mirror the same transient
  // copied → check feedback the shared CopyButton gives elsewhere. Each
  // useFieldAnchor() call owns its own useCopy instance, so this state is
  // naturally scoped to the row that triggered the copy.
  const { copy, copied } = useCopy()
  let hashInitialized = false

  onScopeDispose(() => {
    if (!hashInitialized) return
    releaseScrollRestoration()
    if (navigationOwner === owner) {
      navigationOwner = undefined
      navigationToken++
      stopHighlight(owner)
    }
  })

  function claimScrollRestoration() {
    if (!('scrollRestoration' in history)) return
    if (!scrollRestorationOwner) {
      previousScrollRestoration = history.scrollRestoration
      history.scrollRestoration = 'manual'
    }
    scrollRestorationOwner = owner
  }

  function releaseScrollRestoration() {
    if (scrollRestorationOwner !== owner) return
    if (history.scrollRestoration === 'manual' && previousScrollRestoration) {
      history.scrollRestoration = previousScrollRestoration
    }
    scrollRestorationOwner = undefined
    previousScrollRestoration = undefined
  }

  /** Full shareable URL for a field path. */
  function urlFor(path: string) {
    if (!import.meta.client) return `#${path}`
    return `${location.origin}${location.pathname}${location.search}#${path}`
  }

  /**
   * Focus a field: mark it active (which expands ancestors reactively), then
   * wait a tick + the collapsible open transition before scrolling and
   * flashing it. During a page transition, outgoing and incoming trees can
   * briefly share an id; `findElement` deliberately selects the incoming,
   * later-in-document match.
   */
  async function goTo(path: string, opts: { updateHash?: boolean, focus?: boolean } = {}) {
    active.value = path
    revision.value++
    if (opts.updateHash !== false && import.meta.client) {
      history.replaceState(history.state, '', `#${path}`)
    }

    if (!import.meta.client) return
    const token = ++navigationToken
    navigationOwner = owner
    stopHighlight()
    await nextTick()

    // The row may not exist yet: hash arrival can precede an async field tree
    // (data still loading on a fresh navigation). Poll for the element within
    // a bounded window instead of failing on the first miss; the token drops
    // this positioning if a newer navigation started meanwhile.
    const el = await waitForElement(path, token)
    if (!el || token !== navigationToken) return

    // Ancestor collapsibles animate open after `active` changes, and the browser
    // may also try a native scroll to the hash. Both shift layout, so scrolling
    // on a fixed delay is racy. Wait until the target position and the page's
    // scroll extent are both stable, then do a single scroll + flash.
    await waitForElementStable(el)
    if (token !== navigationToken) return

    el.scrollIntoView({ block: 'start' })
    // Content above the target (images, code blocks) can still reflow after the
    // first scroll, nudging the row off its scroll-margin anchor. Re-run the
    // scroll on the next frame so we settle on the final, correct position.
    // Re-check inside the callback: a newer navigation (or unmount) can happen
    // before this frame fires, and a stale target must not drag scroll back.
    requestAnimationFrame(() => {
      if (token !== navigationToken || !el.isConnected) return
      el.scrollIntoView({ block: 'start' })
    })
    // Optionally move keyboard focus to the row (deep links, annotation jumps)
    // so Tab continues from the target instead of wherever the journey began.
    // `preventScroll` keeps the settled scroll position authoritative.
    if (opts.focus) {
      if (!el.hasAttribute('tabindex')) el.tabIndex = -1
      el.focus({ preventScroll: true })
    }
    // Brief arrival cue. Keep outline exclusively for the persistent focus ring;
    // the transient cue only fades a token-based background.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced && typeof el.animate === 'function') {
      const animation = el.animate(
        [
          { backgroundColor: 'color-mix(in oklch, var(--ui-primary) 12%, transparent)' },
          { backgroundColor: 'transparent' },
        ],
        { duration: 300, easing: 'ease-out' },
      )
      highlightAnimation = animation
      highlightOwner = owner
      const clear = () => {
        if (highlightAnimation !== animation) return
        highlightAnimation = undefined
        highlightOwner = undefined
      }
      animation.addEventListener('finish', clear, { once: true })
      animation.addEventListener('cancel', clear, { once: true })
    }
  }

  /**
   * Resolve the target row's element, retrying per frame within a bounded
   * window so async field trees that mount shortly after the hash arrives are
   * still found. Bails out early (resolves null) when a newer navigation
   * superseded this one, so an orphaned poll never keeps spinning.
   */
  function waitForElement(id: string, token: number, maxMs = 2000): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const start = performance.now()
      const tick = () => {
        if (token !== navigationToken) return resolve(null)
        const matches = document.querySelectorAll<HTMLElement>(`#${CSS.escape(id)}`)
        const el = matches[matches.length - 1]
        if (el) return resolve(el)
        if (performance.now() - start > maxMs) return resolve(null)
        requestAnimationFrame(tick)
      }
      tick()
    })
  }

  /**
   * Resolve once both the target and the page's scroll extent have settled.
   * Tracking the target catches opening ancestors; tracking scrollHeight also
   * catches nested content below it that opens later and increases the maximum
   * scroll position. Both must remain stable for four consecutive frames.
   * Capped so we never wait indefinitely.
   */
  function waitForElementStable(el: HTMLElement, maxMs = 900): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now()
      let lastTop = Number.NaN
      let lastScrollHeight = Number.NaN
      let stableFrames = 0
      const tick = () => {
        const rect = el.getBoundingClientRect()
        const scrollHeight = document.documentElement.scrollHeight
        const settled = rect.height > 0
          && rect.top === lastTop
          && scrollHeight === lastScrollHeight
        stableFrames = settled ? stableFrames + 1 : 0
        lastTop = rect.top
        lastScrollHeight = scrollHeight
        if (stableFrames >= 4 || performance.now() - start > maxMs) resolve()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }

  /** Copy a field's deep link. Existing consumers still navigate by default;
   *  UI surfaces that only need the clipboard can pass `navigate: false`.
   *  Complete success/failure messages remain caller-owned, and the legacy
   *  success-message string is still accepted. */
  async function copyLink(
    path: string,
    optionsOrSuccess: FieldAnchorCopyOptions | string = {},
  ) {
    const options: FieldAnchorCopyOptions = typeof optionsOrSuccess === 'string'
      ? { successMessage: optionsOrSuccess }
      : optionsOrSuccess
    if (options.navigate !== false) {
      // Preserve the public API's original behavior without blocking clipboard.
      void goTo(path, { updateHash: true })
    }
    try {
      await copy(urlFor(path), {
        label: 'Link',
        successMessage: options.successMessage,
        failureMessage: options.failureMessage,
      })
    }
    catch {
      // useCopy owns the localized failure toast.
    }
  }

  /**
   * Honor an incoming `#path` hash by navigating to it, now and on later route
   * changes. Watching `fullPath` covers every reused-instance case where
   * onMounted never re-runs: hash-only changes on the same page, dynamic
   * `[slug]` navigations where the hash text stays identical but the page
   * changed (`/a#amount` → `/b#amount`), and query-only changes
   * (`/docs?v=1#amount` → `/docs?v=2#amount`). An empty hash clears the active
   * field AND invalidates any in-flight goTo still waiting for its target DOM,
   * so a stale positioning can never scroll or focus on the new page.
   * Focus moves to the row so keyboard users continue from the target.
   * Registered inside the caller's lifecycle (setup/onMounted), the watcher
   * is disposed with the page component.
   */
  function initFromHash() {
    if (!import.meta.client) return
    hashInitialized = true
    const apply = (path: string) => {
      if (path) {
        claimScrollRestoration()
        void goTo(path, { updateHash: false, focus: true })
      }
      else {
        releaseScrollRestoration()
        if (navigationOwner === owner) {
          navigationOwner = undefined
          navigationToken++
          stopHighlight(owner)
        }
        active.value = ''
      }
    }
    const rawPath = location.hash.replace(/^#/, '')
    try {
      apply(decodeURIComponent(rawPath))
    }
    catch {
      // A malformed raw escape must not abort anchor initialization. Leaving
      // it encoded simply means no field row matches the invalid fragment.
      apply(rawPath)
    }
    const route = useRoute()
    watch(() => route.fullPath, () => {
      // Vue Router exposes a normalized, already-decoded hash. Decoding it a
      // second time would throw for valid literal-percent paths such as `%`.
      apply(route.hash.replace(/^#/, ''))
    })
  }

  return { active, revision, copied, goTo, copyLink, urlFor, initFromHash, SCROLL_MARGIN_CLASS }
}
