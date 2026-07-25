<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

// Domain component (API docs): the "where do I call this" line of an endpoint
// reference — environment host picker + the request address. Sits directly
// under <ApiDocsOperationHeader>.
//
// Scope note: this component is calibrated for ENDPOINTS (you call the
// platform). For webhooks the "target" is the consumer's own subscription URL
// — a sentence of copy, not an address bar — so webhook headers should NOT
// force this component in.
//
// Anatomy (wide container, one line):
//   [ USelect (env, only when hosts > 1) | host │ path ......... CopyButton ]
// Anatomy (narrow container — controls row + address card):
//   [ USelect ............................................................ ]
//   ────────────────────────────────────────────────────────────── hairline
//   [ host ............................................................... ]
//   [ path .......................................... CopyButton ]
//
// Three copy intents, three DIFFERENT affordances — the row does not offer
// three peer icons:
//   - host / path: the TEXT itself is the control. Click (or Enter/Space when
//     focused) copies that segment, so a segment costs no chrome at any width
//     and works on touch, where hover-revealed icons never existed.
//   - whole address: the one explicit <CopyButton>, because "paste this into
//     curl" is the row's primary task and must stay visible and labelled.
// Segment buttons keep `select-text` and skip the copy when the click ends a
// real text selection inside them, so drag-selecting a substring still works
// instead of firing a copy the user did not ask for.
//
// The CopyButton is always the row's LAST element — in the DOM, on screen and
// for the keyboard alike — and sits outside every scroll area, so it is
// reachable no matter how far the path is scrolled. Wraps come from zero-height
// full-width breaker spans rather than `order`, precisely so those three orders
// can never drift apart.
//
// Narrow-container degradation is ASYMMETRIC, and deliberately so:
//   - host is an ENVIRONMENT property. Every endpoint on the site shares it,
//     and the select above it already names it ("生产" / "沙箱"), so it is the
//     most redundant text in the row → it truncates first, keeping a
//     `min-w-[6ch]` readable floor on the TEXT (never an empty shell).
//   - path is the OPERATION'S IDENTITY. It is why this page is this page →
//     never truncated. Below the `md` container width it gets its own full
//     line; only if it still doesn't fit does the path text itself scroll
//     horizontally, made honest by a right-edge fade (measured, not
//     decorative — present only when actually clipped).
// The environment select also leaves the address line entirely below `md`, so
// touch gets one purpose per row instead of three controls fighting for width.
//
// Sizing follows the component's OWN width, not the viewport: this row lives in
// the left pane of a user-draggable SplitPane (see DocsShellReference), so
// viewport breakpoints have no stable relation to the space it actually has.
// Hence the named container `@container/target` + `@md/target:` variants,
// matching the `@container/response` convention in <ApiDocsResponseExample>.
//
// States:   selected host (v-model, defaults to the first host); path track
//           clipped/not; three independent copied pulses.
// A11y:     the select carries an aria-label; every copy control is a real
//           <button> with a dynamic accessible name (idle/copied) and the
//           system `focus-visible` ring; segment results are announced through
//           ONE shared polite live region (the CopyButton owns its own); the
//           truncated host keeps its full value in `title`, and every copy
//           value is the untruncated data regardless of scroll position.

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
 * convention used by <ApiDocsCodeBlock>.
 */
export interface ApiTargetLabels {
  /** Accessible name for the whole-address copy button, e.g. "复制完整地址". */
  copy?: string
  /** Accessible name shown right after the whole address is copied. */
  copied?: string
  /** Accessible name for the host segment, e.g. "复制 host". */
  copyHost?: string
  /** Accessible name shown right after the host is copied. */
  copiedHost?: string
  /** Accessible name for the path segment, e.g. "复制 path". */
  copyPath?: string
  /** Accessible name shown right after the path is copied. */
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
    /** Toast object name for the whole-address copy, e.g. "Endpoint". */
    copyToastLabel?: string
    /** Toast object name for the host copy, e.g. "Host". */
    hostToastLabel?: string
    /** Toast object name for the path copy, e.g. "Path". */
    pathToastLabel?: string
    /** Overridable UI copy for localization. See ApiTargetLabels. */
    labels?: ApiTargetLabels
  }>(),
  { labels: () => ({}) },
)

const selected = defineModel<string>()

// Merge caller copy over neutral English defaults. Chrome text only.
const t = computed<Required<ApiTargetLabels>>(() => ({
  copy: 'Copy endpoint',
  copied: 'Copied',
  copyHost: 'Copy host',
  copiedHost: 'Host copied',
  copyPath: 'Copy path',
  copiedPath: 'Path copied',
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

const segmentStatus = computed(() => {
  if (hostCopied.value) return t.value.copiedHost
  if (pathCopied.value) return t.value.copiedPath
  return ''
})

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

function onCopyHost(event: MouseEvent) {
  if (selecting(event)) return
  void writeHost(baseUrl.value, { label: props.hostToastLabel ?? 'Host' })
}

function onCopyPath(event: MouseEvent) {
  if (selecting(event)) return
  void writePath(props.path, { label: props.pathToastLabel ?? 'Path' })
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

/** Shared look of the two text-as-control segments. */
const segment = 'cursor-pointer select-text rounded-sm px-1 text-left font-mono text-sm transition-colors hover:bg-accented focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
</script>

<template>
  <div class="@container/target flex flex-wrap items-center gap-1 rounded-md border border-default bg-elevated p-1">
    <USelect
      v-if="props.hosts.length > 1"
      v-model="selectedId"
      :items="selectItems"
      :aria-label="props.selectLabel ?? 'Environment'"
      size="sm"
      variant="soft"
      class="shrink-0"
    />

    <!-- Controls/address divider — STACKED only. A zero-height, full-width flex
         item is the only way to force a wrap at an exact point; the hairline is
         what turns the two halves into "controls row + address card" without a
         second nested container (which would size to max-content and cancel the
         shrink ladder below). Nothing to read, hence aria-hidden. -->
    <span
      v-if="props.hosts.length > 1"
      aria-hidden="true"
      class="w-full border-t border-default @md/target:hidden"
    />

    <!-- host segment — the part that gives way: it shrinks and truncates, with
         a `min-w-[6ch]` floor so it degrades to a legible "https…" rather than
         a useless "h…". Dimmed (`text-muted`) against the path's
         `text-highlighted`, carrying the environment-supplied vs
         operation-owned distinction.
         `flex-initial` (`0 1 auto`) — shrink but never GROW — so the trailing
         button's `ml-auto` keeps the leftover space and stays pinned right.
         Use the `flex` SHORTHAND, not a `grow-0`/`basis-auto` longhand: a
         longhand loses to any `flex-1` on source order and silently does
         nothing, which is exactly how the button once drifted mid-row. -->
    <button
      type="button"
      :class="[segment, 'min-w-[6ch] flex-initial truncate text-muted hover:text-default']"
      :title="baseUrl"
      :aria-label="hostCopied ? t.copiedHost : t.copyHost"
      @click="onCopyHost"
    ><code>{{ baseUrl }}</code></button>

    <!-- STACKED-only line breaker, so DOM order stays the natural reading order
         (host → path → copy-all). The obvious alternative — keeping the button
         before the path and flipping it with `order-last` — is a trap: `order`
         moves the BOX but never the tab sequence, so it silently desynchronises
         focus from what is on screen. Ordering the DOM correctly and breaking
         the LINE instead keeps visual, DOM and tab order identical. -->
    <span aria-hidden="true" class="w-full @md/target:hidden" />

    <!-- path segment — the operation's identity, so it never truncates. Below
         the `md` container width it takes its own line (see the breaker above);
         only if it STILL doesn't fit does the text scroll horizontally.
         The shrink ladder and the scroll container share this one element
         (`flex-initial` + `overflow-x-auto` + `min-w-0`): a scroll container's
         automatic minimum size is 0, so it shrinks below max-content instead of
         pushing the copy button out of the row.
         Scrollbar is hidden (this row is ~2rem tall); the measured fade is what
         signals "there is more". -->
    <button
      ref="pathTrack"
      type="button"
      :class="[
        segment,
        'min-w-0 flex-initial overflow-x-auto border-default text-highlighted [scrollbar-width:none] @md/target:border-l @md/target:pl-2 [&::-webkit-scrollbar]:hidden',
        clipped ? '[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]' : undefined,
      ]"
      :aria-label="pathCopied ? t.copiedPath : t.copyPath"
      @click="onCopyPath"
    ><code class="block whitespace-nowrap">{{ props.path }}</code></button>

    <!-- The row's PRIMARY action, hence last: `ml-auto` claims all leftover
         space so it parks at the trailing edge in both layouts (which is why
         neither segment may GROW). Being last in the DOM too, it is last for
         the keyboard as well, with no `order` to desync the two. It also sits
         outside the path's scroll area on purpose, because the task is to GET
         the address, not read it — it must never scroll away.
         The classes live on this wrapper, NOT on <CopyButton>: that component
         is multi-root (button + its aria-live status span), so Vue has no
         single host to fall through to and a `class` passed to it is dropped
         silently. The wrapper also keeps the status span travelling with its
         button instead of becoming a stray flex item. -->
    <span class="ml-auto flex shrink-0">
      <CopyButton
        :value="fullAddress"
        :toast-label="props.copyToastLabel ?? 'Endpoint'"
        :label="t.copy"
        :copied-label="t.copied"
        size="sm"
      />
    </span>

    <!-- ONE polite region for both segments: they answer the same question
         ("what did I just copy?"), and two regions would compete. -->
    <span role="status" aria-live="polite" class="sr-only">{{ segmentStatus }}</span>
  </div>
</template>
