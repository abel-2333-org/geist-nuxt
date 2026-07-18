<script setup lang="ts">
// Catalog group: feedback. One GalleryEntry per heading in
// references/components/feedback.md (route Y). Usage links point to that doc.
const DOC = 'https://github.com/abel-2333-org/geist-nuxt/blob/main/references/components/feedback.md'

const toast = useToast()
function fireToast() {
  toast.add({ title: 'Saved', description: 'Your changes are live.', color: 'success', icon: 'i-lucide-check' })
}
</script>

<template>
  <section id="feedback" class="scroll-mt-20 space-y-6">
    <h3 class="text-lg font-semibold tracking-tight text-highlighted">Feedback</h3>

    <GalleryEntry
      name="UAlert"
      description="Inline message pairing icon, semantic color, title, and description."
      :usage-href="`${DOC}#ualert`"
    >
      <GalleryExample label="Semantic colors" layout="stack">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-check-circle"
          title="Payment received"
          description="Your subscription is now active."
        />
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Usage nearing limit"
          description="You have used 90% of your quota."
        />
        <UAlert
          color="error"
          variant="subtle"
          icon="i-lucide-x-circle"
          title="Deployment failed"
          description="Check the build logs for details."
        />
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UToast"
      description="Transient notification fired via the useToast() composable."
      :usage-href="`${DOC}#utoastusetoast`"
    >
      <GalleryExample label="Trigger">
        <UButton color="neutral" variant="outline" icon="i-lucide-bell" @click="fireToast">
          Show toast
        </UButton>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UProgress"
      description="Determinate or indeterminate progress indicator."
      :usage-href="`${DOC}#uprogress`"
    >
      <GalleryExample label="Values" layout="stack">
        <UProgress :model-value="30" />
        <UProgress :model-value="70" color="success" />
        <UProgress />
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="USkeleton"
      description="Loading placeholder built from Tailwind size classes."
      :usage-href="`${DOC}#uskeleton`"
    >
      <GalleryExample label="Content placeholder" layout="stack">
        <USkeleton class="h-8 w-8 rounded-full" />
        <USkeleton class="h-4 w-48" />
        <USkeleton class="h-4 w-32" />
      </GalleryExample>
    </GalleryEntry>
  </section>
</template>
