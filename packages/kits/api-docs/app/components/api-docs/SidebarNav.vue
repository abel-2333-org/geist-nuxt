<script setup lang="ts">
// Domain component (API docs): a documentation sidebar where ONE menu holds
// several sections whose destination pages differ in nature — a "Guide" section
// is prose links, an "Endpoints" section is HTTP operations tagged with a
// method badge. Sections are independently collapsible (multiple open at once),
// each carries a count, and a single top search filters across every section so
// a large section stays reachable without scrolling.
//
// Composed from Nuxt UI primitives + this kit's ApiDocsMethodBadge:
//   root        <nav> — sticky, own scroll area (a long menu scrolls here, not
//                       the page); reduced-motion honored globally by the layer
//   search      UInput + UKbd hint  (global filter, '/' focuses, Esc clears)
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

/** A collapsible section grouping related items. */
export interface SidebarNavSection {
  /** Stable id; falls back to a slug of `label`. Used as the collapsible value. */
  id?: string
  /** Section heading (already localized). */
  label: string
  /** Optional leading Iconify icon on the section header. */
  icon?: string
  items: SidebarNavItem[]
  /** Expand on first render. Ignored while a search query is active. */
  defaultOpen?: boolean
}

const props = withDefaults(
  defineProps<{
    sections: SidebarNavSection[]
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

const query = ref('')
const searchRef = ref<{ inputRef?: HTMLInputElement } | null>(null)
const hasQuery = computed(() => query.value.trim().length > 0)

function matches(item: SidebarNavItem, q: string): boolean {
  return (
    item.label.toLowerCase().includes(q)
    || (item.method?.toLowerCase().includes(q) ?? false)
  )
}

// Each section resolves to { section, items (filtered), open }. A query keeps a
// section when its own label matches (then all items show) or any item matches;
// while querying, matching sections are force-open so hits are always visible.
const resolved = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.sections
    .map((section) => {
      const labelHit = q ? section.label.toLowerCase().includes(q) : false
      const items = q && !labelHit ? section.items.filter(i => matches(i, q)) : section.items
      return {
        section,
        id: section.id ?? slug(section.label),
        items,
        total: section.items.length,
        forceOpen: q ? items.length > 0 : false,
      }
    })
    .filter(entry => (hasQuery.value ? entry.items.length > 0 : true))
})

const empty = computed(() => hasQuery.value && resolved.value.length === 0)

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
    <!-- Sticky search header: the menu body scrolls under it. -->
    <div v-if="searchable" class="shrink-0 border-b border-default p-2">
      <UInput
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
            v-if="hasQuery"
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
      <ul class="space-y-0.5">
        <li v-for="entry in resolved" :key="entry.id">
          <UCollapsible
            :default-open="entry.section.defaultOpen"
            :open="entry.forceOpen || undefined"
          >
            <template #default="{ open }">
              <button
                type="button"
                class="group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-3.5 shrink-0 text-dimmed transition-transform duration-200 group-hover:text-muted"
                  :class="{ 'rotate-90': open || entry.forceOpen }"
                />
                <UIcon
                  v-if="entry.section.icon"
                  :name="entry.section.icon"
                  class="size-4 shrink-0 text-muted"
                />
                <span class="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider text-muted group-hover:text-highlighted">
                  {{ entry.section.label }}
                </span>
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  class="shrink-0 font-mono tabular-nums"
                >
                  {{ hasQuery ? `${entry.items.length}/${entry.total}` : entry.total }}
                </UBadge>
              </button>
            </template>

            <template #content>
              <ul class="mt-0.5 space-y-px border-l border-default pb-1 pl-3 ml-3.5">
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
                    <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
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

      <p v-if="empty" class="px-2.5 py-6 text-center text-sm text-dimmed">
        {{ emptyLabel }}
      </p>
    </div>
  </nav>
</template>
