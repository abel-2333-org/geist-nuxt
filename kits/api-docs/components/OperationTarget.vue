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
// Anatomy (narrow container, wraps to two lines):
//   [ USelect | host ..................................................... ]
//   [ path ........................................... CopyButton ]
// One bordered `bg-elevated` row with EXACTLY ONE copy button, which copies the
// whole address.
//
// Why one and not three: the row previously offered host-only and path-only
// copy buttons alongside it. The real task on this page is "get the address I
// can paste into curl" — the segments are ways to READ that address, not
// separate things people fetch. Three identical, unlabelled icons of equal
// weight made the row read as three peer choices for one job, and the cost
// landed hardest exactly where the row is smallest: the segment buttons were
// hover-revealed, but hover does not exist on touch, so `pointer-coarse` had to
// show them permanently and mobile got all three at once, the primary one
// visually indistinguishable from the path's own. Rare segment-level needs are
// already served without any chrome, because both halves stay real selectable
// <code> text.
//
// The one CopyButton is always the row's LAST element — in the DOM, on screen
// and for the keyboard alike — and sits outside every scroll area, so it is
// reachable no matter how far the path is scrolled. The wrap is produced by a
// full-width breaker span rather than by `order`, precisely so those three
// orders can never drift apart.
//
// Narrow-container degradation is ASYMMETRIC, and deliberately so:
//   - host is an ENVIRONMENT property. Every endpoint on the site shares it,
//     and the select to its left already names it ("生产" / "沙箱"), so it is
//     the most redundant text in the row → it truncates first, keeping a
//     `min-w-[6ch]` readable floor on the TEXT (never an empty shell).
//   - path is the OPERATION'S IDENTITY. It is why this page is this page →
//     never truncated. Below the `md` container width it gets its own full
//     line rather than fighting the host for a few characters; only if it
//     still doesn't fit does the path text itself scroll horizontally, made
//     honest by a right-edge fade (measured, not decorative — present only
//     when actually clipped).
//
// Sizing follows the component's OWN width, not the viewport: this row lives in
// the left pane of a user-draggable SplitPane (see DocsShellReference), so
// viewport breakpoints have no stable relation to the space it actually has.
// Hence the named container `@container/target` + `@md/target:` variants,
// matching the `@container/response` convention in <ApiDocsResponseExample>.
//
// States:   selected host (v-model, defaults to the first host); path track
//           clipped/not; copy idle/copied is owned by <CopyButton>/useCopy.
// A11y:     the select carries an aria-label; addresses stay real selectable
//           <code> text (segments are NOT buttons — that would destroy text
//           selection, which is what makes segment-level copying possible at
//           all); the truncated host keeps its full value in `title`, and the
//           copy value is always the FULL address regardless of truncation or
//           scroll position, so nothing degrades for keyboard or screen-reader
//           users.

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
  /** Accessible name for the copy button, e.g. "复制完整地址". */
  copy?: string
  /** Accessible name shown right after a successful copy. */
  copied?: string
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

    <!-- host segment — the part that gives way: it shrinks and truncates, with
         a `min-w-[6ch]` floor so it degrades to a legible "https…" rather than
         a useless "h…". Dimmed (`text-muted`) against the path's
         `text-highlighted`, which is what carries the environment-supplied vs
         operation-owned distinction now that no per-segment chrome does.
         `flex-initial` (`0 1 auto`) — shrink but never GROW — so the trailing
         button's `ml-auto` keeps the leftover space and stays pinned right.
         Use the `flex` SHORTHAND, not a `grow-0`/`basis-auto` longhand: a
         longhand loses to any `flex-1` on source order and silently does
         nothing, which is exactly how the button once drifted mid-row. -->
    <code
      class="min-w-[6ch] flex-initial truncate px-1 font-mono text-sm text-muted"
      :title="baseUrl"
    >{{ baseUrl }}</code>

    <!-- STACKED-only line breaker. A zero-height, full-width flex item is the
         only way to force a wrap at an exact point, and it is what lets DOM
         order stay the natural reading order (host → path → copy-all). The
         obvious alternative — keeping the button before the path and flipping
         it with `order-last` — is a trap: `order` moves the BOX but never the
         tab sequence, so it silently desynchronises focus from what is on
         screen. Ordering the DOM correctly and breaking the LINE instead keeps
         visual, DOM and tab order identical at every width. -->
    <span aria-hidden="true" class="w-full @md/target:hidden" />

    <!-- path segment — the operation's identity, so it never truncates.
         MOBILE-FIRST it starts its own line (see the breaker above), because
         squeezing both halves onto one narrow line leaves the host a useless
         stub AND pushes the identity out of sight — strictly worse than two
         honest lines. From the `md` CONTAINER width up the breaker is removed
         from the flow and it rejoins the host on one line, where the hairline
         (environment-supplied vs operation-owned) finally reads as a real
         boundary. -->
    <!-- path segment — the operation's identity, so it never truncates. Below
         the `md` container width it takes its own line (see the breaker above);
         only if it STILL doesn't fit does the text scroll horizontally.
         The shrink ladder and the scroll container may share this one element
         (`flex-initial` + `overflow-x-auto` + `min-w-0`): a scroll container's
         automatic minimum size is 0, so it shrinks below max-content instead of
         pushing the button out of the row. That only broke back when the track
         was WRAPPED in another flex line holding a segment copy button, because
         the wrapper then sized to max-content and cancelled the shrink — with
         the extra button gone, so is the extra element.
         Scrollbar is hidden (this row is ~2rem tall); the measured fade is what
         signals "there is more". -->
    <div
      ref="pathTrack"
      class="min-w-0 flex-initial overflow-x-auto border-default px-1 [scrollbar-width:none] @md/target:border-l @md/target:pl-2 [&::-webkit-scrollbar]:hidden"
      :class="clipped
        ? '[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]'
        : undefined"
    >
      <code class="block whitespace-nowrap font-mono text-sm text-highlighted">{{ props.path }}</code>
    </div>

    <!-- The row's ONE action, hence last: `ml-auto` claims all leftover space so
         it parks at the trailing edge in both layouts (which is why neither
         segment may GROW). Being last in the DOM too, it is last for the
         keyboard as well, with no `order` to desync the two. It also sits
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
  </div>
</template>
