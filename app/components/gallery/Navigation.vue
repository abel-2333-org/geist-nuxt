<script setup lang="ts">
// Catalog group: navigation. One GalleryEntry per heading in
// references/components/navigation.md (route Y). Usage links point to that doc.
const DOC = 'https://github.com/abel-2333-org/geist-nuxt/blob/main/references/components/navigation.md'

const navItems = [
  { label: 'Overview', to: '#', icon: 'i-lucide-home' },
  { label: 'Docs', to: '#', icon: 'i-lucide-book' },
  { label: 'Settings', to: '#', icon: 'i-lucide-settings' },
]
const tabItems = [
  { label: 'Preview', slot: 'preview' as const, icon: 'i-lucide-eye' },
  { label: 'Code', slot: 'code' as const, icon: 'i-lucide-code' },
]
const crumbs = [
  { label: 'Home', to: '#', icon: 'i-lucide-home' },
  { label: 'Components', to: '#' },
  { label: 'Navigation' },
]
const page = ref(1)
</script>

<template>
  <section id="navigation" class="scroll-mt-20 space-y-6">
    <h3 class="text-lg font-semibold tracking-tight text-highlighted">Navigation</h3>

    <GalleryEntry
      name="UNavigationMenu"
      description="Primary navigation for headers or sidebars, with optional nesting."
      :usage-href="`${DOC}#unavigationmenu`"
    >
      <GalleryExample label="Horizontal" layout="stack">
        <UNavigationMenu :items="navItems" />
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UTabs"
      description="Switch between related panels; keyboard and ARIA handled internally."
      :usage-href="`${DOC}#utabs`"
    >
      <GalleryExample label="Slots" layout="stack">
        <UTabs :items="tabItems">
          <template #preview>
            <p class="text-sm text-muted p-2">Rendered preview panel.</p>
          </template>
          <template #code>
            <p class="text-sm text-muted p-2 font-mono">&lt;Component /&gt;</p>
          </template>
        </UTabs>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UBreadcrumb"
      description="Shows the current location within a hierarchy."
      :usage-href="`${DOC}#ubreadcrumb`"
    >
      <GalleryExample label="Trail" layout="stack">
        <UBreadcrumb :items="crumbs" />
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="ULink"
      description="Link with active-state detection beyond a bare anchor."
      :usage-href="`${DOC}#ulink`"
    >
      <GalleryExample label="Links">
        <ULink to="#" class="text-primary">Documentation</ULink>
        <ULink to="#" class="text-muted hover:text-default">Changelog</ULink>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UPagination"
      description="Page through large datasets; pairs with UTable."
      :usage-href="`${DOC}#upagination`"
    >
      <GalleryExample label="Pages" layout="stack">
        <UPagination v-model:page="page" :total="100" :items-per-page="10" />
      </GalleryExample>
    </GalleryEntry>
  </section>
</template>
