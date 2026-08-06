<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

// Endpoint target: environment picker + segmented request address.
//
// Wide:   [ environment | host ][ path ............... CopyButton ]
// Narrow: [ environment | host ]
//         [ path ................................. CopyButton ]
//
// The row is TWO ATOMIC LAYOUT UNITS, never four peers: `origin` is the
// environment plus the host it selects, `operation` is the path plus the
// whole-address action that acts on it. Each unit is `flex-nowrap`, so the only
// place the row can break is BETWEEN them — the primary copy can never be
// orphaned from the path, at any width, in any font.
//
// The threshold is therefore CONTENT-DERIVED, not a pixel breakpoint: the row
// collapses to one line exactly when both units genuinely fit, which is the only
// honest answer when host, path, label and font metrics are all variables. See
// `references/foundations/responsiveness.md` → 内在换行分组. The named container
// survives only for segment DENSITY, because this component also lives inside
// resizable panes whose width is independent from the viewport.
//
// Host yields first (truncates); path scrolls only when necessary; the
// whole-address action never scrolls away.
//
// Host and path are secondary copy actions: real buttons with copy cursors,
// hover/focus underlines and supplemental tooltips. Their text stays selectable,
// and completing a real text selection does not trigger a copy. The single
// explicit CopyButton remains the primary "copy the endpoint" action.

export interface OperationHost {
  id: string
  /** Human name of the environment, e.g. "生产" / "沙箱". */
  label: string
  /** Scheme + host (no trailing slash), e.g. "https://api.example.cn". */
  baseUrl: string
}

/**
 * Component-owned ("chrome") copy, so a doc site can localize the row in one
 * place — e.g. pass `$t()` values from @nuxtjs/i18n. Mirrors the ApiCodeLabels
 * convention used by <CodeBlock>.
 */
export interface ApiTargetLabels {
  /** Accessible name for the whole-address copy button, e.g. "复制完整地址". */
  copy?: string
  /** Complete whole-address success message; also used as the copied label. */
  copied?: string
  /** Complete failure message shared by all three copy actions. */
  copyFailed?: string
  /** Accessible name for the host segment, e.g. "复制 host". */
  copyHost?: string
  /** Complete host success message; also used as the copied label. */
  copiedHost?: string
  /** Accessible name for the path segment, e.g. "复制 path". */
  copyPath?: string
  /** Complete path success message; also used as the copied label. */
  copiedPath?: string
}

const props = withDefaults(
  defineProps<{
    /** At least one host. One host → no select, just the address + copy. */
    hosts: OperationHost[]
    /** Operation path, appended verbatim to the selected host's baseUrl. */
    path: string
    /** Accessible name for the environment select. */
    selectLabel?: string
    /** Overridable UI copy for localization. See ApiTargetLabels. */
    labels?: ApiTargetLabels
  }>(),
  { labels: () => ({}) },
)

const selected = defineModel<string>()

// Merge caller copy over neutral English defaults. Chrome text only.
const t = computed<Required<ApiTargetLabels>>(() => ({
  copy: 'Copy endpoint',
  copied: 'Endpoint copied to clipboard',
  copyFailed: 'Copy failed. Select the address and copy manually',
  copyHost: 'Copy host',
  copiedHost: 'Host copied to clipboard',
  copyPath: 'Copy path',
  copiedPath: 'Path copied to clipboard',
  ...props.labels,
}))

/** Never-undefined id for the select binding; falls back to the first host. */
const selectedId = computed({
  get: () => selected.value ?? props.hosts[0]?.id ?? '',
  set: (v: string) => { selected.value = v },
})

const activeHost = computed(
  () => props.hosts.find(h => h.id === selectedId.value) ?? props.hosts[0],
)

const selectItems = computed(() =>
  props.hosts.map(h => ({ label: h.label, value: h.id })),
)

/** Host-only copy value. Always the FULL baseUrl, even while truncated. */
const baseUrl = computed(() => activeHost.value?.baseUrl ?? '')

const fullAddress = computed(() => `${baseUrl.value}${props.path}`)

/* ------------------------------------------------------------------ *
 * Segment copy. Two independent useCopy instances so the two pulses (and
 * the two toasts) never overwrite each other, but ONE live region: the
 * announcement describes "what just got copied", which is a single fact.
 * ------------------------------------------------------------------ */
const { copied: hostCopied, copy: writeHost } = useCopy()
const { copied: pathCopied, copy: writePath } = useCopy()
const segmentStatus = shallowRef('')
let copyRevision = 0

/**
 * True when this click merely FINISHED a text selection inside the segment.
 * `detail === 0` means keyboard activation (Enter/Space), which never carries a
 * selection intent, so it must not be swallowed.
 */
function selecting(event: MouseEvent) {
  if (event.detail === 0) return false
  const selection = window.getSelection?.()
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return false
  const el = event.currentTarget as HTMLElement | null
  return el && typeof selection.containsNode === 'function'
    ? selection.containsNode(el, true)
    : true
}

async function copySegment(segment: 'host' | 'path', value: string) {
  const revision = ++copyRevision
  const successMessage = segment === 'host' ? t.value.copiedHost : t.value.copiedPath
  const write = segment === 'host' ? writeHost : writePath

  // Clear first so repeating the same action still creates a live-region change.
  segmentStatus.value = ''
  const copied = await write(value, {
    successMessage,
    failureMessage: t.value.copyFailed,
  })
  if (!copied || revision !== copyRevision) return

  await nextTick()
  if (revision !== copyRevision) return
  segmentStatus.value = successMessage
}

function onCopyHost(event: MouseEvent) {
  if (selecting(event)) return
  void copySegment('host', baseUrl.value)
}

function onCopyPath(event: MouseEvent) {
  if (selecting(event)) return
  void copySegment('path', props.path)
}

/* ------------------------------------------------------------------ *
 * Overflow probe — drives the right-edge fade only when the path is
 * genuinely clipped. SSR renders `false` (deterministic default) and the
 * measurement refines it after mount, so there is no hydration mismatch.
 * ------------------------------------------------------------------ */
const pathTrack = useTemplateRef<HTMLElement>('pathTrack')
const clipped = shallowRef(false)

function measure() {
  const el = pathTrack.value
  if (el) clipped.value = el.scrollWidth > el.clientWidth + 1
}

useResizeObserver(pathTrack, measure)
watch([baseUrl, () => props.path], () => void nextTick(measure))

const segment = 'min-h-9 cursor-copy touch-manipulation select-text rounded-sm px-1.5 py-1.5 text-left font-mono text-sm decoration-1 underline-offset-4 transition-colors hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary @md/target:min-h-0 @md/target:px-1 @md/target:py-0'

/**
 * The two atomic units. `flex-nowrap` is the whole contract: it makes the row's
 * only break point the boundary between them. Both keep `min-w-0` so a long
 * host or path degrades inside its own unit instead of overflowing the page.
 *
 * `flex-basis: auto` on both is deliberate — flex line breaking compares the
 * items' HYPOTHETICAL main sizes, so a basis of `auto` is what makes the wrap
 * decision read the real content width. A `flex-1` (basis `0%`) here would
 * collapse that signal and the row would never break.
 */
const rowGroup = 'flex min-w-0 flex-nowrap items-center gap-1'
// Origin does not grow: on one line the address stays packed to the leading edge.
const originGroup = `${rowGroup} flex-[0_1_auto]`
// Operation claims the leftover so the copy action parks at the trailing edge.
const operationGroup = `${rowGroup} flex-[1_1_auto]`

// Host gives the picker line a readable remainder, then truncates before path.
const hostSegment = 'min-w-[6ch] flex-[1_1_auto] truncate text-muted hover:text-default'

/**
 * Path keeps its identity and scrolls inside its own unit when truly necessary.
 *
 * There is no host/path rule any more. A separator asserts "these two are
 * adjacent", which only CSS that knows the current line can honestly say —
 * and content-derived wrapping deliberately does not. The old breakpoint-bound
 * `border-l` proved the point: between the container breakpoint and the width
 * where the content actually fit, it painted a stray tick at the START of the
 * second line. The muted/highlighted colour step already carries the seam.
 */
const pathSegment = 'min-w-0 flex-[0_1_auto] overflow-x-auto text-highlighted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
</script>

<template>
  <div class="@container/target flex flex-wrap items-center gap-1 rounded-md border border-default bg-elevated p-1">
    <!-- Unit 1 — origin: the picker and the host it changes. Grouping them is
         what makes "environment + host" a layout fact instead of a coincidence
         of the current wrap. Visual, DOM and keyboard order stay identical. -->
    <div data-target-origin :class="originGroup">
      <USelect
        v-if="props.hosts.length > 1"
        v-model="selectedId"
        :items="selectItems"
        :aria-label="props.selectLabel ?? 'Environment'"
        size="sm"
        variant="soft"
        class="shrink-0"
      />

      <UTooltip :text="hostCopied ? t.copiedHost : t.copyHost">
        <button
          type="button"
          :class="[segment, hostSegment]"
          :aria-label="hostCopied ? t.copiedHost : t.copyHost"
          @click="onCopyHost"
        ><code translate="no">{{ baseUrl }}</code></button>
      </UTooltip>
    </div>

    <!-- Unit 2 — operation: the path and the action that copies the whole
         address it completes. They are ONE unit precisely because a copy button
         stranded on a line of its own answers no question. -->
    <div data-target-operation :class="operationGroup">
      <UTooltip :text="pathCopied ? t.copiedPath : t.copyPath">
        <button
          ref="pathTrack"
          type="button"
          :class="[
            segment,
            pathSegment,
            clipped ? '[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]' : undefined,
          ]"
          :aria-label="pathCopied ? t.copiedPath : t.copyPath"
          @click="onCopyPath"
        ><code translate="no" class="block whitespace-nowrap">{{ props.path }}</code></button>
      </UTooltip>

      <!-- The row's PRIMARY action, hence last: `ml-auto` claims any leftover
           space so it parks at the trailing edge in both layouts. Being last in
           the DOM too, it is last for the keyboard as well, with no `order` to
           desync the two. It sits outside the path's scroll area on purpose,
           because the task is to GET the address, not read it — it must never
           scroll away.
           The classes live on this wrapper, NOT on <CopyButton>: that component
           is multi-root (button + its aria-live status span), so Vue has no
           single host to fall through to and a `class` passed to it is dropped
           silently. The wrapper also keeps the status span travelling with its
           button instead of becoming a stray flex item. -->
      <span class="ml-auto flex shrink-0">
        <CopyButton
          :value="fullAddress"
          :success-message="t.copied"
          :failure-message="t.copyFailed"
          :label="t.copy"
          :copied-label="t.copied"
          size="sm"
        />
      </span>
    </div>

    <!-- ONE polite region for both segments: they answer the same question
         ("what did I just copy?"), and two regions would compete. -->
    <span role="status" aria-live="polite" class="sr-only">{{ segmentStatus }}</span>
  </div>
</template>
