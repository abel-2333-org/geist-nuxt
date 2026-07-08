<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { toValue } from 'vue'
import { useResizeObserver } from '@vueuse/core'

// Self-contained, declarative two-pane split — the reusable layout primitive on
// top of `useSplitPane` (drag state + persistence) and `<SplitPaneHandle>` (the
// Geist divider). It owns everything mechanical: the breakpoint gate, SSR-safe
// sizing styles, min/max clamping, keyboard + pointer wiring, and cookie
// persistence. Consumers only declare intent through primitive props and drop
// content into the `#start` / `#end` slots.
//
// Deliberately MDC / Nuxt Content friendly: every prop is a string|number|
// boolean literal (no functions, no computed refs passed in) and the slots are
// named `start` / `end`, so the exact same component works in a `.vue` page and
// in a markdown `::split-pane` block once `@nuxt/content` is added.
//
//   ::split-pane{direction="row" mode="fixed" fixed-pane="end" :default-size="460"}
//   #start
//   Left docs / guide prose (markdown)
//   #end
//   Right code rail
//   ::
//
// Scope note: this handles space division + dragging only. The api-docs page's
// "content-priority reallocation" (short snippets never leave a void) stays in
// that page because it is coupled to how the code cards cap + scroll their
// body — it is not a generic layout concern and is intentionally not folded in.

type Direction = 'row' | 'column'
type Mode = 'fixed' | 'ratio'
type Pane = 'start' | 'end'
type Breakpoint = 'always' | 'sm' | 'md' | 'lg' | 'xl'

const props = withDefaults(
  defineProps<{
    /** Pane arrangement: `row` = side-by-side (vertical divider), `column` =
     *  stacked (horizontal divider). Mirrors flex-direction. */
    direction?: Direction
    /** `fixed` = one pane holds a fixed px size (draggable), the other flexes.
     *  `ratio` = both panes share space proportionally (0..1 split point). */
    mode?: Mode
    /** Cookie + useState key for persistence. Pass a stable string to persist
     *  the split across reloads/instances. Omit it and a per-instance key is
     *  generated with `useId()` — still persisted, but scoped to this
     *  component position (not shared), which resets if the tree changes. */
    storageKey?: string
    /** First-visit size — px for `fixed`, a 0..1 fraction for `ratio`. */
    defaultSize?: number
    /** Lower clamp (px for fixed, fraction for ratio). */
    minSize?: number
    /** Upper clamp (px for fixed, fraction for ratio). */
    maxSize?: number
    /** Which pane carries the fixed size (fixed mode). */
    fixedPane?: Pane
    /** Keep the FLEXING pane at least this many px (fixed mode) so it stays
     *  readable — caps the fixed pane against the container width/height. */
    minOpposite?: number
    /** Enable the split from this breakpoint up; below it the panes stack in
     *  normal flow with no handle. `always` = never gate. */
    enabledFrom?: Breakpoint
    /** Pin the handle as a viewport-height strip (row only) instead of
     *  stretching it to the full — often very tall — row. Use for sticky
     *  docs-rail layouts so the grip stays reachable while scrolling. */
    sticky?: boolean
    /** Sticky offset from the top (any CSS length), matched to your header. */
    stickyTop?: string
    /** Accessible label for the divider. */
    label?: string
  }>(),
  {
    direction: 'row',
    mode: 'fixed',
    fixedPane: 'end',
    minOpposite: 0,
    enabledFrom: 'lg',
    sticky: false,
    stickyTop: '5rem',
    label: 'Resize panels',
  },
)

const HANDLE_PX = 12 // the handle's cross size (w-3 / h-3)
const BP_PX: Record<Breakpoint, number> = { always: 0, sm: 640, md: 768, lg: 1024, xl: 1280 }

/* --- breakpoint gate ------------------------------------------------- *
 * Manual matchMedia (set up on mount): starts false on the server so SSR and
 * the first client render agree (stacked), then flips on the client. Mirrors
 * the approach used elsewhere — VueUse useMediaQuery didn't sync reliably here. */
const enabled = ref(props.enabledFrom === 'always')
let mql: MediaQueryList | undefined
function onBp(e: MediaQueryListEvent | MediaQueryList) {
  enabled.value = e.matches
}
onMounted(() => {
  if (props.enabledFrom === 'always') return
  mql = window.matchMedia(`(min-width: ${BP_PX[props.enabledFrom]}px)`)
  enabled.value = mql.matches
  mql.addEventListener('change', onBp)
})
onBeforeUnmount(() => mql?.removeEventListener('change', onBp))

/* --- container measurement (for ratio scale + fixed max clamp) -------- *
 * We only need the container's MAIN-axis size. Crucially, the reactive write
 * is deferred to rAF rather than done synchronously inside the RO callback:
 * clamping `size` changes the panes' flex-basis, which resizes the code cards,
 * which the page's own content-priority ResizeObserver reacts to — writing
 * heights that shift layout again. Doing our write inside the callback closes
 * that loop within a single delivery cycle and the browser throws
 * "ResizeObserver loop completed with undelivered notifications". Deferring to
 * the next frame breaks the synchronous chain. */
const containerRef = ref<HTMLElement>()
const mainSize = ref(0)
let measureRaf = 0
useResizeObserver(containerRef, (entries) => {
  const box = entries[0]?.contentRect
  if (!box) return
  cancelAnimationFrame(measureRaf)
  measureRaf = requestAnimationFrame(() => {
    mainSize.value = Math.round(props.direction === 'row' ? box.width : box.height)
  })
})
onBeforeUnmount(() => cancelAnimationFrame(measureRaf))

const isRatio = computed(() => props.mode === 'ratio')

// Effective bounds. Fixed mode also clamps the max against the container so the
// flexing pane keeps `minOpposite` px; while unmeasured (size 0) fall back to
// the hard max so the persisted value isn't ratcheted down on first paint.
const minClamp = computed(() => props.minSize ?? (isRatio.value ? 0.1 : 0))
const maxClamp = computed(() => {
  if (isRatio.value) return props.maxSize ?? 0.9
  const hard = props.maxSize ?? Number.POSITIVE_INFINITY
  const m = mainSize.value
  return m > 0 ? Math.max(minClamp.value, Math.min(hard, m - props.minOpposite - HANDLE_PX)) : hard
})

const {
  value: size,
  dragging,
  startDrag,
  nudge,
  reset,
} = useSplitPane({
  key: props.storageKey || `split-${useId()}`,
  default: props.defaultSize ?? (isRatio.value ? 0.5 : 320),
  min: minClamp,
  max: maxClamp,
})

/* --- sizing styles (always objects → hydration-safe) ------------------ */
const stackedStart = computed(() => props.direction === 'row' ? 'min-w-0' : 'min-h-0')

const startStyle = computed<CSSProperties>(() => {
  if (!enabled.value) return {}
  if (isRatio.value) return { flex: `${size.value} 1 0` }
  return props.fixedPane === 'start' ? { flex: `0 0 ${size.value}px` } : { flex: '1 1 0' }
})
const endStyle = computed<CSSProperties>(() => {
  if (!enabled.value) return {}
  if (isRatio.value) return { flex: `${1 - size.value} 1 0` }
  return props.fixedPane === 'end' ? { flex: `0 0 ${size.value}px` } : { flex: '1 1 0' }
})

const stickyRow = computed(() => enabled.value && props.sticky && props.direction === 'row')
const handleStyle = computed<CSSProperties>(() => {
  if (!enabled.value) return {}
  if (stickyRow.value) {
    // Pin the handle as a viewport-height strip. `align-self: start` opts it
    // out of the container's stretch so the grip stays reachable rather than
    // being centered in a page-tall bar.
    return {
      position: 'sticky',
      top: props.stickyTop,
      alignSelf: 'start',
      height: `calc(100dvh - ${props.stickyTop} - 2rem)`,
    }
  }
  // Otherwise the container's `items-stretch` already fills the handle along
  // the main boundary (full row height / full column width) — nothing to add.
  return {}
})

/* --- a11y values ----------------------------------------------------- */
const ariaNow = computed(() => Math.round(isRatio.value ? size.value * 100 : size.value))
const ariaMin = computed(() => Math.round(isRatio.value ? toValue(minClamp) * 100 : toValue(minClamp)))
const ariaMax = computed(() => Math.round(isRatio.value ? toValue(maxClamp) * 100 : toValue(maxClamp)))

/* --- handle event wiring --------------------------------------------- */
const axis = computed<'x' | 'y'>(() => (props.direction === 'row' ? 'x' : 'y'))

function onDragStart(e: PointerEvent) {
  if (isRatio.value) {
    const m = mainSize.value
    if (m > 0) startDrag(e, { axis: axis.value, scale: 1 / m }) // drag toward end grows start
  }
  else {
    // Fixed pane on the end grows as you drag the divider back toward start.
    startDrag(e, { axis: axis.value, invert: props.fixedPane === 'end' })
  }
}
function onStep(dir: number) {
  if (isRatio.value) nudge(dir, 0.04) // Down/Right grows the start pane
  else nudge(props.fixedPane === 'end' ? -dir : dir, 24)
}
function onJump(to: 'min' | 'max' | 'reset') {
  if (to === 'reset') reset()
  else size.value = to === 'min' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
}
</script>

<template>
  <!-- Below the breakpoint: stack in normal flow, no handle. SSR renders this
       branch (enabled starts false) so hydration matches, then the client
       enhances to the flex split after mount. -->
  <div v-if="!enabled">
    <div :class="stackedStart">
      <slot name="start" />
    </div>
    <div>
      <slot name="end" />
    </div>
  </div>

  <!-- items-stretch (default): the rail wrapper grows to the full row height so
       a sticky child inside #end can travel the whole scroll range. -->
  <div
    v-else
    ref="containerRef"
    class="flex"
    :class="direction === 'row' ? 'flex-row' : 'flex-col'"
  >
    <div class="min-w-0 min-h-0" :style="startStyle">
      <slot name="start" />
    </div>

    <SplitPaneHandle
      :orientation="direction === 'row' ? 'vertical' : 'horizontal'"
      :active="dragging"
      :aria-label="label"
      :aria-value-now="ariaNow"
      :aria-value-min="ariaMin"
      :aria-value-max="ariaMax"
      :style="handleStyle"
      @dragstart="onDragStart"
      @step="onStep"
      @jump="onJump"
    />

    <div class="min-w-0 min-h-0" :style="endStyle">
      <slot name="end" />
    </div>
  </div>
</template>
