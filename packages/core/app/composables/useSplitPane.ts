import { toValue, type MaybeRefOrGetter } from 'vue'

/**
 * Axis-agnostic drag state for a resizable split, with cookie persistence.
 *
 * Owns ONE numeric value (a rail width in px, a split ratio 0..1, …) plus the
 * pointer-drag / keyboard bookkeeping to change it. It is deliberately unit- and
 * axis-agnostic: the caller maps a pointer delta to the value via `startDrag`'s
 * `scale`/`invert`, so the same composable drives both the horizontal rail and
 * the vertical Request/Response split.
 *
 * Persistence mirrors `useCodeWrap`: an SSR-safe `useCookie` seeds a shared
 * `useState`, and the cookie follows subsequent changes (no localStorage).
 *
 * NOTE: intentionally NOT named `useResizable` — Nuxt UI already ships an
 * auto-imported `useResizable` (horizontal, %-based, for the dashboard sidebar).
 * Reusing that name would shadow it and mislead readers.
 */
export interface UseSplitPaneOptions {
  /** Cookie + useState key, e.g. 'geist-api-rail-width'. */
  key: string
  /** First-visit seed value. */
  default: number
  /** Lower clamp (reactive allowed). */
  min?: MaybeRefOrGetter<number>
  /** Upper clamp (reactive allowed). */
  max?: MaybeRefOrGetter<number>
}

export interface StartDragOptions {
  /** Which pointer axis drives the value. */
  axis: 'x' | 'y'
  /** Value units per pixel of pointer travel (default 1). */
  scale?: number
  /** Flip the direction (e.g. a rail on the right grows as you drag left). */
  invert?: boolean
}

export function useSplitPane(options: UseSplitPaneOptions) {
  const cookie = useCookie<number | undefined>(options.key)
  // useState is the single source of truth; the cookie only seeds the very
  // first initialization (matches the useCodeWrap pattern).
  const raw = useState<number>(options.key, () =>
    typeof cookie.value === 'number' ? cookie.value : options.default,
  )

  const clampValue = (v: number) => {
    const min = options.min !== undefined ? toValue(options.min) : Number.NEGATIVE_INFINITY
    const max = options.max !== undefined ? toValue(options.max) : Number.POSITIVE_INFINITY
    return Math.min(Math.max(v, min), Math.max(min, max))
  }

  // Public, always-clamped value. Writing through the setter re-clamps so
  // callers can safely assign ±Infinity to jump to a bound.
  const value = computed<number>({
    get: () => clampValue(raw.value),
    set: (v) => {
      raw.value = clampValue(v)
    },
  })

  // Re-clamp when reactive min/max change (e.g. container resize shrinks max).
  watchEffect(() => {
    const c = clampValue(raw.value)
    if (c !== raw.value) raw.value = c
  })

  watch(raw, (v) => {
    cookie.value = v
  })

  /* ---------------------------------------------------------------- *
   * Pointer drag — window listeners (no pointer capture needed; global
   * listeners already catch moves outside the handle), rAF-throttled.
   * ---------------------------------------------------------------- */
  const dragging = ref(false)
  let startPos = 0
  let startVal = 0
  let scale = 1
  let sign = 1
  let axis: 'x' | 'y' = 'x'
  let pending: number | null = null
  let raf = 0

  function apply() {
    raf = 0
    if (pending == null) return
    value.value = startVal + (pending - startPos) * scale * sign
  }

  function onMove(e: PointerEvent) {
    pending = axis === 'x' ? e.clientX : e.clientY
    if (!raf) raf = requestAnimationFrame(apply)
  }

  function onKey(e: KeyboardEvent) {
    // Escape cancels the drag, restoring the pre-drag value.
    if (e.key === 'Escape') {
      value.value = startVal
      stop()
    }
  }

  function startDrag(e: PointerEvent, opts: StartDragOptions) {
    axis = opts.axis
    sign = opts.invert ? -1 : 1
    scale = opts.scale ?? 1
    startPos = axis === 'x' ? e.clientX : e.clientY
    startVal = raw.value
    dragging.value = true

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('keydown', onKey)
    // Lock selection + show the resize cursor globally while dragging.
    document.body.style.userSelect = 'none'
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
    e.preventDefault()
  }

  function stop() {
    if (!dragging.value) return
    dragging.value = false
    if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
    pending = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
    window.removeEventListener('keydown', onKey)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  /** Keyboard nudge by `step` value-units in `dir` (-1 | 1). */
  function nudge(dir: number, step: number) {
    value.value = raw.value + dir * step
  }

  /** Reset to the seed value. */
  function reset() {
    value.value = options.default
  }

  onScopeDispose(stop)

  return { value, dragging, startDrag, nudge, reset }
}

/**
 * Content-priority split with reallocation.
 *
 * Given a fixed total height `H` (already minus the handle) and the two panes'
 * natural (uncapped) heights, returns the height budget for each pane:
 *
 * - Baseline split is `ratio : 1 - ratio` of `H`, each floored at `minPane`.
 * - If one pane's content needs LESS than its share, it is capped at its
 *   natural height and the surplus is handed to the overflowing sibling — so a
 *   short snippet never stretches into a large empty box, and the long one gets
 *   all the room it can use.
 *
 * The caller only invokes this in the overflow regime (H < natTop + natBottom);
 * when everything fits, panes render at natural height and this isn't used.
 */
export function computeSplitBudgets(
  H: number,
  natTop: number,
  natBottom: number,
  ratio: number,
  minPane: number,
): { top: number, bottom: number } {
  if (H <= 0) return { top: 0, bottom: 0 }
  const min = Math.min(minPane, Math.floor(H / 2))

  let top = Math.max(min, Math.min(Math.round(ratio * H), H - min))
  let bottom = H - top

  if (natTop < top) {
    // Top fits with room to spare → give the surplus to bottom.
    top = Math.max(min, Math.round(natTop))
    bottom = H - top
  }
  else if (natBottom < bottom) {
    // Bottom fits with room to spare → give the surplus to top.
    bottom = Math.max(min, Math.round(natBottom))
    top = H - bottom
  }

  return { top, bottom }
}
