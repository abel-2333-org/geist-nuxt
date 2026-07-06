<script setup lang="ts">
// Domain component (API docs) — a parameter reference table composed from a
// semantic <table> + Nuxt UI UBadge, themed with Geist tokens.
//
// Anatomy:  header row (name / type / required / description) + body rows.
// State:    `required` is shown as a colored badge AND the word (not color only).
// A11y:     real <table> with <thead>/<th scope>, so screen readers announce
//           column headers; monospace for name/type improves scannability.

export interface ApiParam {
  name: string
  type: string
  required?: boolean
  description?: string
}

defineProps<{
  params: ApiParam[]
  /** Column label for the first column, e.g. "Parameter" or "Field". */
  label?: string
}>()
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-default bg-muted/60 text-left">
          <th scope="col" class="px-4 py-2.5 font-medium text-highlighted">
            {{ label ?? 'Parameter' }}
          </th>
          <th scope="col" class="px-4 py-2.5 font-medium text-highlighted">Type</th>
          <th scope="col" class="px-4 py-2.5 font-medium text-highlighted">Required</th>
          <th scope="col" class="px-4 py-2.5 font-medium text-highlighted">Description</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="param in params"
          :key="param.name"
          class="border-b border-default last:border-0"
        >
          <td class="px-4 py-2.5 align-top">
            <code class="font-mono text-highlighted">{{ param.name }}</code>
          </td>
          <td class="px-4 py-2.5 align-top">
            <code class="font-mono text-muted">{{ param.type }}</code>
          </td>
          <td class="px-4 py-2.5 align-top">
            <UBadge
              v-if="param.required"
              color="error"
              variant="subtle"
              size="sm"
            >
              Required
            </UBadge>
            <span v-else class="text-muted">Optional</span>
          </td>
          <td class="px-4 py-2.5 align-top text-muted">
            {{ param.description }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
