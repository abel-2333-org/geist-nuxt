<script setup lang="ts">
// Generic base component — a draggable split divider rendered the Geist way:
// a 1px hairline in the divider token with a small centered grip pill. Low-key
// at rest (just the hairline), the grip lifts to primary on hover/drag so the
// affordance is obvious without a heavy bar. Purely presentational + a11y — all
// drag math and value ownership live in the parent (via `useSplitPane`); this
// component only reports intent through events.
//
// Anatomy:  focusable separator → centered hairline (track) + grip pill
// State:    rest / hover / dragging / focus-visible / disabled
// A11y:     role="separator", aria-orientation, aria-valuenow/min/max,
//           aria-label; keyboard: axis arrows nudge, Home/End jump to bounds,
//           Enter resets. focus-visible ring is the primary outline (never
//           removed). State is never color-only — grip shape + resize cursor
//           carry it too.

const props = withDefaults(
  defineProps<{
    /** Orientation of the divider LINE: 'vertical' separates left/right,
     *  'horizontal' separates top/bottom. */
    orientation?: 'vertical' | 'horizontal'
    /** Inert spacer (no grip, no cursor, not focusable) — used when the split
     *  has no room to move (content fits). */
    disabled?: boolean
    /** Reflects the parent's live drag state so the grip stays lit while the
     *  pointer is outside the element. */
    dragging?: boolean
    /** Accessible name for the primary pane controlled by this separator. */
    label: string
    /** ID of the primary pane controlled by this separator. */
    controls: string
    /** Current splitter position. Required whenever the handle is focusable. */
    value: number
    min?: number
    max?: number
  }>(),
  {
    orientation: 'vertical',
    disabled: false,
    dragging: false,
  },
)

const emit = defineEmits<{
  /** Pointer drag begins — parent wires this into useSplitPane.startDrag. */
  (e: 'dragStart', event: PointerEvent): void
  /** Keyboard nudge; delta is -1 (Left/Up) or +1 (Right/Down). */
  (e: 'step', delta: -1 | 1): void
  /** Jump to a bound or reset (Home / End / Enter). */
  (e: 'jump', to: 'min' | 'max' | 'reset'): void
}>()

function onPointerdown(e: PointerEvent) {
  if (props.disabled || e.button !== 0) return
  emit('dragStart', e)
}

function arrowStep(key: string): -1 | 1 | undefined {
  if (props.orientation === 'vertical') {
    if (key === 'ArrowLeft') return -1
    if (key === 'ArrowRight') return 1
    return
  }
  if (key === 'ArrowUp') return -1
  if (key === 'ArrowDown') return 1
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  const delta = arrowStep(e.key)
  if (delta !== undefined) {
    emit('step', delta)
    e.preventDefault()
    return
  }
  switch (e.key) {
    case 'Home':
      emit('jump', 'min')
      break
    case 'End':
      emit('jump', 'max')
      break
    case 'Enter':
      emit('jump', 'reset')
      break
    default:
      return
  }
  e.preventDefault()
}
</script>

<template>
  <div
    :role="disabled ? undefined : 'separator'"
    :aria-orientation="disabled ? undefined : orientation"
    :aria-label="disabled ? undefined : label"
    :aria-controls="disabled ? undefined : controls"
    :aria-valuenow="disabled ? undefined : value"
    :aria-valuemin="disabled ? undefined : min"
    :aria-valuemax="disabled ? undefined : max"
    :tabindex="disabled ? undefined : 0"
    class="group relative flex shrink-0 touch-none items-center justify-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="[
      // Cross-axis size is fixed; the MAIN axis (height for vertical, width for
      // horizontal) is left to the consumer so it can fill its track OR be a
      // pinned viewport-height strip. Vertical defaults to self-stretch (fills
      // the flex row) unless the consumer passes its own height/self-*.
      orientation === 'vertical' ? 'w-3' : 'h-3 w-full',
      disabled ? '' : orientation === 'vertical' ? 'cursor-col-resize' : 'cursor-row-resize',
    ]"
    @pointerdown="onPointerdown"
    @keydown="onKeydown"
    @dblclick="!disabled && emit('jump', 'reset')"
  >
    <!-- Hairline track — the divider token, consumed via a border utility
         (Nuxt UI has no bg-border; --ui-border is a border color). Hidden when
         inert. -->
    <span
      v-if="!disabled"
      aria-hidden="true"
      class="absolute transition-colors duration-150 ease-out"
      :class="[
        orientation === 'vertical' ? 'h-full border-l' : 'w-full border-t',
        dragging ? 'border-primary' : 'border-default',
      ]"
    />
    <!-- Grip pill (Tailwind 4px scale, rounded-full from --ui-radius family).
         Hidden at rest; revealed on hover, while dragging, and on
         keyboard focus (group-focus-visible) so keyboard users still see the
         affordance. -->
    <span
      v-if="!disabled"
      aria-hidden="true"
      class="relative rounded-full opacity-0 transition duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
      :class="[
        orientation === 'vertical' ? 'h-6 w-1' : 'h-1 w-6',
        dragging ? 'bg-primary opacity-100' : 'bg-accented group-hover:bg-primary',
      ]"
    />
  </div>
</template>
