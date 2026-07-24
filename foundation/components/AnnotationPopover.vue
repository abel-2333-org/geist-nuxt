<script setup lang="ts">
// Interaction shell of the Annotation family: an inline, focusable trigger
// anchored to a non-modal popover.
//
// Why click mode + manual hover: UPopover mode="hover" rides reka HoverCard,
// which touch and keyboard users cannot operate when the card holds actions
// (see references/components/overlays.md). The shell therefore keeps the
// click-mode Popover as the skeleton (tap / click / Enter behave the same on
// every input) and layers mouse-only pointerenter/leave timers on top so
// mouse users still get hover-first ergonomics.
//
// Anatomy: trigger (real <button>, dashed underline) ── popover panel:
//          eyebrow (icon + label) → body (default #content from the concrete
//          annotation) → #actions row. Loading (skeleton + aria-busy) and
//          error (message + retry emit) are shell chrome so every annotation
//          form shares the same async states.
//          Contract: references/components/overlays.md
//
// AnnotationPopoverLabels is auto-imported from `utils/annotation` (referenced
// bare, no import) so the label model is reachable from both foundation forms
// and the kit's field form across the copy-in topology boundary.
// Keep the original SFC type export stable for consumers that imported it
// before the canonical definition moved into the auto-imported util.
export type { AnnotationPopoverLabels } from '../utils/annotation'

const props = withDefaults(
  defineProps<{
    /** Eyebrow caption naming the annotation category (e.g. "Term"). */
    label?: string
    /** Eyebrow leading icon, decorative (`aria-hidden`). */
    icon?: string
    /** Renders skeleton chrome inside the panel. */
    loading?: boolean
    /** Error message; truthy switches the panel to the error state. */
    error?: string | false
    disabled?: boolean
    /** Extra classes for the inline trigger (annotation forms set their accent). */
    triggerClass?: string
    /** Overridable shell copy for localization. */
    labels?: AnnotationPopoverLabels
  }>(),
  { error: false, labels: () => ({}) },
)

const emit = defineEmits<{
  /** Every time the popover opens — annotation forms decide whether to load. */
  open: []
  /** Retry pressed in the error state. */
  retry: []
}>()

const t = computed<Required<AnnotationPopoverLabels>>(() => ({
  loading: 'Loading preview…',
  retry: 'Retry preview',
  ...props.labels,
}))

const open = ref(false)
const triggerEl = ref<HTMLButtonElement>()
const panelEl = ref<HTMLElement>()

watch(open, (value) => {
  if (value) emit('open')
})

// ── Focus management ────────────────────────────────────────────────────────
// The panel is portaled (never after the trigger in DOM order), so keyboard
// opens must move focus into it or its actions are unreachable by Tab. But
// reka's FocusScope auto-focuses the panel on EVERY open, which would let a
// mere mouse hover yank focus from wherever the user is typing. `:focus-visible`
// on the trigger cannot distinguish the two either (Tab to the trigger, then
// hover: still :focus-visible). So the trigger's own events record how this
// open was initiated, and the content's auto-focus hooks act on it:
//  - keyboard (Enter/Space keydown) → focus the panel's first action, or the
//    panel itself (tabindex="-1") so Escape keeps working;
//  - pointer / hover → prevent auto-focus entirely, stay focus-neutral.
// On close, reka would likewise auto-return focus to the trigger; that is only
// right when focus actually lives inside the panel — the keyboard journeys
// (Enter → panel → Escape) all satisfy it. When focus is already elsewhere
// (hover graze, or an outside click that legitimately moved focus), stealing
// it back to the trigger would interrupt whatever the user is doing.
type OpenSource = 'keyboard' | 'pointer' | 'hover'
let openSource: OpenSource = 'pointer'

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') openSource = 'keyboard'
  // A hover-open can leave the panel open while the trigger still holds focus
  // (Tab to trigger, then mouse hover). Forward Tab would then skip the
  // portaled panel entirely; redirect it into the panel instead. Shift+Tab
  // keeps its natural backward behavior.
  if (event.key === 'Tab' && !event.shiftKey && open.value) {
    event.preventDefault()
    clearTimers()
    openSource = 'keyboard'
    focusPanel()
  }
}

function onTriggerPointerdown() {
  openSource = 'pointer'
}

function focusPanel() {
  const panel = panelEl.value
  if (!panel) return
  if (panel.contains(document.activeElement)) return
  const first = panel.querySelector<HTMLElement>(
    'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )
  ;(first ?? panel).focus()
}

// UPopover lazily mounts its portaled content. On the first open, reka's
// open-auto-focus hook can run before the slot's template ref is assigned, so
// a deferred focus attempt may still see no panel and silently stop. Let the
// ref becoming available own keyboard focus instead; pointer and hover opens
// remain focus-neutral because their source never passes this guard.
watch([open, panelEl], ([isOpen, panel]) => {
  if (isOpen && panel && openSource === 'keyboard') focusPanel()
}, { flush: 'post' })

const contentProps = {
  onOpenAutoFocus(event: Event) {
    event.preventDefault()
  },
  onCloseAutoFocus(event: Event) {
    // `inPanel` must be sampled now — the portaled panel detaches right after
    // this hook, so by nextTick the containment answer is gone.
    const panel = panelEl.value
    const inPanel = Boolean(panel && panel.contains(document.activeElement))
    // Own the close path explicitly: by the time reka dispatches this hook,
    // portaled content may already be detached and its default restore target
    // is not reliable for a hover → keyboard takeover.
    event.preventDefault()
    if (!inPanel && openSource !== 'keyboard') return
    // Whether focus is truly lost is only knowable after the browser settles:
    // an outside click's default focus can land between this hook and nextTick
    // (at hook time activeElement may still be body). Verify at focus time so
    // a real outside-click target never gets its focus yanked to the trigger.
    nextTick(() => {
      const active = document.activeElement
      const focusLost = !active || active === document.body || !active.isConnected
      if (focusLost) triggerEl.value?.focus()
    })
  },
}

// Mouse-only hover enhancement. Short open delay avoids popovers firing while
// the pointer merely sweeps across a paragraph; the close delay leaves room to
// travel from trigger into the panel (which cancels the close on enter).
const OPEN_DELAY = 150
const CLOSE_DELAY = 250
let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined

function clearTimers() {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
}

function onTriggerEnter(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || props.disabled) return
  // A click/keyboard-owned open session must stay under that input's control;
  // merely crossing the trigger with a mouse must not reclassify it as hover.
  if (open.value && openSource !== 'hover') return
  clearTimers()
  openTimer = setTimeout(() => {
    // Re-check: `disabled` may have flipped during the delay.
    if (props.disabled) return
    openSource = 'hover'
    open.value = true
  }, OPEN_DELAY)
}

// Disabling mid-interaction cancels pending hover timers and closes an
// already-open panel, so a disabled annotation is never left interactive.
watch(() => props.disabled, (disabled) => {
  if (!disabled) return
  clearTimers()
  open.value = false
})

function scheduleClose(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  clearTimeout(openTimer)
  closeTimer = setTimeout(() => {
    const panel = panelEl.value
    // Hover timers only own hover-open sessions. Once keyboard focus enters
    // the panel, pointer movement must not dismiss the user's active journey.
    if (openSource !== 'hover' || panel?.contains(document.activeElement)) return
    open.value = false
  }, CLOSE_DELAY)
}

function cancelClose(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  clearTimers()
}

onBeforeUnmount(clearTimers)
</script>

<template>
  <UPopover v-model:open="open" mode="click" :content="contentProps">
    <button
      ref="triggerEl"
      type="button"
      :disabled="disabled"
      class="-mx-0.5 box-decoration-clone inline cursor-pointer touch-manipulation rounded-xs px-0.5 text-left underline decoration-dashed decoration-1 underline-offset-3 transition-colors hover:bg-elevated hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      :class="triggerClass"
      @keydown="onTriggerKeydown"
      @pointerdown="onTriggerPointerdown"
      @pointerenter="onTriggerEnter"
      @pointerleave="scheduleClose"
      @click="clearTimers"
    >
      <slot />
    </button>

    <template #content="{ close }">
      <div
        ref="panelEl"
        tabindex="-1"
        class="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 p-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-80"
        :aria-busy="loading || undefined"
        @pointerenter="cancelClose"
        @pointerleave="scheduleClose"
      >
        <p
          v-if="label"
          class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-dimmed"
        >
          <UIcon v-if="icon" :name="icon" class="size-3.5 shrink-0" aria-hidden="true" />
          {{ label }}
        </p>

        <template v-if="loading">
          <span class="sr-only" role="status">{{ t.loading }}</span>
          <div class="flex flex-col gap-2" aria-hidden="true">
            <USkeleton class="h-4 w-3/5" />
            <USkeleton class="h-3 w-full" />
            <USkeleton class="h-3 w-4/5" />
          </div>
        </template>

        <template v-else-if="error">
          <p class="leading-relaxed text-muted" role="status" aria-live="polite">{{ error }}</p>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="outline"
              size="xs"
              icon="i-lucide-rotate-cw"
              @click="emit('retry')"
            >
              {{ t.retry }}
            </UButton>
            <slot name="actions" :close="close" />
          </div>
        </template>

        <template v-else>
          <slot name="content" :close="close" />
          <div v-if="$slots.actions" class="flex items-center gap-2 pt-1">
            <slot name="actions" :close="close" />
          </div>
        </template>
      </div>
    </template>
  </UPopover>
</template>
