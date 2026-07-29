<script setup lang="ts">
// Showcase compositions — the visual mirror of references/compositions.md.
// Reusable compositions stay in foundation/compositions. Static specimens live
// here because their copy and fixture state exist only to explain a pattern.
//
// Deliberately NOT here:
// - single-component展示 (Button/Badge variants…) → that is GalleryCatalog's job
// - semantic color / token展示 → that is Foundations' job
const email = shallowRef('')
const framework = shallowRef('nuxt')
const notify = shallowRef(true)

const frameworks = [
  { label: 'Nuxt', value: 'nuxt' },
  { label: 'Vue', value: 'vue' },
  { label: 'Vite', value: 'vite' },
]
</script>

<template>
  <section id="compositions" class="scroll-mt-20 space-y-10">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">Compositions</h2>
      <p class="text-muted max-w-2xl">
        Signature Nuxt UI components composed the way real screens use them, themed by Geist tokens.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
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

      <UCard>
        <template #header>
          <h3 class="font-medium text-highlighted">Navigation</h3>
          <p class="mt-1 text-sm text-muted">Tabs for section switching, kbd for shortcut hints.</p>
        </template>
        <div class="space-y-4">
          <UTabs
            :items="[
              { label: 'Overview', icon: 'i-lucide-layout-dashboard' },
              { label: 'Usage', icon: 'i-lucide-activity' },
              { label: 'Settings', icon: 'i-lucide-settings' },
            ]"
          />
          <div class="flex items-center gap-2">
            <UKbd>⌘</UKbd>
            <UKbd>K</UKbd>
            <span class="text-sm text-muted">to open the command menu</span>
          </div>
        </div>
      </UCard>
    </div>
  </section>
</template>
