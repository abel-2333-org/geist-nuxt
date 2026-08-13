<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import Fuse from 'fuse.js'

defineOptions({ inheritAttrs: false })

/** A site-wide search destination. Content adapters should resolve their own
 * source model into this display-only shape before it reaches the kit. */
export interface SiteSearchItem {
  label: string
  to: string
  method?: string
  scenarios?: string[]
  icon?: string
  suffix?: string
}

export interface SiteSearchGroup {
  id: string
  label: string
  items: SiteSearchItem[]
}

interface SiteSearchPaletteItem extends CommandPaletteItem {
  method?: string
  scenarios?: string[]
}

const props = withDefaults(
  defineProps<{
    groups: SiteSearchGroup[]
    triggerLabel?: string
    ariaLabel?: string
    modalTitle?: string
    placeholder?: string
    emptyLabel?: string
    searchingLabel?: string
    searchErrorLabel?: string
    /** Polite live-region text when a query yields no available option. */
    noResultsAnnouncement?: (query: string) => string
    scenarioSeparator?: string
    shortcut?: string
    resultLimit?: number
    extraGroups?: CommandPaletteGroup<SiteSearchPaletteItem>[]
    search?: (query: string) => Promise<SiteSearchItem[]> | SiteSearchItem[]
    searchGroupLabel?: string
    searchDelay?: number
  }>(),
  {
    triggerLabel: 'Search docs',
    ariaLabel: undefined,
    modalTitle: 'Search documentation',
    placeholder: 'Search guides and endpoints',
    emptyLabel: 'No matching documentation',
    searchingLabel: 'Searching documentation…',
    searchErrorLabel: 'Search is temporarily unavailable. Try again later.',
    noResultsAnnouncement: (query: string) => `No results for “${query}”`,
    scenarioSeparator: ', ',
    shortcut: 'meta_k',
    resultLimit: 12,
    extraGroups: () => [],
    search: undefined,
    searchGroupLabel: undefined,
    searchDelay: 100,
  },
)

const route = useRoute()
const router = useRouter()
const open = shallowRef(false)
const searchTerm = shallowRef('')
const asyncItems = shallowRef<SiteSearchItem[]>([])
const searching = shallowRef(false)
const searchFailed = shallowRef(false)
const pendingHashId = shallowRef<string | null>(null)
const emptyRef = useTemplateRef<HTMLDivElement>('empty')
const announcement = shallowRef('')

const shortcutKeys = computed(() => props.shortcut
  .split('_')
  .filter(Boolean)
  .map(key => key.length === 1 ? key.toUpperCase() : key))

defineShortcuts(computed(() => ({
  [props.shortcut]: {
    usingInput: true,
    handler: () => {
      open.value = !open.value
    },
  },
})))

watch(open, (isOpen) => {
  if (!isOpen) searchTerm.value = ''
})

watch(searchTerm, (query, _previousQuery, onCleanup) => {
  const search = props.search
  const normalizedQuery = query.trim()

  asyncItems.value = []
  searchFailed.value = false
  if (!search || !normalizedQuery) {
    searching.value = false
    return
  }

  let active = true
  searching.value = true
  const timer = setTimeout(async () => {
    try {
      const results = await search(normalizedQuery)
      if (active) asyncItems.value = results
    }
    catch (error) {
      if (active) {
        searchFailed.value = true
        if (import.meta.dev) {
          console.warn('[SiteSearch] Search source failed:', error)
        }
      }
    }
    finally {
      if (active) searching.value = false
    }
  }, props.searchDelay)

  onCleanup(() => {
    active = false
    clearTimeout(timer)
  })
})

const emptyStateLabel = computed(() => searching.value
  ? props.searchingLabel
  : searchFailed.value
    ? props.searchErrorLabel
    : props.emptyLabel)

// The empty slot and the rendered options consume the same synchronously
// filtered groups. Observing that slot therefore reports the current query,
// without depending on UCommandPalette's internal debounce or throttle.
watch(
  [open, searchTerm, searching, searchFailed, emptyRef],
  () => {
    announcement.value = ''
    const query = searchTerm.value.trim()
    if (!open.value || !query || !emptyRef.value) return

    announcement.value = searching.value
      ? props.searchingLabel
      : searchFailed.value
        ? props.searchErrorLabel
        : props.noResultsAnnouncement(query)
  },
  { flush: 'post', immediate: true },
)

if (import.meta.dev) {
  watchEffect(() => {
    if (props.search && !props.searchGroupLabel) {
      console.warn('[SiteSearch] `searchGroupLabel` is required when `search` is provided.')
    }
  })
}

function trackHashDestination(to: string) {
  const destination = router.resolve(to)
  if (destination.path !== route.path || !destination.hash) {
    pendingHashId.value = null
    return
  }

  // `router.resolve()` already normalizes a string URL and decodes its hash
  // once. Keep the resulting literal DOM id: decoding again corrupts opaque
  // ids that contain escape-looking text such as `res_state%25`.
  pendingHashId.value = destination.hash.slice(1)
}

function onCloseAutoFocus(event: Event) {
  const id = pendingHashId.value
  pendingHashId.value = null
  if (!id) return

  const target = document.getElementById(id)
  if (!target) return

  event.preventDefault()
  requestAnimationFrame(() => {
    if (!target.isConnected) return
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  })
}

function toPaletteItem(item: SiteSearchItem): SiteSearchPaletteItem {
  const suffix = [item.suffix, item.scenarios?.join(props.scenarioSeparator)]
    .filter((value): value is string => Boolean(value))
    .join(' · ')

  return {
    label: item.label,
    suffix,
    to: item.to,
    icon: item.method ? undefined : item.icon,
    method: item.method,
    scenarios: item.scenarios,
    onSelect: () => trackHashDestination(item.to),
  }
}

const sourceGroups = computed<CommandPaletteGroup<SiteSearchPaletteItem>[]>(() => {
  const groups: CommandPaletteGroup<SiteSearchPaletteItem>[] = props.groups.map(group => ({
    id: group.id,
    label: group.label,
    items: group.items.map(toPaletteItem),
  }))

  if (props.search && asyncItems.value.length > 0) {
    groups.push({
      id: 'site-search-async',
      label: props.searchGroupLabel,
      ignoreFilter: true,
      items: asyncItems.value.map(toPaletteItem),
    })
  }

  return groups.concat(props.extraGroups)
})

const fuseOptions = {
  ignoreLocation: true,
  includeMatches: true,
  threshold: 0.1,
  keys: ['label', 'suffix', 'method', 'scenarios'],
}

const paletteGroups = computed<CommandPaletteGroup<SiteSearchPaletteItem>[]>(() => {
  const query = searchTerm.value.trim()
  const groups = sourceGroups.value
  const results = new Map<string, SiteSearchPaletteItem[]>()

  if (query) {
    const items = groups
      .filter(group => !group.ignoreFilter)
      .flatMap(group => (group.items ?? []).map(item => ({ ...item, group: group.id })))

    for (const result of new Fuse(items, fuseOptions).search(query, { limit: props.resultLimit })) {
      const groupItems = results.get(result.item.group) ?? []
      groupItems.push({ ...result.item, matches: result.matches })
      results.set(result.item.group, groupItems)
    }
  }

  return groups.map((group) => {
    const { postFilter, ...rest } = group
    const items = query && !group.ignoreFilter
      ? results.get(group.id) ?? []
      : group.items ?? []

    return {
      ...rest,
      ignoreFilter: true,
      items: postFilter ? postFilter(query, items) : items,
    }
  })
})

const fuse = computed(() => ({
  fuseOptions: {
    ...fuseOptions,
    useTokenSearch: true,
  },
  resultLimit: props.resultLimit,
}))
</script>

<template>
  <UModal
    v-bind="$attrs"
    v-model:open="open"
    :title="props.modalTitle"
    :content="{ onCloseAutoFocus }"
  >
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      class="text-muted max-sm:px-1.5"
      :aria-label="props.ariaLabel ?? props.triggerLabel"
    >
      <UIcon name="i-lucide-search" class="size-4 shrink-0" />
      <span class="max-sm:hidden">{{ props.triggerLabel }}</span>
      <span
        v-if="shortcutKeys.length"
        class="flex items-center gap-0.5 max-sm:hidden"
        aria-hidden="true"
      >
        <UKbd v-for="key in shortcutKeys" :key="key" :value="key" />
      </span>
    </UButton>

    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="paletteGroups"
        :placeholder="props.placeholder"
        :fuse="fuse"
        :loading="searching"
        close
        preserve-group-order
        @update:open="open = $event"
        @update:model-value="open = false"
      >
        <template #item-leading="{ item }">
          <HttpMethodBadge v-if="item.method" :method="item.method" />
          <UIcon
            v-else-if="item.icon"
            :name="item.icon"
            class="size-4 shrink-0 text-dimmed"
          />
        </template>

        <template #empty>
          <div ref="empty" class="py-6 text-center text-sm text-muted">
            {{ emptyStateLabel }}
          </div>
        </template>
      </UCommandPalette>
    </template>
  </UModal>

  <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {{ announcement }}
  </p>
</template>
