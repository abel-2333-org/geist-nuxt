<script setup lang="ts">
// Catalog group: data display. One GalleryEntry per heading in
// references/components/data-display.md (route Y). Usage links point to that doc.
const DOC = 'https://github.com/abel-2333-org/geist-nuxt/blob/main/references/components/data-display.md'

const rows = [
  { id: 1, name: 'Landing page', status: 'Published' },
  { id: 2, name: 'Docs site', status: 'Draft' },
  { id: 3, name: 'Dashboard', status: 'Published' },
]
const columns = [
  { accessorKey: 'name', header: 'Project' },
  { accessorKey: 'status', header: 'Status' },
]
</script>

<template>
  <section id="data-display" class="scroll-mt-20 space-y-6">
    <h3 class="text-lg font-semibold tracking-tight text-highlighted">Data display</h3>

    <GalleryEntry
      name="UCard"
      description="Content container with header, body, and footer slots."
      :usage-href="`${DOC}#ucard`"
    >
      <GalleryExample label="With header + footer" layout="stack">
        <UCard>
          <template #header>
            <h4 class="font-medium text-highlighted">Project settings</h4>
          </template>
          <p class="text-sm text-muted">Body content coloured with semantic tokens.</p>
          <template #footer>
            <UButton size="sm">Save</UButton>
          </template>
        </UCard>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UTable"
      description="Semantic data table with custom column definitions."
      :usage-href="`${DOC}#utable`"
    >
      <GalleryExample label="Rows" layout="stack">
        <UTable :data="rows" :columns="columns" />
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UBadge"
      description="Non-interactive status, category, or count marker."
      :usage-href="`${DOC}#ubadge`"
    >
      <GalleryExample label="Colors">
        <UBadge color="success" variant="subtle">Published</UBadge>
        <UBadge color="warning" variant="subtle">Pending</UBadge>
        <UBadge color="error" variant="subtle">Failed</UBadge>
        <UBadge color="neutral" variant="subtle">Draft</UBadge>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UKbd"
      description="Keyboard key hint (display only)."
      :usage-href="`${DOC}#ukbd`"
    >
      <GalleryExample label="Shortcut">
        <UKbd>⌘</UKbd>
        <UKbd>K</UKbd>
        <UKbd value="Esc" />
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="USeparator"
      description="Divider line, optionally labelled."
      :usage-href="`${DOC}#useparator`"
    >
      <GalleryExample label="Variants" layout="stack">
        <USeparator />
        <USeparator label="OR" />
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UAvatar"
      description="User avatar with icon or initials fallback; group to stack."
      :usage-href="`${DOC}#uavatar`"
    >
      <GalleryExample label="Single + group">
        <UAvatar icon="i-lucide-user" />
        <UAvatar alt="Ada Lovelace" />
        <UAvatarGroup>
          <UAvatar alt="Ada Lovelace" />
          <UAvatar alt="Alan Turing" />
          <UAvatar alt="Grace Hopper" />
        </UAvatarGroup>
      </GalleryExample>
    </GalleryEntry>
  </section>
</template>
