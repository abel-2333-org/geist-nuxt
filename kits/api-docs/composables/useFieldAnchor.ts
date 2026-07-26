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
// Reference-counted, because two anchor scopes can legitimately overlap during
// a page transition: the outgoing route is still mounted while the incoming one
// already claimed manual restoration. A single-owner flag would let whichever
// scope disposes FIRST hand control back to the browser, and the still-live
// deep link would then be yanked to the restored offset. Native restoration is
// only handed back once the last claimant is gone.
const scrollRestorationClaims = new Set<symbol>()
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

/**
 * Copying a link only ever touches the clipboard, so the only options are the
 * caller-owned toast messages. There is deliberately no `navigate` escape
 * hatch: copy and navigate are separate intents, and a caller that wants both
 * composes `goTo()` with `copyLink()` explicitly.
 */
export type FieldAnchorCopyOptions = FieldAnchorCopyMessages

type NavigationResult = 'landed' | 'missing' | 'aborted'

export function useFieldAnchor() {
  const owner = Symbol('field-anchor')
  const active = useActiveFieldPath()
  const revision = useFieldAnchorRevision()
  // `copied` is surfaced so an anchor button can mirror the same transient
  // copied → check feedback the shared CopyButton gives elsewhere. Each
  // useFieldAnchor() call owns its own useCopy instance, so this state is
  // naturally scoped to the row that triggered the copy.
  const { copy, copied } = useCopy()

  onScopeDispose(() => {
    // Only the restoration claim is tied to initFromHash — that is the sole
    // path that claims it. Ownership and the highlight, however, are created by
    // navigation alone, so consumers that never call initFromHash
    // (FieldAnnotation, SchemaComposition) still need their in-flight
    // navigation invalidated and their cue cancelled here; gating this cleanup
    // on hash initialization would leak a stale token and leave an animation
    // running past unmount.
    releaseScrollRestoration()
    if (navigationOwner === owner) {
      navigationOwner = undefined
      navigationToken++
      stopHighlight(owner)
    }
  })

  function claimScrollRestoration() {
    if (!('scrollRestoration' in history)) return
    if (scrollRestorationClaims.size === 0) {
      previousScrollRestoration = history.scrollRestoration
      history.scrollRestoration = 'manual'
    }
    scrollRestorationClaims.add(owner)
  }

  function releaseScrollRestoration() {
    // `delete` returning false means this scope never claimed, so it must not
    // release on someone else's behalf.
    if (!scrollRestorationClaims.delete(owner)) return
    if (scrollRestorationClaims.size > 0) return
    if (history.scrollRestoration === 'manual' && previousScrollRestoration) {
      history.scrollRestoration = previousScrollRestoration
    }
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
   * briefly share an id; `waitForElement` deliberately selects the incoming,
   * later-in-document match.
   */
  async function navigate(
    path: string,
    opts: { updateHash?: boolean, focus?: boolean } = {},
  ): Promise<NavigationResult> {
    // An empty path has no target, and `'#' + CSS.escape('')` is `'#'` — an
    // invalid selector that makes querySelectorAll throw. Bail out BEFORE
    // touching shared state or the URL: `goTo` is public API, so a consumer
    // outside this repo can reach here, and a half-applied navigation would
    // clear the active row and rewrite the hash to a bare '#' on the way out.
    // Clearing the active field is initFromHash's job (its empty-hash branch),
    // not a side effect of a malformed jump request.
    if (!path) return 'missing'
    active.value = path
    revision.value++
    if (opts.updateHash !== false && import.meta.client) {
      history.replaceState(history.state, '', `#${path}`)
    }

    if (!import.meta.client) return 'aborted'
    const token = ++navigationToken
    navigationOwner = owner
    stopHighlight()
    await nextTick()

    // The row may not exist yet: hash arrival can precede an async field tree
    // (data still loading on a fresh navigation). Poll for the element within
    // a bounded window instead of failing on the first miss; the token drops
    // this positioning if a newer navigation started meanwhile.
    const el = await waitForElement(path, token)
    if (token !== navigationToken) return 'aborted'
    if (!el) return 'missing'

    // Ancestor collapsibles animate open after `active` changes, and the browser
    // may also try a native scroll to the hash. Both shift layout, so scrolling
    // on a fixed delay is racy. Wait until the target position and the page's
    // scroll extent are both stable, then do a single scroll + flash.
    await waitForElementStable(el)
    if (token !== navigationToken) return 'aborted'

    // Instant, deliberately. Smooth travel was tried and rejected: it cannot be
    // applied consistently, because native `<a href="#…">` anchors bypass JS and
    // the only thing that reaches them — a global CSS `scroll-behavior: smooth`
    // on the root scroller — also overrides a script's explicit
    // `behavior: 'auto'`, so arrivals (this deep-link path included) could no
    // longer opt out and would slide down from the top.
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
    // Arrival cue: the row BREATHES (see BREATHS below) — a primary ring plus a faint
    // wash fade in and out, repeated, in one continuous pass. A slow alternation
    // (rather than a fast blink) draws the eye to a row that may already be on
    // screen without strobing. This is a SINGLE keyframe sequence, so the
    // alternation comes from the alternating off/on offsets themselves; there is
    // no `iterations` replay and therefore no hard jump at an iteration
    // boundary. `ease-in-out` makes every rise and fall symmetric, and both ends
    // rest on the transparent frame so the cue arrives and departs softly.
    //
    // The ring is a `boxShadow`, NOT an outline: outline belongs exclusively to
    // the persistent focus ring. Animating outline here would override that ring
    // for the whole cue and, because the cue passes through transparent, would
    // make a keyboard user's focus indicator blink out entirely (WCAG 2.4.7).
    // box-shadow also follows the row's own border-radius, so no inline radius
    // is needed. Runs without `fill`, so every property reverts to its CSS state
    // when the cue ends. Respects reduced-motion.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced && typeof el.animate === 'function') {
      const on = (offset: number) => ({
        offset,
        boxShadow: '0 0 0 1px var(--ui-primary)',
        backgroundColor: 'color-mix(in oklch, var(--ui-primary) 10%, transparent)',
      })
      const off = (offset: number) => ({
        offset,
        boxShadow: '0 0 0 1px transparent',
        backgroundColor: 'transparent',
      })
      // BREATHS breaths of BREATH_MS each. Offsets are derived rather than
      // written out, so retuning either constant keeps every breath an equal
      // slice peaking at its own midpoint (symmetric rise and fall).
      const BREATHS = 3
      const BREATH_MS = 1400
      const frames = [off(0)]
      for (let i = 0; i < BREATHS; i++) {
        frames.push(on((i + 0.5) / BREATHS), off((i + 1) / BREATHS))
      }
      const animation = el.animate(
        frames,
        { duration: BREATHS * BREATH_MS, easing: 'ease-in-out' },
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
    return 'landed'
  }

  async function goTo(path: string, opts: { updateHash?: boolean, focus?: boolean } = {}) {
    await navigate(path, opts)
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

  /**
   * Copy a field's deep link — clipboard only. It deliberately does NOT
   * navigate: it leaves scroll position, the URL hash and the active row
   * untouched, so grabbing a link to share never yanks the reader somewhere
   * else. The copied URL still carries `#path`, so pasting it deep-links as
   * expected. Complete success/failure messages remain caller-owned.
   */
  async function copyLink(
    path: string,
    options: FieldAnchorCopyOptions = {},
  ) {
    try {
      await copy(urlFor(path), {
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
    let hashNavigation = 0
    const apply = async (path: string) => {
      const run = ++hashNavigation
      if (path) {
        claimScrollRestoration()
        const result = await navigate(path, { updateHash: false, focus: true })
        // A missing/stale fragment must not leave browser restoration disabled.
        // An aborted navigation is different: its successor still needs the
        // existing claim. The generation guard prevents an older confirmed miss
        // from releasing a claim now owned by a newer hash navigation.
        if (result === 'missing' && run === hashNavigation) releaseScrollRestoration()
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
      void apply(decodeURIComponent(rawPath))
    }
    catch {
      // A malformed raw escape must not abort anchor initialization. Leaving
      // it encoded simply means no field row matches the invalid fragment.
      void apply(rawPath)
    }
    const route = useRoute()
    watch(() => route.fullPath, () => {
      // Vue Router exposes a normalized, already-decoded hash. Decoding it a
      // second time would throw for valid literal-percent paths such as `%`.
      void apply(route.hash.replace(/^#/, ''))
    })
  }

  return { active, revision, copied, goTo, copyLink, urlFor, initFromHash, SCROLL_MARGIN_CLASS }
}
