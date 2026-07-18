<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

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

onMounted(() => {
  // Fonts changing metrics after paint would invalidate our measurements, so
  // recompute once they're ready too.
  if (typeof document !== 'undefined' && 'fonts' in document) {
    document.fonts.ready.then(() => recompute()).catch(() => {})
  }
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => recompute())
    observer.observe(rootEl.value)
  }
  nextTick(recompute)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

// Re-measure when the tag set itself changes.
watch(() => props.scenarios, () => {
  measured.value = false
  visibleCount.value = 1
  nextTick(recompute)
})
</script>

<template>
  <div
    ref="rootEl"
    class="relative flex min-w-0 flex-1 items-center justify-end gap-1"
  >
    <UTooltip :text="scenarios.join('、')">
      <span class="flex items-center gap-1">
        <!-- SSR / first paint: deterministic default (first tag + "+N"). -->
        <template v-if="!measured">
          <UBadge
            color="neutral"
            variant="soft"
            size="sm"
            :label="scenarios[0]"
            class="max-w-28"
          />
          <UBadge
            v-if="scenarios.length > 1"
            color="neutral"
            variant="soft"
            size="sm"
            :label="`+${scenarios.length - 1}`"
            class="tabular-nums"
          />
        </template>
        <!-- Measured: as many whole tags as fit, remainder folded into "+N". -->
        <template v-else-if="visibleCount >= 1">
          <UBadge
            v-for="s in scenarios.slice(0, visibleCount)"
            :key="s"
            color="neutral"
            variant="soft"
            size="sm"
            :label="s"
            class="max-w-28"
          />
          <UBadge
            v-if="visibleCount < scenarios.length"
            color="neutral"
            variant="soft"
            size="sm"
            :label="`+${scenarios.length - visibleCount}`"
            class="tabular-nums"
          />
        </template>
        <!-- Nothing fits: single count chip (tag icon + total). -->
        <template v-else>
          <UBadge
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-tag"
            :label="String(scenarios.length)"
            class="tabular-nums"
          />
        </template>
      </span>
    </UTooltip>

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
