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

/** Height of the sticky header, so scrolled-to rows clear it (see scroll-mt). */
const SCROLL_MARGIN_CLASS = 'scroll-mt-24'

// Client-global navigation token: each goTo invalidates the previous one, so
// a stale in-flight positioning (e.g. waiting for an async field tree that
// mounted late) can never scroll/flash after the user already moved on.
let navigationToken = 0

export interface FieldAnchorCopyMessages {
  successMessage?: string
  failureMessage?: string
}

export function useFieldAnchor() {
  const active = useActiveFieldPath()
  // `copied` is surfaced so an anchor button can mirror the same transient
  // copied → check feedback the shared CopyButton gives elsewhere. Each
  // useFieldAnchor() call owns its own useCopy instance, so this state is
  // naturally scoped to the row that triggered the copy.
  const { copy, copied } = useCopy()

  /** Full shareable URL for a field path. */
  function urlFor(path: string) {
    if (!import.meta.client) return `#${path}`
    return `${location.origin}${location.pathname}#${path}`
  }

  /**
   * Focus a field: mark it active (which expands ancestors reactively), then
   * wait a tick + the collapsible open transition before scrolling and
   * flashing it. `getElementById` avoids any need to escape the id for a
   * CSS/querySelector selector.
   */
  async function goTo(path: string, opts: { updateHash?: boolean, focus?: boolean } = {}) {
    active.value = path
    if (opts.updateHash !== false && import.meta.client) {
      history.replaceState(history.state, '', `#${path}`)
    }

    if (!import.meta.client) return
    const token = ++navigationToken
    await nextTick()

    // The row may not exist yet: hash arrival can precede an async field tree
    // (data still loading on a fresh navigation). Poll for the element within
    // a bounded window instead of failing on the first miss; the token drops
    // this positioning if a newer navigation started meanwhile.
    const el = await waitForElement(path, token)
    if (!el || token !== navigationToken) return

    // Ancestor collapsibles animate open after `active` changes, and the browser
    // may also try a native scroll to the hash. Both shift layout, so scrolling
    // on a fixed delay is racy. Instead wait until the element's layout is stable
    // across two frames (expansion settled), then do a single scroll + flash.
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
    // Brief highlight so the eye lands on the right row. Uses the Web Animations
    // API (no persistent class to clean up) and respects reduced-motion.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced && typeof el.animate === 'function') {
      el.animate(
        [
          { backgroundColor: 'color-mix(in oklch, var(--ui-primary) 10%, transparent)' },
          { backgroundColor: 'transparent' },
        ],
        { duration: 1600, easing: 'ease-out' },
      )
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
        const el = document.getElementById(id)
        if (el) return resolve(el)
        if (performance.now() - start > maxMs) return resolve(null)
        requestAnimationFrame(tick)
      }
      tick()
    })
  }

  /**
   * Resolve once the target element's own layout has settled: it must be
   * visible (non-zero height — i.e. ancestor collapsibles have opened) and hold
   * a stable top for two consecutive frames, so the expand transition is done
   * before we scroll. Tracking the element itself (not just page height) avoids
   * scrolling to a pre-expansion position while the animation hasn't started.
   * Capped so we never wait indefinitely.
   */
  function waitForElementStable(el: HTMLElement, maxMs = 900): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now()
      let lastTop = Number.NaN
      let stableFrames = 0
      const tick = () => {
        const rect = el.getBoundingClientRect()
        const settled = rect.height > 0 && rect.top === lastTop
        stableFrames = settled ? stableFrames + 1 : 0
        lastTop = rect.top
        if (stableFrames >= 2 || performance.now() - start > maxMs) resolve()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }

  /** Copy a field's deep link and focus it. Complete success/failure messages
   *  keep localization owned by the caller; foundation only supplies generic
   *  English defaults. A success-message string remains accepted for callers
   *  copied from the previous API. Navigation still runs when clipboard
   *  permission fails. */
  async function copyLink(
    path: string,
    messagesOrSuccess: FieldAnchorCopyMessages | string = {},
  ) {
    const messages: FieldAnchorCopyMessages = typeof messagesOrSuccess === 'string'
      ? { successMessage: messagesOrSuccess }
      : messagesOrSuccess
    // Fire-and-forget: navigation/scroll runs independently of the clipboard
    // write below; we don't want to block the copy on the scroll animation.
    void goTo(path, { updateHash: true })
    try {
      await copy(urlFor(path), {
        label: 'Link',
        successMessage: messages.successMessage,
        failureMessage: messages.failureMessage,
      })
    }
    catch {
      // Clipboard unavailable/denied — the hash is still updated so the user
      // can copy from the address bar.
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
    const apply = (raw: string) => {
      const path = decodeURIComponent(raw.replace(/^#/, ''))
      if (path) {
        void goTo(path, { updateHash: false, focus: true })
      }
      else {
        navigationToken++
        active.value = ''
      }
    }
    apply(location.hash)
    const route = useRoute()
    watch(() => route.fullPath, () => {
      apply(route.hash)
    })
  }

  return { active, copied, goTo, copyLink, urlFor, initFromHash, SCROLL_MARGIN_CLASS }
}
