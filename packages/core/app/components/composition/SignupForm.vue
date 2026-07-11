<script setup lang="ts">
// Composition: a realistic sign-up form combining UFormField + UInput + USelect
// + USwitch + UButton. Mirrors references/compositions.md (form pattern).
// `ref` is auto-imported by Nuxt.
const email = ref('')
const framework = ref('nuxt')
const notify = ref(true)

const frameworks = [
  { label: 'Nuxt', value: 'nuxt' },
  { label: 'Vue', value: 'vue' },
  { label: 'Vite', value: 'vite' },
]
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="font-medium text-highlighted">Sign-up form</h3>
      <p class="mt-1 text-sm text-muted">Form fields, select, and switch wired with UFormField.</p>
    </template>
    <div class="space-y-4">
      <UFormField label="Email" name="email" help="We only email about incidents.">
        <UInput v-model="email" type="email" placeholder="you@company.com" icon="i-lucide-mail" class="w-full" />
      </UFormField>
      <UFormField label="Framework" name="framework">
        <USelect v-model="framework" :items="frameworks" class="w-full" />
      </UFormField>
      <USwitch v-model="notify" label="Notify me about product updates" />
      <UButton block>Create account</UButton>
    </div>
  </UCard>
</template>
