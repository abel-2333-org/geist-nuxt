<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

// Domain component (API docs): the "where do I call this" line of an endpoint
// reference — environment host picker + the request address, split into its two
// meaningful halves, each separately copyable. Sits directly under
// <ApiDocsOperationHeader>.
//
// Scope note: this component is calibrated for ENDPOINTS (you call the
// platform). For webhooks the "target" is the consumer's own subscription URL
// — a sentence of copy, not an address bar — so webhook headers should NOT
// force this component in.
//
// Anatomy:  [ USelect (env, only when hosts > 1) | ‹host ⧉ │ path ⧉› | CopyButton ]
//           one bordered `bg-elevated` row. The middle is a scroll track
//           holding two segments; the trailing CopyButton takes the whole
//           address and lives OUTSIDE the track, so it is reachable no matter
//           how far the address is scrolled.
//
// Narrow-screen degradation is ASYMMETRIC, and deliberately so:
//   - host is an ENVIRONMENT property. Every endpoint on the site shares it,
//     and the select to its left already names it ("生产" / "沙箱"), so it is
//     the most redundant text in the row → it truncates first, keeping a
//     `min-w-[5ch]` readable floor (never an empty shell).
//   - path is the OPERATION'S IDENTITY. It is why this page is this page →
//     `shrink-0`, never truncated.
//   Only when host has hit its floor and the path still doesn't fit does the
//   track scroll horizontally. Overflow is then made honest with a right-edge
//   fade (measured, not decorative — it appears only when actually clipped).
//
// Sizing follows the component's OWN width, not the viewport: this row lives in
// the left pane of a user-draggable SplitPane (see DocsShellReference), so
// viewport breakpoints have no stable relation to the space it actually has.
// The ladder is pure flex shrink (continuous, no breakpoints, no JS); `@container`
// is declared on the root for container-relative tweaks.
//
// States:   selected host (v-model, defaults to the first host); per-segment
//           copy affordance idle/revealed; track clipped/not; copy idle/copied
//           is owned by <CopyButton>/useCopy.
// A11y:     the select carries an aria-label; addresses stay real selectable
//           <code> text (segments are NOT buttons — that would destroy text
//           selection); the truncated host keeps its full value in `title` and
//           its copy button still copies the FULL baseUrl, so nothing degrades
//           for keyboard or screen-reader users; each of the three copy buttons
//           has a distinct accessible name; segment buttons always occupy their
//           slot and only animate opacity (no layout shift), and are shown
//           persistently on coarse pointers, which have no hover.

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
  /** Accessible name for the host-only copy button. */
  copyHost?: string
  /** Accessible name for the path-only copy button. */
  copyPath?: string
  /** Object name in the host copy toast, e.g. 'Host' → "Host copied…". */
  hostToast?: string
  /** Object name in the path copy toast. */
  pathToast?: string
  /** Accessible name shown right after any successful copy. */
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
  copyHost: 'Copy host',
  copyPath: 'Copy path',
  hostToast: 'Host',
  pathToast: 'Path',
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

/** Segment copy button: placeholder-stable, hover/focus on fine pointers,
 *  always visible on coarse ones (touch has no hover). */
const revealOnHover
  = 'flex shrink-0 opacity-0 transition-opacity duration-150 motion-reduce:transition-none'
    + ' group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100'
</script>

<template>
  <div class="@container flex flex-wrap items-center gap-1 rounded-md border border-default bg-elevated p-1">
    <USelect
      v-if="props.hosts.length > 1"
      v-model="selectedId"
      :items="selectItems"
      :aria-label="props.selectLabel ?? 'Environment'"
      size="sm"
      variant="soft"
      class="shrink-0"
    />

    <!-- host segment — the part that gives way. It shrinks and truncates; the
         floor lives on the TEXT (6ch keeps "https…" legible), because on the
         segment the copy button's reserved slot eats the whole budget and the
         host collapses to "h…" — a floor that guarantees nothing. -->
    <div class="group flex min-w-0 shrink items-center gap-0.5 rounded-sm px-1 transition-colors hover:bg-accented/50 focus-within:bg-accented/50">
      <code
        class="min-w-[6ch] truncate font-mono text-sm text-muted"
        :title="baseUrl"
      >{{ baseUrl }}</code>
      <span :class="revealOnHover">
        <CopyButton
          :value="baseUrl"
          :toast-label="t.hostToast"
          :label="t.copyHost"
          :copied-label="t.copied"
          size="xs"
        />
      </span>
    </div>

    <!-- path segment — the operation's identity, so it never truncates.
         Below a 30rem CONTAINER it takes a line of its own (`order-last` +
         `basis-full`): squeezing both halves onto one narrow line leaves the
         host as a useless stub AND pushes the identity out of sight, which is
         strictly worse than two honest lines. Wrapping also keeps DOM order
         equal to visual order, so tab order needs no fixing.
         The hairline (environment-supplied vs operation-owned) only reads as a
         boundary while the two sit side by side, so it drops when stacked. -->
    <div class="group flex min-w-0 items-center gap-0.5 rounded-sm border-default pl-1 pr-1 transition-colors @min-[30rem]:border-l @min-[30rem]:pl-2 @max-[30rem]:order-last @max-[30rem]:basis-full hover:bg-accented/50 focus-within:bg-accented/50">
      <!-- Only the path TEXT scrolls, never its copy button. Note the two jobs
           must live on different elements: `overflow-x-auto` makes a flex line
           size to max-content, which silently disables `shrink` on its items —
           putting the shrink ladder and the scroll fallback on one element
           makes them cancel out. Scrollbar is hidden (this row is ~2rem tall);
           the measured fade is what signals "there is more". -->
      <div
        ref="pathTrack"
        class="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        :class="clipped
          ? '[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]'
          : undefined"
      >
        <code class="block whitespace-nowrap font-mono text-sm text-highlighted">{{ props.path }}</code>
      </div>
      <span :class="revealOnHover">
        <CopyButton
          :value="props.path"
          :toast-label="t.pathToast"
          :label="t.copyPath"
          :copied-label="t.copied"
          size="xs"
        />
      </span>
    </div>

    <!-- Whole address. `ml-auto` pins it to the trailing edge, and it sits
         outside every scroll area on purpose: the primary task is to GET the
         address, not to read it, so this must never scroll away. -->
    <CopyButton
      :value="fullAddress"
      :toast-label="props.copyToastLabel ?? 'Endpoint'"
      size="sm"
      class="ml-auto"
    />
  </div>
</template>
