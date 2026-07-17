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
// The nav is width-resizable: a drag handle on the right edge sets the width,
// clamped to [minWidth, maxWidth] and persisted to localStorage so a reader's
// preferred width survives reloads. Keyboard-operable (role="separator" +
// arrow keys), double-click resets to the default. Opt out with :resizable=false.
//
// Composed from Nuxt UI primitives + this kit's ApiDocsMethodBadge:
//   root        <nav> — sticky, own scroll area (a long menu scrolls here, not
//                       the page); reduced-motion honored globally by the layer
//   search      UInput + UKbd hint  (global filter, '/' focuses, Esc clears)
//   group       eyebrow label + divider  (the guide/endpoints boundary)
//   section     UCollapsible → trigger row (chevron · label · count badge)
//                              → content (a stack of item rows)
//   item        ULink — guide (icon + label) or endpoint (leading method badge
//                       + purpose label + trailing scenario tags)
//   resizer     right-edge separator (drag / arrow keys), width → localStorage
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
    searchPlaceholder: 'Search',
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
// SSR-safe: `width` starts at the default (identical on server + client, so no
// hydration mismatch); the persisted value is read in onMounted, after mount.
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

// Drag: track the pointer on window (not the handle) so a fast drag that
// outruns the 6px handle keeps resizing; released on pointerup.
function onResizePointerDown(e: PointerEvent) {
  if (!props.resizable) return
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startW = width.value
  const onMove = (ev: PointerEvent) => {
    width.value = clampWidth(startW + (ev.clientX - startX))
  }
  const onUp = () => {
    isResizing.value = false
    persistWidth()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

// Keyboard: arrows nudge (Shift = coarse), Home/End jump to the bounds.
function onResizeKeydown(e: KeyboardEvent) {
  if (!props.resizable) return
  const step = e.shiftKey ? 32 : 8
  if (e.key === 'ArrowLeft') width.value = clampWidth(width.value - step)
  else if (e.key === 'ArrowRight') width.value = clampWidth(width.value + step)
  else if (e.key === 'Home') width.value = props.minWidth
  else if (e.key === 'End') width.value = props.maxWidth
  else return
  e.preventDefault()
  persistWidth()
}

// Double-click the handle to reset to the default width.
function resetWidth() {
  width.value = props.defaultWidth
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
    ref="navRef"
    :aria-label="ariaLabel"
    class="relative flex max-h-[calc(100dvh-4rem)] flex-col overflow-hidden rounded-lg border border-default bg-elevated/40"
    :class="{ 'select-none': isResizing }"
    :style="resizable ? { width: `${width}px` } : undefined"
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
        :placeholder="searchPlaceholder"
        :aria-label="searchPlaceholder"
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
                  <li v-for="item in entry.items" :key="item.to ?? item.label">
                    <ULink
                      :to="item.to"
                      :active="item.active"
                      active-class="bg-primary/10 text-primary"
                      inactive-class="text-muted hover:text-highlighted hover:bg-elevated"
                      class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                      <!-- Purpose-named label (prose sans), then the scenarios it
                           serves as quiet trailing neutral tags. Colour stays
                           reserved for the active state. -->
                      <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                      <span
                        v-if="itemScenarios(item).length"
                        class="flex shrink-0 items-center gap-1"
                      >
                        <UBadge
                          v-for="s in itemScenarios(item)"
                          :key="s"
                          color="neutral"
                          variant="soft"
                          size="sm"
                        >
                          {{ s }}
                        </UBadge>
                      </span>
                      <UBadge
                        v-if="item.badge !== undefined"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        class="shrink-0"
                      >
                        {{ item.badge }}
                      </UBadge>
                    </ULink>
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

    <!-- Right-edge resize handle. Reuse UDashboardResizeHandle (role="separator"
         + wide `before` hit area) wired to useResizable, dressed in Geist
         chrome: a 1px rule that thickens to primary on hover / while dragging;
         double-click resets. Colour only appears on interaction, so the resting
         edge stays as quiet as the rest of the chrome. Drag/touch only (no
         keyboard resize) — matching Nuxt UI's own Dashboard. -->
    <UDashboardResizeHandle
      v-if="resizable"
      :aria-label="resizeLabel"
      class="group/resize absolute inset-y-0 right-0 z-20 flex w-2 justify-end"
      @mousedown="onResizeMouseDown"
      @touchstart="onResizeTouchStart"
      @dblclick="onResizeReset"
    >
      <span
        class="h-full w-px transition-colors group-hover/resize:w-0.5 group-hover/resize:bg-primary"
        :class="isResizing ? 'w-0.5 bg-primary' : 'bg-transparent'"
      />
    </UDashboardResizeHandle>
  </nav>
</template>
