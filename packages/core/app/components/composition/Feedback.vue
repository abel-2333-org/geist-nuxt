<script setup lang="ts">
// Composition: feedback alerts pairing icon + color + message per state.
// Mirrors references/compositions.md (feedback/empty-loading patterns).
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="font-medium text-highlighted">Feedback</h3>
      <p class="mt-1 text-sm text-muted">Alerts pairing icon, color, and message for each state.</p>
    </template>
    <div class="space-y-4">
      <UAlert
        icon="i-lucide-rocket"
        title="Deployment ready"
        description="Your changes are live on the production branch."
        color="primary"
        variant="subtle"
      />
      <UAlert
        icon="i-lucide-triangle-alert"
        title="Token expiring"
        description="Rotate your API key before it expires in 3 days."
        color="warning"
        variant="subtle"
      />
    </div>
  </UCard>
</template>
