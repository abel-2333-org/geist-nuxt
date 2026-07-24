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

export interface FieldAnchorCopyMessages {
  successMessage?: string
  failureMessage?: string
}

export function useFieldAnchor() {
  const active = useActiveFieldPath()
  const revision = useFieldAnchorRevision()
  // `copied` is surfaced so an anchor button can mirror the same transient
  // copied → check feedback the shared CopyButton gives elsewhere. Each
  // useFieldAnchor() call owns its own useCopy instance, so this state is
  // naturally scoped to the row that triggered the copy.
  const { copy, copied } = useCopy()

  /** Full shareable URL for a field path. */
  function urlFor(path: string) {
    if (!import.meta.client) return `#${path}`
    return `${location.origin}${location.pathname}${location.search}#${path}`
  }

  /**
   * Focus a field: mark it active (which expands ancestors reactively), then
   * wait a tick + the collapsible open transition before scrolling and
   * flashing it. `getElementById` avoids any need to escape the id for a
   * CSS/querySelector selector.
   */
  async function goTo(path: string, opts: { updateHash?: boolean, focus?: boolean } = {}) {
    active.value = path
    revision.value++
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
    // Highlight so the eye lands on the right row: a rounded primary frame plus a
    // faint background wash that BREATHE — the row fades in, fades out, and fades
    // in once more before settling, all in one continuous pass. The gentle
    // fade-in/fade-out (rather than a hard blink) is what draws the eye to a row
    // that may already be on screen without strobing. This is a SINGLE keyframe
    // sequence — the transparent -> visible -> transparent -> visible ->
    // transparent offsets do the alternation themselves, so there is no
    // `iterations` replay and thus no hard jump at an iteration boundary. Every
    // segment is eased (`ease-in-out`), so each rise and fall is smooth, and both
    // ends rest on the transparent frame so the highlight arrives and departs
    // softly. Driven by the Web Animations API with no `fill`, so the outline
    // colors revert to the CSS state when the animation ends. The rounded corners
    // come from an inline `border-radius` set at the system token BEFORE
    // animating (WAAPI silently drops `var()` inside `border-radius` keyframes,
    // so it can't live in the keyframes) and cleared on finish/cancel — the
    // dashed outline follows that radius. `outlineWidth`/`Style`/`Offset` carry no
    // `var()`, so they hold fine across the keyframes while only the colors
    // animate. Respects reduced-motion.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced && typeof el.animate === 'function') {
      const frame = (outlineColor: string, backgroundColor: string, offset: number) => ({
        offset,
        outlineWidth: '1px',
        outlineStyle: 'dashed',
        outlineOffset: '2px',
        outlineColor,
        backgroundColor,
      })
      const on = (offset: number) =>
        frame('var(--ui-primary)', 'color-mix(in oklch, var(--ui-primary) 10%, transparent)', offset)
      const off = (offset: number) => frame('transparent', 'transparent', offset)
      const prevRadius = el.style.borderRadius
      el.style.borderRadius = 'var(--ui-radius)'
      // ~2.6s total for two full breaths: fade in, out, in, out. `ease-in-out`
      // makes each rise and fall symmetric and soft — no snap at either end.
      const anim = el.animate(
        [off(0), on(0.25), off(0.5), on(0.75), off(1)],
        { duration: 2600, easing: 'ease-in-out' },
      )
      const restoreRadius = () => { el.style.borderRadius = prevRadius }
      anim.addEventListener('finish', restoreRadius)
      anim.addEventListener('cancel', restoreRadius)
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

  /** Copy a field's deep link to the clipboard — nothing else. Copying is not
   *  navigating: it neither scrolls, updates the URL hash, nor marks the row
   *  active, so grabbing a link never yanks the reader away from where they
   *  are. The copied URL still carries the `#path`, so pasting it elsewhere
   *  deep-links as expected. Complete success/failure messages keep
   *  localization owned by the caller; foundation only supplies generic English
   *  defaults. A success-message string remains accepted for callers copied
   *  from the previous API. */
  async function copyLink(
    path: string,
    messagesOrSuccess: FieldAnchorCopyMessages | string = {},
  ) {
    const messages: FieldAnchorCopyMessages = typeof messagesOrSuccess === 'string'
      ? { successMessage: messagesOrSuccess }
      : messagesOrSuccess
    try {
      await copy(urlFor(path), {
        label: 'Link',
        successMessage: messages.successMessage,
        failureMessage: messages.failureMessage,
      })
    }
    catch {
      // Clipboard unavailable/denied — useCopy surfaces the failure toast; the
      // reader can still copy the URL from the address bar manually.
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
    const apply = (path: string) => {
      if (path) {
        void goTo(path, { updateHash: false, focus: true })
      }
      else {
        navigationToken++
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
