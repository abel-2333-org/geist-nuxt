<script setup lang="ts">
// `geistMinWidthQuery` (value) and `GeistBreakpoint` (type) live in the
// foundation breakpoints utility and are exposed through Nuxt auto-import.
// The registry installs it in the consumer's standard app/utils root
// (`foundation-breakpoints` slice) — same pattern as lifecycle-preset.

// Domain component (API docs): the vertical dual-example code rail — a top
// pane and a bottom pane split by a draggable horizontal handle, with the
// "content-priority reallocation" the design system deliberately keeps OUT of
// the generic <SplitPane>. It belongs to this KIT (not foundation) because it
// is coupled to the internal DOM of this kit's code cards (`.code-surface`,
// `pre.raw-pre`) to measure natural heights — that coupling is a kit-internal
// affair, invisible to foundation.
//
// Data-agnostic: it owns split math only. Content comes through the #top /
// #bottom slots, and the computed per-pane height budget is handed back via
// slot scope (`maxHeight`) so the page can wire it onto the code cards
// (ApiDocsRequestExample / ApiDocsResponseExample both accept `max-height`).
//
// Anatomy:  #top pane · <SplitPaneHandle horizontal> · #bottom pane
// States:   below `enabledFrom` (default `lg`) → stacked, no handle, each card
//           self-scrolls (24rem).
//           fit (natTop + natBottom ≤ H) → both natural, handle inert.
//           overflow → total capped to H, budgets reallocated, handle active.
// A11y:     handle carries role=separator + aria-value* + keyboard (via
//           SplitPaneHandle); NOT rendered in the stacked state, disabled in
//           the fit state. aria values reflect the EFFECTIVE separator
//           position (post-reallocation), not the raw persisted ratio.

const props = withDefaults(defineProps<{
  /** Enable the rail from this breakpoint up; keep in sync with the gate of
   *  the surrounding horizontal <SplitPane> so the rail never claims a sticky
   *  viewport-height strip while the outer pane is still stacked. */
  enabledFrom?: GeistBreakpoint
  /** Persistence key for the split ratio. Defaults to a per-instance
   *  `useId()` key so two unnamed rails never fight over one stored ratio;
   *  pass an explicit key when the ratio should survive reloads. */
  storageKey?: string
}>(), {
  enabledFrom: 'lg',
})

// Per-instance fallback: useId() is SSR-stable within a render, so hydration
// agrees, but it is NOT stable across reloads — persistence across visits
// requires an explicit `storageKey` from the caller.
const storageKey = props.storageKey ?? `geist-api-rail-split-${useId()}`

const HANDLE_PX = 12 // the handle's cross size (h-3)
const MIN_PANE = 120 // never starve a pane below this in overflow mode
const RATIO_MIN = 0.2 // useSplitPane clamp — also drives the aria bounds
const RATIO_MAX = 0.8

/**
 * Content-priority reallocation (pure). Given the fixed total height H (already
 * minus the handle) and both panes' natural, uncapped heights, return each
 * pane's height budget. ONLY called in the overflow branch (H < natTop +
 * natBottom); when both fit we render at natural height and never call it.
 * - Baseline splits H by ratio : 1-ratio, each pane no less than `minPane`.
 * - If a pane underuses its share → cap it to its natural height and give the
 *   slack to the overflowing pane, so a short snippet never leaves a void.
 */
function computeSplitBudgets(
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
    top = Math.max(min, Math.round(natTop))
    bottom = H - top
  }
  else if (natBottom < bottom) {
    bottom = Math.max(min, Math.round(natBottom))
    top = H - bottom
  }
  return { top, bottom }
}

/* --- breakpoint gate (manual matchMedia, SSR-safe) -------------------- *
 * Starts false so SSR + first client render agree (stacked), then flips on the
 * client after mount — mirrors <SplitPane>. */
const enabled = ref(false)
let mql: MediaQueryList | undefined
function onBp(e: MediaQueryListEvent | MediaQueryList) {
  enabled.value = e.matches
}

/* --- ratio state (top pane's fraction of H) --------------------------- */
const { value: ratio, dragging, startDrag, nudge, reset } = useSplitPane({
  key: storageKey,
  default: 0.5,
  min: RATIO_MIN,
  max: RATIO_MAX,
})

/* --- measured layout (written in rAF, never synchronously in the RO) --- *
 * Deferring the reactive write to the next frame breaks the "write height →
 * same-frame re-observe" loop that otherwise throws "ResizeObserver loop
 * completed with undelivered notifications" (see SplitPane for the same note). */
const railRef = ref<HTMLElement>()
const topRef = ref<HTMLElement>()
const botRef = ref<HTMLElement>()

const H = ref(0)
const natTop = ref(0)
const natBottom = ref(0)

// Natural (uncapped) height of a pane: total chrome + the FULL <pre> height.
// The scroll surface caps its own box, but the inner <pre> still lays out at
// full content height, so (section - surface + pre) is what the pane WOULD be
// with no cap. Falls back to the raw wrapper height (empty state / no code).
function paneNatural(wrap: HTMLElement | undefined): number {
  if (!wrap) return 0
  const section = wrap.querySelector('section') as HTMLElement | null
  const surface = wrap.querySelector('.code-surface') as HTMLElement | null
  const pre = wrap.querySelector('pre.raw-pre') as HTMLElement | null
  if (!section || !surface || !pre) return wrap.offsetHeight
  return section.offsetHeight - surface.offsetHeight + pre.offsetHeight
}

// Fixed chrome (toolbar + borders) of a pane = pane total minus scroll surface.
// Used to translate a whole-pane budget into the code surface's max-height.
function paneChrome(wrap: HTMLElement | undefined): number {
  if (!wrap) return 0
  const section = wrap.querySelector('section') as HTMLElement | null
  const surface = wrap.querySelector('.code-surface') as HTMLElement | null
  if (!section || !surface) return 0
  return section.offsetHeight - surface.offsetHeight
}

const chromeTop = ref(0)
const chromeBottom = ref(0)

let ro: ResizeObserver | undefined
let raf = 0
function scheduleMeasure() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(measure)
}
function measure() {
  raf = 0
  const rail = railRef.value
  if (!rail) return
  H.value = Math.max(0, Math.round(rail.getBoundingClientRect().height) - HANDLE_PX)
  natTop.value = Math.round(paneNatural(topRef.value))
  natBottom.value = Math.round(paneNatural(botRef.value))
  chromeTop.value = Math.round(paneChrome(topRef.value))
  chromeBottom.value = Math.round(paneChrome(botRef.value))
}

// (Re)observe the rail, both pane wrappers, and the two <pre> nodes — the pres
// are what grow when the user switches language/scenario (their content changes
// while the wrapper height is pinned in overflow mode).
function syncTargets() {
  if (!ro) return
  ro.disconnect()
  for (const el of [railRef.value, topRef.value, botRef.value]) {
    if (el) ro.observe(el)
  }
  for (const wrap of [topRef.value, botRef.value]) {
    const pre = wrap?.querySelector('pre.raw-pre')
    if (pre) ro.observe(pre)
  }
}

onMounted(() => {
  mql = window.matchMedia(geistMinWidthQuery(props.enabledFrom))
  enabled.value = mql.matches
  mql.addEventListener('change', onBp)

  ro = new ResizeObserver(scheduleMeasure)
  nextTick(() => {
    syncTargets()
    measure()
  })
})
onBeforeUnmount(() => {
  mql?.removeEventListener('change', onBp)
  cancelAnimationFrame(raf)
  ro?.disconnect()
})

/* --- derived layout --------------------------------------------------- */
const overflow = computed(
  () => enabled.value && H.value > 0 && natTop.value + natBottom.value > H.value,
)

const budgets = computed(() =>
  overflow.value
    ? computeSplitBudgets(H.value, natTop.value, natBottom.value, ratio.value, MIN_PANE)
    : { top: 0, bottom: 0 },
)

// Styles are ALWAYS objects (empty-object placeholder, never undefined) so
// hydration doesn't skip an undefined→object transition and silently drop the
// height (see the kit docs' caveat).
const topStyle = computed(() =>
  overflow.value ? { height: `${budgets.value.top}px`, overflow: 'hidden' } : {},
)
const botStyle = computed(() =>
  overflow.value ? { height: `${budgets.value.bottom}px`, overflow: 'hidden' } : {},
)

// Height budget handed to each code card via slot scope. Stacked → the card's
// own 24rem scroll; fit → uncapped (it already fits); overflow → the surface
// budget = pane budget minus fixed chrome.
const topMaxHeight = computed(() => {
  if (!enabled.value) return '24rem'
  if (!overflow.value) return 'none'
  return `${Math.max(60, budgets.value.top - chromeTop.value)}px`
})
const botMaxHeight = computed(() => {
  if (!enabled.value) return '24rem'
  if (!overflow.value) return 'none'
  return `${Math.max(60, budgets.value.bottom - chromeBottom.value)}px`
})

// The persisted ratio and the REAL separator position can diverge: content-
// priority reallocation caps a short pane to its natural height, so a stored
// 50% may effectively sit at 30%. Everything user-facing (aria values) and
// every interaction start must therefore be derived from the effective
// budgets, not the stored ratio.
const effectiveRatio = computed(() =>
  overflow.value && H.value > 0 ? budgets.value.top / H.value : ratio.value,
)

// The REAL reachable bounds of the separator: run the same reallocation with
// the ratio pinned to its clamp ends (0.2 / 0.8). This accounts for BOTH the
// useSplitPane clamp and natural-height capping — e.g. with a short top pane
// the true max may be 25%, not 80% and certainly not `H - MIN_PANE`.
const effectiveBounds = computed(() => {
  if (!overflow.value || H.value <= 0) return { min: RATIO_MIN, max: RATIO_MAX }
  const lo = computeSplitBudgets(H.value, natTop.value, natBottom.value, RATIO_MIN, MIN_PANE)
  const hi = computeSplitBudgets(H.value, natTop.value, natBottom.value, RATIO_MAX, MIN_PANE)
  return { min: lo.top / H.value, max: hi.top / H.value }
})

/* --- handle wiring (ratio: dragging down grows the top pane) ---------- */
const handleDisabled = computed(
  () => !overflow.value || effectiveBounds.value.min >= effectiveBounds.value.max,
)

// Re-anchor the stored ratio onto the real separator position before a drag
// or keyboard nudge, so the interaction moves FROM where the handle visibly
// is (no dead keypresses while the stored ratio catches up to the cap).
function alignRatio() {
  if (overflow.value && H.value > 0) ratio.value = budgets.value.top / H.value
}

function onDragStart(e: PointerEvent) {
  if (H.value > 0) {
    alignRatio()
    startDrag(e, { axis: 'y', scale: 1 / H.value })
  }
}
function onStep(dir: number) {
  alignRatio()
  nudge(dir, 0.04)
}
function onJump(to: 'min' | 'max' | 'reset') {
  if (to === 'reset') reset()
  else ratio.value = to === 'min' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
}

const ariaNow = computed(() => Math.round(effectiveRatio.value * 100))
const ariaMin = computed(() => Math.round(effectiveBounds.value.min * 100))
const ariaMax = computed(() => Math.round(effectiveBounds.value.max * 100))
</script>

<template>
  <div ref="railRef" class="flex min-h-0 flex-col">
    <div ref="topRef" class="min-h-0" :style="topStyle">
      <slot name="top" :max-height="topMaxHeight" />
    </div>

    <!-- Below the breakpoint gate the rail is stacked ("stacked, no handle"):
         rendering even a disabled handle would keep its h-3 box in the flow
         and inflate the stacked card gap, so the handle only exists when the
         rail is enabled (fit state keeps it as a disabled spacer). -->
    <SplitPaneHandle
      v-if="enabled"
      orientation="horizontal"
      :active="dragging"
      :disabled="handleDisabled"
      :aria-value-now="ariaNow"
      :aria-value-min="ariaMin"
      :aria-value-max="ariaMax"
      aria-label="Resize request and response panels"
      @dragstart="onDragStart"
      @step="onStep"
      @jump="onJump"
    />

    <div ref="botRef" class="min-h-0" :style="botStyle">
      <slot name="bottom" :max-height="botMaxHeight" />
    </div>
  </div>
</template>
