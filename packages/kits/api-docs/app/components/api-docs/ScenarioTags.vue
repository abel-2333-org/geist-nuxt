<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

// Trailing scenario-tag cluster for an endpoint row. It fills the space the
// purpose label leaves (the label is `shrink`, this cluster is `flex-1`), then
// shows *as many whole tags as actually fit* — measured, not guessed — folding
// the remainder into a "+N" chip. When not even one tag fits it collapses to a
// single count chip. This makes the reveal data-agnostic: 2 short tags or 8
// long ones, CJK or latin, it adapts to the real pixel budget at the row's
// live width (which the drag-resize handle changes).
const props = defineProps<{
  scenarios: string[]
}>()

// The flex-1 element we measure — its clientWidth is the pixel budget for tags,
// and it doesn't depend on the visible tag content (grow fills the remainder),
// so recomputing visibility never feeds back into the measured width.
const rootEl = ref<HTMLElement | null>(null)
// A hidden layer that renders every candidate at its intrinsic width so we can
// read real rendered sizes (incl. badge padding, icon, font metrics).
const measureEl = ref<HTMLElement | null>(null)

// How many whole tags to show. 0 => collapse to the count chip.
const visibleCount = ref(1)
// Until mounted + measured we render a deterministic default (first tag + "+N")
// so SSR and the first client paint match — no hydration mismatch. The real
// measurement runs in onMounted and thereafter on resize.
const measured = ref(false)

const GAP = 4 // matches gap-1 (0.25rem)

function recompute() {
  const root = rootEl.value
  const measure = measureEl.value
  if (!root || !measure) return
  const total = props.scenarios.length
  if (total === 0) return

  const avail = root.clientWidth
  const tagWidths = [...measure.querySelectorAll<HTMLElement>('[data-tag]')].map(el => el.offsetWidth)
  const plusW = measure.querySelector<HTMLElement>('[data-plus]')?.offsetWidth ?? 0

  // Largest k tags that fit, reserving room for the "+N" chip whenever some
  // tags stay hidden (k < total).
  let best = 0
  for (let k = total; k >= 1; k--) {
    let need = 0
    for (let i = 0; i < k; i++) need += tagWidths[i]
    need += GAP * (k - 1)
    if (k < total) need += GAP + plusW
    if (need <= avail) {
      best = k
      break
    }
  }
  visibleCount.value = best
  measured.value = true
}

let observer: ResizeObserver | null = null
let rafId = 0

// ResizeObserver callbacks run synchronously; recomputing there mutates the DOM
// and can resize the observed node again within the same delivery cycle, which
// the browser reports as "ResizeObserver loop completed with undelivered
// notifications". Deferring the work to the next animation frame breaks that
// synchronous feedback loop (the standard fix) and coalesces bursts of resize
// events into a single recompute.
function scheduleRecompute() {
  if (typeof requestAnimationFrame === 'undefined') {
    recompute()
    return
  }
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    rafId = 0
    recompute()
  })
}

onMounted(() => {
  // Fonts changing metrics after paint would invalidate our measurements, so
  // recompute once they're ready too.
  if (typeof document !== 'undefined' && 'fonts' in document) {
    document.fonts.ready.then(() => recompute()).catch(() => {})
  }
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(scheduleRecompute)
    observer.observe(rootEl.value)
  }
  nextTick(recompute)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  if (rafId) cancelAnimationFrame(rafId)
})

// Re-measure when the tag set itself changes.
watch(() => props.scenarios, () => {
  measured.value = false
  visibleCount.value = 1
  nextTick(recompute)
})

// Derived view state, unified across the SSR default and the measured phase so
// the template has no phase-specific branches.
// Before measuring: deterministic default of one tag (matches SSR).
const shownCount = computed(() =>
  measured.value ? visibleCount.value : Math.min(1, props.scenarios.length),
)
const visibleTags = computed(() => props.scenarios.slice(0, shownCount.value))
const hiddenCount = computed(() => props.scenarios.length - shownCount.value)
const hasOverflow = computed(() => hiddenCount.value > 0)
// When not a single tag fits, the overflow trigger becomes a count chip
// (tag icon + total) instead of a "+N".
const collapsedToCount = computed(() => shownCount.value === 0)
const overflowLabel = computed(() => `查看全部 ${props.scenarios.length} 个服务场景`)
</script>

<template>
  <div
    ref="rootEl"
    class="relative flex min-w-0 flex-1 items-center justify-end gap-1"
  >
    <span class="flex items-center gap-1">
      <!-- Whole tags that fit: plain, non-interactive. -->
      <UBadge
        v-for="s in visibleTags"
        :key="s"
        color="neutral"
        variant="soft"
        size="sm"
        :label="s"
        class="max-w-28"
      />

      <!-- Overflow reveal. A hover tooltip is the wrong tool here: reka-ui
           ignores touch pointers (`pointerType === 'touch'` early-returns) and
           a non-interactive trigger is unreachable by keyboard, so the folded
           scenarios would be invisible to touch and keyboard users. A Popover
           in its default `click` mode is operable by tap, mouse and Enter/Space
           alike, so the "+N" / count chip becomes a real, focusable button that
           opens the full list. -->
      <UPopover
        v-if="hasOverflow"
        :content="{ side: 'bottom', align: 'end' }"
      >
        <!-- `pointer-events-auto` + `relative z-10` lift this trigger back above
             the row's stretched-link overlay (the row content is
             pointer-events-none so plain clicks fall through to the nav link),
             so opening the scenario list never also navigates the row.
             `touch-manipulation` drops the 300ms tap delay on touch. -->
        <button
          type="button"
          :aria-label="overflowLabel"
          class="pointer-events-auto relative z-10 touch-manipulation rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <UBadge
            color="neutral"
            variant="soft"
            size="sm"
            :icon="collapsedToCount ? 'i-lucide-tag' : undefined"
            :label="collapsedToCount ? String(scenarios.length) : `+${hiddenCount}`"
            class="cursor-pointer tabular-nums transition-colors hover:bg-elevated"
          />
        </button>
        <template #content>
          <div class="flex max-w-xs flex-col gap-2 p-3">
            <p class="text-xs font-medium text-muted">服务场景</p>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="s in scenarios"
                :key="s"
                color="neutral"
                variant="soft"
                size="sm"
                :label="s"
              />
            </div>
          </div>
        </template>
      </UPopover>
    </span>

    <!-- Full list for screen readers, regardless of how many chips render. -->
    <span class="sr-only">{{ scenarios.join('、') }}</span>

    <!-- Hidden measurement layer: intrinsic widths only, never interactive. -->
    <div
      ref="measureEl"
      aria-hidden="true"
      class="pointer-events-none invisible absolute -z-10 flex items-center gap-1 whitespace-nowrap"
    >
      <UBadge
        v-for="s in scenarios"
        :key="s"
        data-tag
        color="neutral"
        variant="soft"
        size="sm"
        :label="s"
        class="max-w-28"
      />
      <UBadge
        data-plus
        color="neutral"
        variant="soft"
        size="sm"
        :label="`+${scenarios.length}`"
        class="tabular-nums"
      />
    </div>
  </div>
</template>
