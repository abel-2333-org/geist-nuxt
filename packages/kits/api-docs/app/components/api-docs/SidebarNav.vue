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
//        · endpoints → UPPER MONO with tracking; items are a PURPOSE-named
//                      label (not a path) with optional trailing scenario tags.
//
// Endpoints are named by use case, not by REST verb/path: our APIs don't map
// cleanly to a single HTTP method, and one endpoint often serves several
// business scenarios (subscriptions, authorization, …). So an endpoint appears
// ONCE, and the scenarios it belongs to ride along as quiet neutral tags — the
// menu stays about "what this endpoint is for", not "which verb it is".
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
// Composed from Nuxt UI primitives:
//   root        <nav> — sticky, own scroll area (a long menu scrolls here, not
//                       the page); reduced-motion honored globally by the layer
//   search      UInput + UKbd hint  (global filter, '/' focuses, Esc clears)
//   group       eyebrow label + divider  (the guide/endpoints boundary)
//   section     UCollapsible → trigger row (chevron · label · count badge)
//                              → content (a stack of item rows)
//   item        ULink — guide (icon + label) or endpoint (purpose label +
//                       trailing scenario tags)
//
// Self-contained per the kit slice convention: the nav data model travels
// inline with the component; all copy is passed in via props (content-agnostic,
// i18n-ready). No sibling slice dependency — scenario tags are plain neutral
// UBadges, so the slice stands alone.

/** A single leaf link. Either a guide entry (optional `icon`) or an endpoint
 *  whose label is a purpose name (e.g. "Create checkout session"), with the
 *  business scenarios it serves riding along as trailing `scenarios` tags. */
export interface SidebarNavItem {
  /** Visible label (already localized). For endpoints this is the purpose
   *  name, NOT the path — our APIs are named by use case, so the path is not a
   *  good menu label. */
  label: string
  /** Destination route; rendered with ULink so active state + prefetch work. */
  to?: string
  /** Business scenarios this endpoint serves (e.g. ['订阅', '授权']) → trailing
   *  neutral tags. One endpoint can belong to several scenarios but still
   *  appears ONCE in the menu; the tags say which scenarios it covers. */
  scenarios?: string[]
  /** Leading Iconify icon (guide sections). Ignored when `scenarios` is set. */
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

// The query matches the purpose label OR any scenario tag, so searching a
// scenario name ("订阅") surfaces every endpoint that serves it.
function matchesText(item: SidebarNavItem, q: string): boolean {
  return (
    item.label.toLowerCase().includes(q)
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
</script>

<template>
  <nav
    :aria-label="ariaLabel"
    class="flex max-h-[calc(100dvh-4rem)] flex-col overflow-hidden rounded-lg border border-default bg-elevated/40"
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
                  class="group/sec flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                      class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <UIcon
                        v-if="item.icon && !itemScenarios(item).length"
                        :name="item.icon"
                        class="size-4 shrink-0 text-dimmed"
                      />
                      <!-- Endpoints are named by purpose, not path, so the label
                           reads as prose (sans), leading. The scenarios an
                           endpoint serves trail it as quiet neutral tags — the
                           endpoint still appears once; tags say which scenarios
                           it covers. Colour stays reserved for the active state. -->
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
  </nav>
</template>
