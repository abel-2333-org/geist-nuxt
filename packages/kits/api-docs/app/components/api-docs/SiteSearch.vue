<script setup lang="ts">
// Domain component (API docs): SITE-WIDE docs search — a trigger button in the
// app's top bar that opens a ⌘K command palette over the documentation index
// (guide pages + purpose-named endpoints).
//
// Layering (the reason this exists as its own slice): ApiDocsSidebarNav's top
// input filters the nav tree IN PLACE ('/' focuses it); this component answers
// the other question — "take me anywhere in the docs from anywhere" — and lives
// in the app's top bar, a different level, never stacked in the sidebar as a
// second look-alike box (rationale: sidebar-nav.md). The two deliberately match
// on the SAME dimensions — purpose label, HTTP method, business scenario — so a
// reader's mental model of "what is searchable" holds at both levels.
//
// Data-agnostic by design: it eats a docs-index array (no @nuxt/content or any
// content-pipeline dependency), so it works in the gallery, the starter, and
// any consumer regardless of how their docs are stored. A project that does run
// @nuxt/content can swap in UContentSearch behind the same trigger; the base
// never takes that dependency.
//
// Anatomy — composed from Nuxt UI primitives + this kit's ApiDocsMethodBadge:
//   trigger   UButton (search icon · label, hidden below sm · ⌘K UKbd hint)
//   modal     UModal (#content mode; `title` renders as a visually-hidden
//             DialogTitle so the dialog keeps an accessible name)
//   palette   UCommandPalette — input (autofocus) · grouped results · empty
//             state. Items: endpoints lead with ApiDocsMethodBadge and carry
//             scenario tags in the suffix; guide pages lead with their icon.
//
// State model:
//   closed → open        trigger click or the shortcut (toggle — pressing it
//                        again closes; fires even while typing in another
//                        input via usingInput, so the sidebar filter can't
//                        swallow it)
//   open   → closed      Esc / overlay click (UModal built-ins), or selecting
//                        an item (onSelect closes, navigation rides on `to`;
//                        the query resets so the next open starts clean)
//   searching            fuse token-search over label + suffix + method +
//                        scenarios — "订阅" or "POST" surface endpoints, and
//                        multi-word queries ("结算 POST") intersect facets;
//                        matched text is highlighted in results (palette
//                        built-in), capped at `resultLimit`
//   no-results           palette's built-in empty state (label via prop)
//
// A11y: focus trap + restore-to-trigger come from UModal; the palette input
// autofocuses on open; results are listbox semantics (reka-ui). The trigger
// text hides below sm, so `ariaLabel` keeps its accessible name. ⌘K is
// registered via defineShortcuts (usingInput-safe by Nuxt UI's defaults for
// meta combos).
//
// Self-contained per the kit slice convention: the index data model travels
// inline; all copy is passed in via props (content-agnostic, i18n-ready). The
// one sibling dependency is ApiDocsMethodBadge (declared in registry.json).

import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

/** One destination in the docs index. Either a guide page (optional `icon`) or
 *  an endpoint: purpose-name `label` + `method` badge + `scenarios` facets —
 *  the same shape those fields have in ApiDocsSidebarNav, so one nav dataset
 *  can feed both (see the gallery docs-shell demo for the mapping). */
export interface SiteSearchItem {
  /** Visible label (already localized). Purpose name for endpoints. */
  label: string
  /** Destination (route or #anchor); rendered as a link, so prefetch works. */
  to: string
  /** HTTP method (e.g. 'POST') → leading ApiDocsMethodBadge. Endpoint-only. */
  method?: string
  /** Business scenarios (e.g. ['订阅', '授权']) → joined into the suffix and
   *  fuse-searchable, so typing a scenario name surfaces the endpoint. */
  scenarios?: string[]
  /** Leading Iconify icon (guide pages). Ignored when `method` is present. */
  icon?: string
  /** Optional extra description; shown after the label, also searchable. */
  suffix?: string
}

/** A labelled result group (mirrors the sidebar's guide/endpoints boundary). */
export interface SiteSearchGroup {
  /** Stable id (used as the palette group id). */
  id: string
  /** Group heading (already localized). */
  label: string
  items: SiteSearchItem[]
}

const props = withDefaults(
  defineProps<{
    /** The docs index to search over. */
    groups: SiteSearchGroup[]
    /** Trigger button text (hidden below sm; `ariaLabel` covers that case). */
    triggerLabel: string
    /** Accessible name for the trigger (falls back to `triggerLabel`). */
    ariaLabel?: string
    /** Visually-hidden dialog title (screen readers announce it on open). */
    modalTitle: string
    /** Palette input placeholder. */
    placeholder: string
    /** Shown when a query matches nothing. */
    emptyLabel: string
    /** Joins `scenarios` into the item suffix. Matches ApiDocsSidebarNav's
     *  same-named prop so the two levels read consistently. */
    scenarioSeparator?: string
    /** Shortcut that toggles the palette (defineShortcuts syntax). */
    shortcut?: string
    /** Max results shown while searching (keeps long indexes scannable). */
    resultLimit?: number
    /** Extra palette groups appended after the docs index (e.g. quick links
     *  or a theme switcher, mirroring UContentSearch's links/theme groups).
     *  Labels arrive already localized, per the kit's copy-agnostic rule. */
    extraGroups?: CommandPaletteGroup<CommandPaletteItem>[]
  }>(),
  {
    ariaLabel: undefined,
    scenarioSeparator: '、',
    shortcut: 'meta_k',
    resultLimit: 12,
    extraGroups: () => [],
  },
)

const open = ref(false)

// Same-page hash destinations need help, twice over: (1) while the modal is
// up, reka-ui locks body scroll, so the router's hash navigation can't scroll;
// (2) on close, the dialog's focus restore puts focus back on the trigger —
// scrolling the page right back to the top bar, cancelling any scroll we did.
// So when a hash item is selected we intercept `closeAutoFocus`, prevent the
// restore-to-trigger, and hand BOTH focus and scroll to the target section
// (focus moves to the destination — where the user is going — which is also
// the better a11y outcome). Honors prefers-reduced-motion.
const pendingHashId = ref<string | null>(null)

function trackHashDestination(to: string) {
  const hashIndex = to.indexOf('#')
  pendingHashId.value = hashIndex === -1 ? null : to.slice(hashIndex + 1) || null
}

function onCloseAutoFocus(event: Event) {
  const id = pendingHashId.value
  pendingHashId.value = null
  if (!id) return
  const el = document.getElementById(id)
  if (!el) return
  event.preventDefault()
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

// Query is held here (v-model into the palette) so it can reset on select —
// the next open starts clean instead of replaying a stale filter.
const searchTerm = ref('')

// Toggle (not just open): the shortcut while the palette is up dismisses it,
// matching the muscle memory of other ⌘K palettes. usingInput: fire even while
// the user is typing elsewhere (e.g. the sidebar's in-tree filter) — same as
// UContentSearch, otherwise the two search levels fight over the shortcut.
defineShortcuts(
  computed(() => ({
    [props.shortcut]: {
      usingInput: true,
      handler: () => {
        open.value = !open.value
      },
    },
  })),
)

// Map the docs index into palette groups. `method`/`scenarios` ride along as
// extension keys: fuse searches them (see :fuse below) and #item-leading reads
// `method` to render the badge. Scenarios also join into the visible suffix so
// the facet is readable, not just matchable.
const paletteGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() =>
  props.groups.map(group => ({
    id: group.id,
    label: group.label,
    items: group.items.map(item => ({
      label: item.label,
      suffix: [item.suffix, item.scenarios?.join(props.scenarioSeparator)]
        .filter(Boolean)
        .join(' · '),
      to: item.to,
      icon: item.method ? undefined : item.icon,
      method: item.method,
      scenarios: item.scenarios,
      onSelect: () => {
        trackHashDestination(item.to)
        open.value = false
        searchTerm.value = ''
      },
    })),
  })).concat(props.extraGroups),
)

// Default fuse keys are label/description/suffix; add method + scenarios so
// "POST" or a scenario name matches — the same dimensions the sidebar's
// in-tree filter matches on. includeMatches + useTokenSearch mirror
// UContentSearch's defaults: matched text gets highlighted in results, and
// multi-word queries token-search (each word must match — "结算 POST"
// intersects purpose and method). resultLimit keeps long indexes scannable.
const fuse = computed(() => ({
  fuseOptions: {
    ignoreLocation: true,
    includeMatches: true,
    useTokenSearch: true,
    threshold: 0.1,
    keys: ['label', 'suffix', 'method', 'scenarios'],
  },
  resultLimit: props.resultLimit,
}))
</script>

<template>
  <UModal v-model:open="open" :title="props.modalTitle" :content="{ onCloseAutoFocus }">
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      class="text-muted"
      :aria-label="props.ariaLabel ?? props.triggerLabel"
    >
      <UIcon name="i-lucide-search" class="size-4" />
      <span class="max-sm:hidden">{{ props.triggerLabel }}</span>
      <span class="flex items-center gap-0.5">
        <UKbd value="meta" />
        <UKbd value="K" />
      </span>
    </UButton>

    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="paletteGroups"
        :placeholder="props.placeholder"
        :fuse="fuse"
        close
        @update:open="open = $event"
      >
        <template #item-leading="{ item }">
          <ApiDocsMethodBadge v-if="item.method" :method="item.method" />
          <UIcon v-else-if="item.icon" :name="item.icon" class="size-4 shrink-0 text-dimmed" />
        </template>
        <template #empty>
          <div class="py-6 text-center text-sm text-muted">{{ props.emptyLabel }}</div>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
