<script setup lang="ts">
import {
  docsShellDomains,
  searchDocsBody,
  toSiteSearchGroups,
} from '~/utils/demo/api-docs/docs-shell-data'

const route = useRoute()
const router = useRouter()
const domainIds = new Set(docsShellDomains.map(domain => domain.id))

const currentDomainId = computed(() => {
  const requested = typeof route.query.domain === 'string' ? route.query.domain : ''
  return domainIds.has(requested) ? requested : docsShellDomains[0]!.id
})

const currentDomain = computed(() =>
  docsShellDomains.find(domain => domain.id === currentDomainId.value) ?? docsShellDomains[0]!,
)

const searchGroups = computed(() => toSiteSearchGroups(currentDomain.value))

async function selectDomain(domainId: string) {
  await router.push({
    query: { ...route.query, domain: domainId },
    hash: '',
  })
}

async function searchBody(query: string) {
  return searchDocsBody(currentDomain.value, query)
}
</script>

<template>
  <div
    class="min-h-[calc(100dvh-var(--ui-header-height))] bg-default"
    style="--docs-shell-toolbar-height: calc(var(--spacing) * 14)"
  >
    <a
      href="#docs-shell-content"
      class="sr-only z-50 rounded-md bg-default px-3 py-2 text-sm font-medium text-highlighted shadow-lg focus:fixed focus:start-4 focus:top-4 focus:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Skip to documentation content
    </a>

    <header class="sticky top-[var(--ui-header-height)] z-40 border-y border-default bg-default/95 backdrop-blur">
      <div class="flex h-14 min-w-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div class="flex min-w-0 items-center gap-2">
          <NuxtLink
            to="/kits/api-docs/docs-shell"
            class="flex shrink-0 items-center gap-2 font-medium text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Example Cloud documentation home"
          >
            <span class="flex size-7 items-center justify-center rounded-sm bg-inverted text-inverted">
              <UIcon name="i-lucide-cloud" class="size-4" />
            </span>
            <span class="max-sm:hidden">Example Cloud</span>
          </NuxtLink>

          <USeparator orientation="vertical" class="h-5" />

          <DemoApiDocsDomainSwitcher
            :domains="docsShellDomains"
            :model-value="currentDomainId"
            aria-label="Switch documentation domain"
            @update:model-value="selectDomain"
          />
        </div>

        <ApiDocsSiteSearch
          :key="currentDomain.id"
          :groups="searchGroups"
          :search="searchBody"
          search-group-label="In this guide"
          trigger-label="Search docs"
          aria-label="Search all documentation"
          modal-title="Search documentation"
          placeholder="Search guides and endpoints"
          empty-label="No matching documentation"
        />
      </div>
    </header>

    <div class="min-w-0 lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
      <aside class="h-[60dvh] border-b border-default lg:sticky lg:top-[calc(var(--ui-header-height)+var(--docs-shell-toolbar-height))] lg:h-[calc(100dvh-var(--ui-header-height)-var(--docs-shell-toolbar-height))] lg:border-b-0 lg:border-r">
        <ApiDocsSidebarNav
          :key="currentDomain.id"
          :groups="currentDomain.navGroups"
          :aria-label="`${currentDomain.label} documentation`"
          search-placeholder="Filter navigation"
          clear-label="Clear navigation filter"
          empty-label="No matching pages"
          resize-label="Resize documentation sidebar"
          scenarios-label="Scenarios"
          :results-announcement="count => `${count} matching pages`"
          :no-results-announcement="query => `No pages match “${query}”`"
          :scenario-overflow-label="total => `View all ${total} scenarios`"
        />
      </aside>

      <section
        id="docs-shell-content"
        tabindex="-1"
        aria-label="API documentation content"
        class="min-w-0 focus:outline-none"
      >
        <DemoApiDocsShellReference :key="currentDomain.id" :domain="currentDomain" />
      </section>
    </div>
  </div>
</template>
