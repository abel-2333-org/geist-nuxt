<script setup lang="ts">
// Playground candidate → foundation. Interaction shell of the Annotation
// family: an inline, focusable trigger anchored to a non-modal popover.
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
//          form shares the same async states. Full spec: ../annotation.spec.md

export interface AnnotationPopoverLabels {
  /** sr-only announcement while `loading`. */
  loading?: string
  /** Retry button caption in the error state. */
  retry?: string
}

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
  /** First time the popover opens — annotation forms lazy-load here. */
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
const openedOnce = ref(false)
watch(open, (value) => {
  if (value && !openedOnce.value) {
    openedOnce.value = true
    emit('open')
  }
})

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
  clearTimers()
  openTimer = setTimeout(() => {
    open.value = true
  }, OPEN_DELAY)
}

function scheduleClose(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  clearTimeout(openTimer)
  closeTimer = setTimeout(() => {
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
  <UPopover v-model:open="open" mode="click">
    <button
      type="button"
      :disabled="disabled"
      class="-mx-0.5 box-decoration-clone inline cursor-pointer rounded-xs px-0.5 text-left underline decoration-dashed decoration-1 underline-offset-3 transition-colors hover:bg-elevated hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      :class="triggerClass"
      @pointerenter="onTriggerEnter"
      @pointerleave="scheduleClose"
      @click="clearTimers"
    >
      <slot />
    </button>

    <template #content="{ close }">
      <div
        class="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 p-4 text-sm sm:w-80"
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
          <p class="leading-relaxed text-muted">{{ error }}</p>
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
