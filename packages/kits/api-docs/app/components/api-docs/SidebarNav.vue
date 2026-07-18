<script setup lang="ts">
// Domain component (API docs): a documentation sidebar where ONE menu holds
// several sections whose destination pages differ in nature. Two axes keep the
// two worlds visually distinct so guides never blur into endpoint lists:
//
//   1. Grouping layer — sections are gathered under labelled groups
//      ("Documentation", "API reference"). Each group prints an eyebrow label
//      and a hairline divider, so the menu reads as two territories, not one
//      flat pile.
//   2. Section typing — `kind` drives the header treatment, using typography
//      (not colour) so primary stays reserved for the active state:
//        · guide     → sentence-case, font-sans, soft; items are icon + label.
//        · endpoints → UPPER MONO with tracking; items pair a LEADING HTTP
//                      method badge with a PURPOSE-named label (not a path) and
//                      optional TRAILING scenario tags.
//
// Endpoints are named by use case, not by REST path: our APIs aren't strictly
// RESTful and one endpoint often serves several business scenarios
// (subscriptions, authorization, …). So an endpoint appears ONCE. Its single
// request method rides as a leading method badge ("how you call it"), while the
// scenarios it serves ride as quiet trailing neutral tags ("what it's for") —
// the purpose label sits in between.
//
// Sections are independently collapsible (multiple open at once), each carries
// a count, and a single top search filters across every section so a large
// section stays reachable without scrolling. The query matches both the
// purpose label and the scenario tags, so typing a scenario name (e.g.
// "订阅") surfaces every endpoint that serves it.
//
// In-tree search vs. site-wide search are kept orthogonal. This component only
// does the former (filter the nav tree in place). Site-wide ⌘K full-text search
// over @nuxt/content belongs in the app's top bar — a different level, not
// stacked in the sidebar as a second look-alike box. An optional #header slot
// remains for consumers who genuinely need an entry at the top of the nav; the
// base never takes a hard @nuxt/content dependency and stays data-agnostic.
//
// The nav is width-resizable (lg+ progressive enhancement): a drag handle on
// the right edge sets the width, clamped to [minWidth, maxWidth] and persisted
// to localStorage so a reader's preferred width survives reloads. Mouse drag +
// keyboard (←/→, Shift, Home/End) on a role="separator" affordance; double-click
// resets to the default. Below lg the nav takes full container width. Opt out
// with :resizable=false.
//
// Composed from Nuxt UI primitives + this kit's ApiDocsMethodBadge:
//   root        <nav> — sticky, own scroll area (a long menu scrolls here, not
//                       the page); reduced-motion honored globally by the layer
//   search      UInput + UKbd hint  (global filter, '/' focuses, Esc clears)
//   group       eyebrow label + divider  (the guide/endpoints boundary)
//   section     UCollapsible → trigger row (chevron · label · count badge)
//                              → content (a stack of item rows)
//   item        ULink — guide (icon + label) or endpoint (leading method badge
//                       + purpose label + width-adaptive trailing scenario tags)
//   resizer     right-edge separator, lg+ (mouse + keyboard, dbl-click resets), width → localStorage
//
// Self-contained per the kit slice convention: the nav data model travels
// inline with the component; all copy is passed in via props (content-agnostic,
// i18n-ready). The one sibling dependency is ApiDocsMethodBadge (declared in
// registry.json), reached by auto-import across the layer; scenario tags are
// plain neutral UBadges.

/** A single leaf link. Either a guide entry (optional `icon`) or an endpoint:
 *  a leading `method` badge + a purpose-name `label` (e.g. "Create checkout
 *  session") + the business `scenarios` it serves as trailing tags. */
export interface SidebarNavItem {
  /** Visible label (already localized). For endpoints this is the purpose
   *  name, NOT the path — our APIs are named by use case, so the path is not a
   *  good menu label. */
  label: string
  /** Destination route; rendered with ULink so active state + prefetch work. */
  to?: string
  /** Single HTTP request method (e.g. 'POST') → leading ApiDocsMethodBadge.
   *  How you call this endpoint; pairs with `scenarios` (what it's for). */
  method?: string
  /** Business scenarios this endpoint serves (e.g. ['订阅', '授权']) → trailing
   *  neutral tags. One endpoint can belong to several scenarios but still
   *  appears ONCE in the menu; the tags say which scenarios it covers. */
  scenarios?: string[]
  /** Leading Iconify icon (guide sections). Ignored on endpoints. */
  icon?: string
  /** Optional trailing badge text (e.g. "beta"). */
  badge?: string | number
  /** Force the active state (demo / manual control); usually inferred from `to`. */
  active?: boolean
}

/** How a section presents itself. `guide` = prose pages (soft, sans);
 *  `endpoints` = purpose-named API entries (mono header, scenario-tagged). */
export type SidebarNavKind = 'guide' | 'endpoints'

/** A collapsible section grouping related items. */
export interface SidebarNavSection {
  /** Stable id; falls back to a slug of `label`. Used as the collapsible value. */
  id?: string
  /** Section heading (already localized). */
  label: string
  /** Presentation family. Defaults to `guide`. */
  kind?: SidebarNavKind
  /** Optional leading Iconify icon on the section header. */
  icon?: string
  items: SidebarNavItem[]
  /** Expand on first render. Ignored while a search query is active. */
  defaultOpen?: boolean
}

/** A labelled band of related sections — the visible guide/endpoints boundary. */
export interface SidebarNavGroup {
  /** Stable id; falls back to a slug of `label`. */
  id?: string
  /** Eyebrow label above the band. Omit for an unlabelled lead-in group. */
  label?: string
  sections: SidebarNavSection[]
}

const props = withDefaults(
  defineProps<{
    /** Preferred API: labelled groups of sections. */
    groups?: SidebarNavGroup[]
    /** Back-compat: a flat section list (wrapped into one unlabelled group). */
    sections?: SidebarNavSection[]
    /** Accessible name for the <nav> landmark. */
    ariaLabel?: string
    /** Show the top search field. */
    searchable?: boolean
    searchPlaceholder?: string
    /** Keyboard hint shown in the search field; also the key that focuses it. */
    searchShortcut?: string
    /** Accessible label for the clear-search button. */
    clearLabel?: string
    /** Shown when a query matches nothing. */
    emptyLabel?: string
    /** Allow drag-resizing the nav width (right-edge handle). */
    resizable?: boolean
    /** Width bounds (px) and initial width when nothing is persisted. */
    minWidth?: number
    maxWidth?: number
    defaultWidth?: number
    /** localStorage key the chosen width persists under. */
    widthStorageKey?: string
    /** Accessible label for the resize handle. */
    resizeLabel?: string
  }>(),
  {
    groups: undefined,
    sections: undefined,
    ariaLabel: 'Documentation',
    searchable: true,
    searchPlaceholder: 'Search…',
    searchShortcut: '/',
    clearLabel: 'Clear search',
    emptyLabel: 'No matching pages',
    resizable: true,
    minWidth: 220,
    maxWidth: 460,
    defaultWidth: 288,
    widthStorageKey: 'api-docs-sidebar-width',
    resizeLabel: 'Resize sidebar',
  },
)

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Scenario tags: a guide item yields []; an endpoint yields its scenario list.
function itemScenarios(item: SidebarNavItem): string[] {
  return item.scenarios ?? []
}

// Normalize either input into groups. A flat `sections` prop becomes a single
// unlabelled group so the two call styles share one render path.
const normalizedGroups = computed<SidebarNavGroup[]>(() => {
  if (props.groups?.length) return props.groups
  if (props.sections?.length) return [{ sections: props.sections }]
  return []
})

const query = ref('')
const searchRef = ref<{ inputRef?: HTMLInputElement } | null>(null)
const hasQuery = computed(() => query.value.trim().length > 0)
const hasFilter = hasQuery

// The query matches the purpose label, the HTTP method, OR any scenario tag —
// so "订阅" (a scenario) and "POST" (a method) both narrow the tree.
function matchesText(item: SidebarNavItem, q: string): boolean {
  return (
    item.label.toLowerCase().includes(q)
    || (item.method?.toLowerCase().includes(q) ?? false)
    || itemScenarios(item).some(s => s.toLowerCase().includes(q))
  )
}

function resolveSection(section: SidebarNavSection, q: string) {
  const labelHit = q ? section.label.toLowerCase().includes(q) : false
  // A matching section label keeps the whole section; otherwise narrow to the
  // items whose label or scenario tags match the query.
  const items = q && !labelHit ? section.items.filter(i => matchesText(i, q)) : section.items
  return {
    section,
    id: section.id ?? slug(section.label),
    kind: section.kind ?? 'guide',
    items,
    total: section.items.length,
    forceOpen: q ? items.length > 0 : false,
  }
}

// Each group resolves to its surviving sections; an empty group drops out while
// a filter is active so the boundaries only frame real hits.
const resolved = computed(() => {
  const q = query.value.trim().toLowerCase()
  return normalizedGroups.value
    .map((group, gi) => {
      const sections = group.sections
        .map(section => resolveSection(section, q))
        .filter(entry => (hasFilter.value ? entry.items.length > 0 : true))
      return {
        group,
        id: group.id ?? (group.label ? slug(group.label) : `group-${gi}`),
        sections,
      }
    })
    .filter(group => group.sections.length > 0)
})

const empty = computed(() => hasFilter.value && resolved.value.length === 0)

// The placeholder carries a trailing ellipsis (a truncated-hint convention),
// but the accessible name shouldn't — screen readers would read the "…" as
// "ellipsis". Strip it for the aria-label.
const searchAriaLabel = computed(() => props.searchPlaceholder.replace(/[.…]+$/, '').trim())

// Live-region text for the filter result. Filtering updates the list silently,
// so without this a screen-reader user gets no feedback on how many items
// matched (or that nothing did). Announced politely, only while a query is
// active, so idle browsing stays quiet.
const resultCount = computed(() =>
  resolved.value.reduce(
    (n, group) => n + group.sections.reduce((m, entry) => m + entry.items.length, 0),
    0,
  ),
)
const filterAnnouncement = computed(() => {
  if (!hasFilter.value) return ''
  return resultCount.value === 0
    ? `没有与“${query.value.trim()}”匹配的结果`
    : `找到 ${resultCount.value} 个匹配结果`
})

// Global '/' focuses the search; Escape clears + blurs. Ignore the shortcut
// while the user is already typing in a field or composing via an IME.
function onKeydown(e: KeyboardEvent) {
  if (!props.searchable) return
  const target = e.target as HTMLElement | null
  const typing = !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
  if (e.key === props.searchShortcut && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault()
    searchRef.value?.inputRef?.focus()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function clear() {
  query.value = ''
  searchRef.value?.inputRef?.blur()
}

// --- Width resize ----------------------------------------------------------
// The right-edge affordance mirrors the anatomy of Nuxt UI's own resize handle
// (role="separator", ew-resize cursor, wide hit area) but is rendered locally:
// Nuxt UI's UDashboardResizeHandle is a reka-ui Primitive that does not forward
// the pointer listeners our drag math needs, and its useResizable composable is
// bound to the Dashboard SSR context. So the drag→width math lives here — kept
// minimal: mouse drag, clamp, localStorage persistence, double-click reset.
// SSR-safe: `width` starts at the default (server/client match), the persisted
// value is read after mount.
const width = ref(props.defaultWidth)
const isResizing = ref(false)

function clampWidth(n: number): number {
  return Math.min(props.maxWidth, Math.max(props.minWidth, Math.round(n)))
}

function persistWidth() {
  try {
    localStorage.setItem(props.widthStorageKey, String(width.value))
  }
  catch {
    // Private mode / disabled storage — width just won't persist.
  }
}

// Track the move on window (not the handle) so a fast drag that outruns the
// narrow handle keeps resizing until the button is released.
function onResizeStart(e: MouseEvent) {
  if (!props.resizable) return
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startW = width.value
  const onMove = (ev: MouseEvent) => {
    width.value = clampWidth(startW + (ev.clientX - startX))
  }
  const onUp = () => {
    isResizing.value = false
    persistWidth()
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// Double-click the handle to reset to the default width.
function onResizeReset() {
  width.value = props.defaultWidth
  persistWidth()
}

// Keyboard resize on the focused separator: ←/→ nudge, Shift for a coarse
// step, Home/End jump to the min/max bounds. Mirrors the ARIA slider pattern
// the separator advertises (aria-valuenow/min/max), so the handle is fully
// operable without a pointer.
const RESIZE_STEP = 16
const RESIZE_STEP_COARSE = 48
function onResizeKey(e: KeyboardEvent) {
  if (!props.resizable) return
  let next: number | null = null
  switch (e.key) {
    case 'ArrowLeft':
      next = width.value - (e.shiftKey ? RESIZE_STEP_COARSE : RESIZE_STEP)
      break
    case 'ArrowRight':
      next = width.value + (e.shiftKey ? RESIZE_STEP_COARSE : RESIZE_STEP)
      break
    case 'Home':
      next = props.minWidth
      break
    case 'End':
      next = props.maxWidth
      break
    default:
      return
  }
  e.preventDefault()
  width.value = clampWidth(next)
  persistWidth()
}

onMounted(() => {
  if (!props.resizable) return
  try {
    const saved = localStorage.getItem(props.widthStorageKey)
    if (saved !== null) {
      const n = Number.parseInt(saved, 10)
      if (Number.isFinite(n)) width.value = clampWidth(n)
    }
  }
  catch {
    // Ignore storage read failures.
  }
})
</script>

<template>
  <nav
    :aria-label="ariaLabel"
    class="relative flex max-h-[calc(100dvh-4rem)] flex-col overflow-hidden rounded-lg border border-default bg-elevated/40"
    :class="[{ 'select-none': isResizing }, resizable ? 'w-full lg:w-[var(--api-docs-nav-w)]' : '']"
    :style="resizable ? { '--api-docs-nav-w': `${width}px` } : undefined"
  >
    <!-- Sticky header: the menu body scrolls under it. Holds the optional
         #header slot (e.g. a ⌘K site-wide UContentSearchButton, wired up by the
         consuming app — the base stays data-agnostic and @nuxt/content-free)
         above the in-tree filter input. -->
    <div
      v-if="$slots.header || searchable"
      class="shrink-0 border-b border-default p-2"
    >
      <div v-if="$slots.header" :class="searchable ? 'mb-2' : ''">
        <slot name="header" />
      </div>

      <UInput
        v-if="searchable"
        ref="searchRef"
        v-model="query"
        type="search"
        :placeholder="searchPlaceholder"
        :aria-label="searchAriaLabel"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        icon="i-lucide-search"
        size="sm"
        variant="soft"
        class="w-full"
        :ui="{ base: 'rounded-sm' }"
        @keydown.esc="clear"
      >
        <template #trailing>
          <UButton
            v-if="hasFilter"
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            size="xs"
            :aria-label="clearLabel"
            @click="clear"
          />
          <UKbd v-else :value="searchShortcut" aria-hidden="true" class="max-sm:hidden" />
        </template>
      </UInput>

      <!-- Polite live region: filtering rewrites the list silently, so announce
           the match count (or "no results") to screen readers. Visually hidden;
           empty while idle so nothing is announced during normal browsing. -->
      <p v-if="searchable" class="sr-only" role="status" aria-live="polite">
        {{ filterAnnouncement }}
      </p>
    </div>

    <!-- Scroll region: multiple sections can be open at once; overflow scrolls
         here so the page layout stays put no matter how long the menu grows. -->
    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <!-- Grouping layer: each band is a labelled territory (guides vs. API
           reference), separated by an eyebrow header + spacing. -->
      <div
        v-for="(group, gi) in resolved"
        :key="group.id"
        :class="gi > 0 ? 'mt-4 border-t border-default pt-3' : ''"
      >
        <p
          v-if="group.group.label"
          class="px-2.5 pb-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-dimmed"
        >
          {{ group.group.label }}
        </p>

        <ul class="space-y-0.5">
          <li v-for="entry in group.sections" :key="entry.id">
            <UCollapsible
              :default-open="entry.section.defaultOpen"
              :open="entry.forceOpen || undefined"
            >
              <template #default="{ open }">
                <!-- Section header treatment forks on `kind` via typography
                     only: endpoints read as UPPER MONO with tracking; guides
                     stay soft sentence-case sans. Chrome stays neutral. -->
                <button
                  type="button"
                  class="group/sec flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <UIcon
                    name="i-lucide-chevron-right"
                    class="size-3.5 shrink-0 text-dimmed transition-transform duration-200 group-hover/sec:text-muted"
                    :class="{ 'rotate-90': open || entry.forceOpen }"
                  />
                  <UIcon
                    v-if="entry.section.icon"
                    :name="entry.section.icon"
                    class="size-4 shrink-0 text-muted"
                  />
                  <span
                    class="min-w-0 flex-1 truncate group-hover/sec:text-highlighted"
                    :class="entry.kind === 'endpoints'
                      ? 'font-mono text-xs uppercase tracking-wider text-toned'
                      : 'text-sm font-medium text-toned'"
                  >
                    {{ entry.section.label }}
                  </span>
                  <UBadge
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    class="shrink-0 font-mono tabular-nums"
                  >
                    {{ hasFilter ? `${entry.items.length}/${entry.total}` : entry.total }}
                  </UBadge>
                </button>
              </template>

              <template #content>
                <ul class="mt-0.5 space-y-px pb-1 ml-3.5 pl-3 border-l border-default">
                  <!-- Stretched-link row: the navigation <a> is an absolutely
                       positioned overlay covering the whole row (it carries the
                       click target, focus ring and hover/active background), and
                       the visible row content is its *sibling* laid on top with
                       `pointer-events-none`. This keeps the scenario cluster's
                       "+N" popover trigger (a <button>) out of the <a>: nesting a
                       button inside an anchor is invalid HTML and made tapping
                       "+N" also navigate. Only that button opts back into
                       pointer events (`pointer-events-auto` in ScenarioTags), so
                       the row navigates but the tag reveal doesn't. Text colour
                       is driven by `item.active` + `group-hover/row` rather than
                       the link's own classes, since the link no longer wraps the
                       text. -->
                  <li v-for="item in entry.items" :key="item.to ?? item.label" class="group/row relative">
                    <ULink
                      :to="item.to"
                      :active="item.active"
                      :aria-label="item.label"
                      active-class="bg-primary/10"
                      inactive-class="hover:bg-elevated"
                      class="absolute inset-0 rounded-md transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                    <div
                      class="pointer-events-none relative flex items-center gap-2 px-2.5 py-1.5 text-sm transition-colors"
                      :class="item.active ? 'text-primary' : 'text-muted group-hover/row:text-highlighted'"
                    >
                      <!-- Leading: an endpoint shows its HTTP method badge in a
                           fixed-width slot so purpose labels line up regardless
                           of verb width (GET vs DELETE); a guide shows its icon. -->
                      <span v-if="item.method" class="flex w-14 shrink-0 justify-start">
                        <ApiDocsMethodBadge :method="item.method" size="sm" />
                      </span>
                      <UIcon
                        v-else-if="item.icon"
                        :name="item.icon"
                        class="size-4 shrink-0 text-dimmed"
                      />
                      <!-- Purpose-named label (prose sans, `shrink` so it yields
                           space to the tags rather than hogging it), then the
                           scenarios it serves as a quiet trailing tag cluster.
                           ScenarioTags is `flex-1`: it takes the space the label
                           leaves and reveals as many whole tags as measurably
                           fit, folding the rest into "+N" (or a lone count chip
                           when nothing fits). So a wide sidebar spreads every
                           tag out, a narrow one degrades gracefully, and the
                           label keeps a readable `min-w-16` floor either way.
                           Colour stays reserved for the active state. -->
                      <span class="min-w-16 shrink truncate">{{ item.label }}</span>
                      <ApiDocsScenarioTags
                        v-if="itemScenarios(item).length"
                        :scenarios="itemScenarios(item)"
                      />
                      <UBadge
                        v-if="item.badge !== undefined"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        class="shrink-0"
                      >
                        {{ item.badge }}
                      </UBadge>
                    </div>
                  </li>
                </ul>
              </template>
            </UCollapsible>
          </li>
        </ul>
      </div>

      <p v-if="empty" class="px-2.5 py-6 text-center text-sm text-dimmed">
        {{ emptyLabel }}
      </p>
    </div>

    <!-- Right-edge resize handle. A wide invisible hit area (cursor-ew-resize,
         matching Nuxt UI's own resize handle) wraps a 1px rule that thickens to
         primary on hover / focus / while dragging; double-click resets.
         role="separator" + aria-valuenow/min/max + tabindex give it the
         accessible slider anatomy of UDashboardResizeHandle, but we render the
         node ourselves because that component (a reka-ui Primitive) does not
         forward the pointer listeners our drag math needs. Operable by pointer
         drag (mouse) and keyboard (←/→, Shift for a coarse step, Home/End to
         the bounds). Mouse and keyboard share one focus/interaction indicator —
         the single rule thickens to primary — so there's never a second stray
         outline line next to it. Colour only appears on interaction / focus, so
         the resting edge stays as quiet as the rest of the chrome. -->
    <div
      v-if="resizable"
      role="separator"
      aria-orientation="vertical"
      :aria-label="resizeLabel"
      :aria-valuenow="width"
      :aria-valuemin="minWidth"
      :aria-valuemax="maxWidth"
      tabindex="0"
      class="group/resize absolute inset-y-0 right-0 z-20 hidden w-2 cursor-ew-resize touch-none justify-end outline-none lg:flex"
      @mousedown="onResizeStart"
      @dblclick="onResizeReset"
      @keydown="onResizeKey"
    >
      <span
        class="h-full w-px transition-colors group-hover/resize:w-0.5 group-hover/resize:bg-primary group-focus-visible/resize:w-0.5 group-focus-visible/resize:bg-primary"
        :class="isResizing ? 'w-0.5 bg-primary' : 'bg-transparent'"
      />
    </div>
  </nav>
</template>
