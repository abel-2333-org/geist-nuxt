<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import type { EndpointSpec } from '~/types/spec'
import { useWindowSize } from '@vueuse/core'
import rawSpec from '~/data/txn-payment.spec.json'
import { adaptSpec } from '~/utils/spec-adapter'

// The spec JSON is the single source of truth. The adapter maps it to the props
// our reference components consume — editing the JSON updates the page.
const spec = adaptSpec(rawSpec as unknown as EndpointSpec)

// Honor an incoming deep link (#request-body_field…): expand ancestors, scroll,
// and flash the target row once the field tree has mounted.
const { initFromHash } = useFieldAnchor()

/* ------------------------------------------------------------------ *
 * Resizable layout (lg+ only)
 *
 * Two draggable boundaries, both persisted (cookies, via useSplitPane):
 *   • horizontal — the docs | code-rail split (rail width in px)
 *   • vertical   — the Request | Response split (a ratio 0..1)
 *
 * Whitespace model = content priority with reallocation:
 *   - If both examples fit the rail, they render at natural height and the rail
 *     shrinks to content — no stretching, the vertical handle is inert.
 *   - If they overflow, the rail is capped and split by ratio, but a pane that
 *     needs less than its share is capped at its natural height and donates the
 *     surplus to its overflowing sibling (computeSplitBudgets). So a short
 *     snippet never floats in a big empty box.
 * ------------------------------------------------------------------ */
const HANDLE_H = 12 // matches the horizontal handle's h-3 track
const MIN_PANE = 96 // smallest usable pane in the overflow regime
const TOP_INSET = 112 // sticky top-20 (80px) + bottom breathing = 7rem

// Breakpoint gate for the whole resizable behavior. Manual matchMedia (set up
// on mount) rather than VueUse useMediaQuery, which wasn't syncing reliably here
// after hydration. Starts false on the server → matches SSR, flips on the client.
const isLg = ref(false)
let mql: MediaQueryList | undefined
function onBreakpoint(e: MediaQueryListEvent | MediaQueryList) {
  isLg.value = e.matches
}
onMounted(() => {
  mql = window.matchMedia('(min-width: 1024px)')
  isLg.value = mql.matches
  mql.addEventListener('change', onBreakpoint)
})
onBeforeUnmount(() => mql?.removeEventListener('change', onBreakpoint))

const { height: winH } = useWindowSize({ initialWidth: 0, initialHeight: 0 })
const availH = computed(() => Math.max(240, winH.value - TOP_INSET))

// The docs | code-rail width split is now handled declaratively by <SplitPane>
// (see the template). This page only owns the INNER Request | Response split
// below, which layers content-priority reallocation on top — a behavior coupled
// to how the code cards cap + scroll, so it stays here rather than in SplitPane.
const {
  value: splitRatio,
  dragging: ratioDragging,
  startDrag: ratioStartDrag,
  nudge: ratioNudge,
  reset: ratioReset,
} = useSplitPane({ key: 'geist-api-split-ratio', default: 0.5, min: 0.12, max: 0.88 })

/* --- natural-height measurement (loop-free) --------------------------
 * We measure each pane's natural (uncapped) height from the DOM: the code
 * body's <pre> reports full content height even while its scroll surface is
 * capped, so the value is independent of the budget we apply — no feedback
 * loop. Re-measured by a ResizeObserver on the wrappers + their <pre>. */
const reqPane = ref<HTMLElement>()
const resPane = ref<HTMLElement>()
const natTop = ref(0)
const natBottom = ref(0)

function measureOne(el?: HTMLElement): number {
  if (!el) return 0
  const section = el.querySelector('section') as HTMLElement | null
  if (!section) return el.offsetHeight
  const surface = section.querySelector('.code-surface') as HTMLElement | null
  const pre = section.querySelector('pre') as HTMLElement | null
  // Empty state (no code surface): the section is already its natural height.
  if (!surface || !pre) return section.offsetHeight
  // chrome (header + borders) is section minus the visible surface; add the
  // full, uncapped content height of the <pre>.
  return section.offsetHeight - surface.offsetHeight + pre.offsetHeight
}

function measure() {
  natTop.value = measureOne(reqPane.value)
  natBottom.value = measureOne(resPane.value)
}

const overflow = computed(
  () => isLg.value && natTop.value + natBottom.value > availH.value - HANDLE_H,
)

const budgets = computed(() =>
  overflow.value
    ? computeSplitBudgets(availH.value - HANDLE_H, natTop.value, natBottom.value, splitRatio.value, MIN_PANE)
    : null,
)

// In the fit regime give the examples a generous cap (the whole rail) so they
// grow to content without a premature 24rem clip; below lg keep the default.
const paneMaxHeight = computed(() =>
  isLg.value && !overflow.value ? `${availH.value}px` : '24rem',
)
// Always an object (never undefined): were `:style` undefined at hydration and
// later an object, Vue would skip the style patch and the height would silently
// never apply. Empty strings keep a real object around so the patch runs.
const reqStyle = computed(() => ({ height: budgets.value ? `${budgets.value.top}px` : '' }))
const resStyle = computed(() => ({ height: budgets.value ? `${budgets.value.bottom}px` : '' }))

// Re-measure whenever wrap toggles (line count changes) — belt-and-braces on
// top of the ResizeObserver.
const codeWrap = useCodeWrap()

let ro: ResizeObserver | undefined
function syncObservers() {
  if (!ro) return
  ro.disconnect()
  for (const el of [reqPane.value, resPane.value]) {
    if (!el) continue
    ro.observe(el)
    const pre = el.querySelector('pre')
    if (pre) ro.observe(pre)
  }
  measure()
}

// Defer the RO reaction to the next frame. `measure()` writes natTop/natBottom
// → budgets → the pane wrappers' applied height, and those wrappers are among
// the observed elements. Re-measuring synchronously inside the callback closes
// that write→observe chain within one delivery cycle, which the browser reports
// as "ResizeObserver loop completed with undelivered notifications". Coalescing
// to a single rAF breaks the synchronous chain (and debounces bursts).
let measureRaf = 0
function scheduleMeasure() {
  cancelAnimationFrame(measureRaf)
  measureRaf = requestAnimationFrame(measure)
}

onMounted(() => {
  initFromHash()
  ro = new ResizeObserver(scheduleMeasure)
  syncObservers()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  cancelAnimationFrame(measureRaf)
})
// Regime / breakpoint / width / wrap changes can add or remove the <pre> or
// change layout — re-attach observers on the next tick, then re-measure.
watch(
  () => [isLg.value, overflow.value, winH.value, codeWrap.value],
  () => nextTick(syncObservers),
)

/* --- inner Request | Response handle wiring -------------------------- */
function onRatioDragStart(e: PointerEvent) {
  const H = availH.value - HANDLE_H
  if (H > 0) ratioStartDrag(e, { axis: 'y', scale: 1 / H }) // drag down → top grows
}
function onRatioStep(dir: number) {
  ratioNudge(dir, 0.04)
}
function onRatioJump(to: 'min' | 'max' | 'reset') {
  if (to === 'reset') ratioReset()
  else splitRatio.value = to === 'min' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
}

const crumbs: BreadcrumbItem[] = [
  { label: 'Home', to: '#', icon: 'i-lucide-home' },
  { label: 'Payments', to: '#' },
  { label: 'Create Payment' },
]

useHead({ title: 'Create Payment · Onerway API Reference' })
</script>

<template>
  <div class="min-h-screen bg-default text-default antialiased">
    <!-- Skip link: visually hidden until focused, lets keyboard/AT users jump
         past the header straight to the operation content. -->
    <a
      href="#main-content"
      class="sr-only rounded-md bg-inverted px-4 py-2 font-medium text-inverted focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
    >Skip to content</a>

    <AppHeader />

    <main id="main-content">
      <UContainer class="py-8 sm:py-12">
        <UBreadcrumb :items="crumbs" class="mb-8" />

        <!-- Two-pane layout: docs | sticky code rail. <SplitPane> owns the
             width split, drag, persistence and the lg breakpoint gate; below lg
             it stacks the two slots at natural height with no handle. -->
        <SplitPane
          direction="row"
          mode="fixed"
          fixed-pane="end"
          sticky
          sticky-top="5rem"
          storage-key="geist-api-rail-width"
          :default-size="460"
          :min-size="360"
          :max-size="720"
          :min-opposite="360"
          label="Resize documentation and code panels"
        >
          <template #start>
            <!-- Left pane: documentation content -->
            <div class="min-w-0 space-y-12 lg:pr-6">
            <div class="space-y-6">
              <OperationHeader
                :method="spec.method"
                :path="spec.path"
                :status="spec.endpointStatus"
                title="Create Payment"
                version="v1"
                date="Updated Jul 2026"
              />
              <p class="max-w-2xl text-base leading-relaxed text-toned">
                Create a payment to authorize and, optionally, capture funds from a customer.
                Amounts are expressed as decimal strings in the given currency. All object
                fields are serialized as JSON strings in the request body.
              </p>

              <!-- Authentication: structured contract panel (see AuthPanel) -->
              <AuthPanel :requirements="spec.authRequirements" />
            </div>

            <FieldGroup
              v-if="spec.requestHeaders.length"
              label="Request Headers"
              :count="spec.requestHeaders.length"
            >
              <FieldItem
                v-for="header in spec.requestHeaders"
                :key="header.name"
                v-bind="header"
              />
            </FieldGroup>

            <FieldGroup label="Request Body" :count="spec.requestFields.length">
              <FieldItem
                v-for="field in spec.requestFields"
                :key="field.name"
                v-bind="field"
              />
            </FieldGroup>

            <FieldGroup
              v-if="spec.responseFields.length"
              label="Response"
              :count="spec.responseFields.length"
            >
              <FieldItem
                v-for="field in spec.responseFields"
                :key="field.name"
                v-bind="field"
              />
            </FieldGroup>
            </div>
          </template>

          <!-- Right pane: sticky code examples. Pinned on lg+ and split into
               Request / Response by a draggable horizontal divider; the rail
               sizes to content when everything fits, and caps + splits when it
               overflows. Below lg it stacks at natural height. -->
          <template #end>
            <aside
              class="mt-10 min-w-0 lg:mt-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:pl-6"
            >
            <div class="flex flex-col">
              <div ref="reqPane" class="min-h-0" :style="reqStyle">
                <RequestExample
                  :scenarios="spec.requestExamples"
                  :fill="overflow"
                  :max-height="paneMaxHeight"
                />
              </div>

              <SplitPaneHandle
                orientation="horizontal"
                class="my-1"
                :disabled="!overflow"
                :active="ratioDragging"
                aria-label="Resize request and response panels"
                :aria-value-now="Math.round(splitRatio * 100)"
                :aria-value-min="12"
                :aria-value-max="88"
                @dragstart="onRatioDragStart"
                @step="onRatioStep"
                @jump="onRatioJump"
              />

              <div ref="resPane" class="min-h-0" :style="resStyle">
                <ResponseExample
                  :scenarios="spec.responseExamples"
                  :fill="overflow"
                  :max-height="paneMaxHeight"
                />
              </div>
            </div>
            </aside>
          </template>
        </SplitPane>
      </UContainer>
    </main>
  </div>
</template>
