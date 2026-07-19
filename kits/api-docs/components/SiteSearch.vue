<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

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
          console.warn('[ApiDocsSiteSearch] Search source failed:', error)
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

if (import.meta.dev) {
  watchEffect(() => {
    if (props.search && !props.searchGroupLabel) {
      console.warn('[ApiDocsSiteSearch] `searchGroupLabel` is required when `search` is provided.')
    }
  })
}

function trackHashDestination(to: string) {
  const destination = router.resolve(to)
  if (destination.path !== route.path || !destination.hash) {
    pendingHashId.value = null
    return
  }

  const hash = destination.hash.slice(1)
  try {
    pendingHashId.value = decodeURIComponent(hash)
  }
  catch {
    pendingHashId.value = hash
  }
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

const paletteGroups = computed<CommandPaletteGroup<SiteSearchPaletteItem>[]>(() => {
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
  <UModal
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
          <ApiDocsMethodBadge v-if="item.method" :method="item.method" />
          <UIcon
            v-else-if="item.icon"
            :name="item.icon"
            class="size-4 shrink-0 text-dimmed"
          />
        </template>

        <template #empty>
          <div class="py-6 text-center text-sm text-muted">
            {{ searching ? props.searchingLabel : searchFailed ? props.searchErrorLabel : props.emptyLabel }}
          </div>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
