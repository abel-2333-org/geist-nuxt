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
//        · endpoints → UPPER MONO with tracking; the per-row method badge is
//                      what carries colour, so the chrome stays neutral.
//
// Sections are independently collapsible (multiple open at once), each carries
// a count, and a single top search filters across every section so a large
// section stays reachable without scrolling. Optional HTTP-method chips sit
// under the search and narrow to matching endpoints (compose with the query);
// they only appear when the data actually contains those methods.
//
// In-tree search vs. site-wide search are kept orthogonal. This component only
// does the former (filter the nav tree in place). For the latter — a ⌘K
// full-text search over @nuxt/content — expose a #header slot: the consuming
// app drops a <UContentSearchButton> in, so the base never takes a hard
// @nuxt/content dependency and stays data-agnostic + reusable.
//
// Composed from Nuxt UI primitives + this kit's ApiDocsMethodBadge:
//   root        <nav> — sticky, own scroll area (a long menu scrolls here, not
//                       the page); reduced-motion honored globally by the layer
//   search      UInput + UKbd hint  (global filter, '/' focuses, Esc clears)
//   group       eyebrow label + divider  (the guide/endpoints boundary)
//   section     UCollapsible → trigger row (chevron · label · count badge)
//                              → content (a stack of item rows)
//   item        ULink — guide (icon + label) or endpoint (method badge + label)
//
// Self-contained per the kit slice convention: the nav data model travels
// inline with the component; all copy is passed in via props (content-agnostic,
// i18n-ready). The only sibling dependency is ApiDocsMethodBadge (declared in
// registry.json), reached by auto-import across the layer.

/** A single leaf link. Either a guide entry (optional `icon`) or an endpoint
 *  (`method` renders an ApiDocsMethodBadge before the label). */
export interface SidebarNavItem {
  /** Visible label (already localized). */
  label: string
  /** Destination route; rendered with ULink so active state + prefetch work. */
  to?: string
  /** HTTP method → leading method badge (endpoint sections). */
  method?: string
  /** Leading Iconify icon (guide sections). Ignored when `method` is set. */
  icon?: string
  /** Optional trailing badge text (e.g. "beta"). */
  badge?: string | number
  /** Force the active state (demo / manual control); usually inferred from `to`. */
  active?: boolean
}

/** How a section presents itself. `guide` = prose pages (soft, sans);
 *  `endpoints` = HTTP operations (mono, tinted, method-badged). */
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
    /** Show HTTP-method filter chips (only render when endpoints exist). */
    methodFilters?: boolean
    /** Accessible label for the method-filter chip group. */
    methodFilterLabel?: string
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
    methodFilters: true,
    methodFilterLabel: 'Filter by method',
  },
)

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
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

// HTTP-method filter chips. Only the methods actually present in the data are
// offered (canonical order), so a guide-only sidebar shows no chips at all.
// Filtering by method is inherently an endpoint operation: guide items (no
// `method`) drop out whenever any chip is active.
const methodOrder: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const availableMethods = computed<string[]>(() => {
  if (!props.methodFilters) return []
  const seen = new Set<string>()
  for (const group of normalizedGroups.value)
    for (const section of group.sections)
      for (const item of section.items)
        if (item.method) seen.add(item.method.toUpperCase())
  return methodOrder.filter(m => seen.has(m))
})
const activeMethods = ref<Set<string>>(new Set())
const hasMethodFilter = computed(() => activeMethods.value.size > 0)
const hasFilter = computed(() => hasQuery.value || hasMethodFilter.value)

function methodChipColor(m: string) {
  return methodPreset[m.toUpperCase() as HttpMethod]?.tone ?? 'neutral'
}

function toggleMethod(m: string) {
  const next = new Set(activeMethods.value)
  if (next.has(m)) next.delete(m)
  else next.add(m)
  activeMethods.value = next
}

function matchesText(item: SidebarNavItem, q: string): boolean {
  return (
    item.label.toLowerCase().includes(q)
    || (item.method?.toLowerCase().includes(q) ?? false)
  )
}

function resolveSection(section: SidebarNavSection, q: string, methods: Set<string>) {
  const labelHit = q ? section.label.toLowerCase().includes(q) : false
  let items = section.items
  // Method chips always narrow, regardless of a section-label text hit.
  if (methods.size > 0)
    items = items.filter(i => !!i.method && methods.has(i.method.toUpperCase()))
  // Text query narrows further, unless the section label itself matched.
  if (q && !labelHit)
    items = items.filter(i => matchesText(i, q))
  const filterActive = !!q || methods.size > 0
  return {
    section,
    id: section.id ?? slug(section.label),
    kind: section.kind ?? 'guide',
    items,
    total: section.items.length,
    forceOpen: filterActive ? items.length > 0 : false,
  }
}

// Each group resolves to its surviving sections; an empty group drops out while
// a filter is active so the boundaries only frame real hits.
const resolved = computed(() => {
  const q = query.value.trim().toLowerCase()
  const methods = activeMethods.value
  return normalizedGroups.value
    .map((group, gi) => {
      const sections = group.sections
        .map(section => resolveSection(section, q, methods))
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
  activeMethods.value = new Set()
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
         above the in-tree filter input + method chips. -->
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

      <!-- Method filter chips: quiet neutral ghosts by default; a toggled chip
           takes its method colour (subtle) so the active filter is unmistakable
           without turning the header flashy. -->
      <div
        v-if="availableMethods.length"
        role="group"
        :aria-label="methodFilterLabel"
        class="mt-2 flex flex-wrap gap-1"
      >
        <UButton
          v-for="m in availableMethods"
          :key="m"
          :label="m"
          size="xs"
          :color="activeMethods.has(m) ? methodChipColor(m) : 'neutral'"
          :variant="activeMethods.has(m) ? 'subtle' : 'ghost'"
          :aria-pressed="activeMethods.has(m)"
          class="font-mono tracking-wide tabular-nums"
          @click="toggleMethod(m)"
        />
      </div>
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
                <!-- Section header treatment forks on `kind`: endpoints read as
                     UPPER MONO with a faint primary tint bar; guides stay soft
                     sentence-case sans. -->
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
                      <span v-if="item.method" class="flex w-14 shrink-0 justify-start">
                        <ApiDocsMethodBadge :method="item.method" size="sm" />
                      </span>
                      <UIcon
                        v-else-if="item.icon"
                        :name="item.icon"
                        class="size-4 shrink-0 text-dimmed"
                      />
                      <span
                        class="min-w-0 flex-1 truncate"
                        :class="item.method ? 'font-mono text-[0.8125rem]' : ''"
                      >{{ item.label }}</span>
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
