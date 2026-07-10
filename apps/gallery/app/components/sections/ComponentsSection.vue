<script setup lang="ts">
// Signature Nuxt UI components composed in realistic groupings, themed by Geist tokens.
// `ref` is auto-imported by Nuxt.
const email = ref('')
const framework = ref('nuxt')
const notify = ref(true)

const frameworks = [
  { label: 'Nuxt', value: 'nuxt' },
  { label: 'Vue', value: 'vue' },
  { label: 'Vite', value: 'vite' },
]

const semantics = ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'] as const
</script>

<template>
  <section id="components" class="scroll-mt-20 space-y-10">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">Components</h2>
      <p class="text-muted max-w-2xl">
        A curated slice of the 122-component library, composed the way real screens use them.
      </p>
    </div>

    <!-- Semantic color roles -->
    <UCard>
      <template #header>
        <h3 class="font-medium text-highlighted">Semantic colors</h3>
      </template>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="role in semantics" :key="role" class="space-y-2">
          <div
            class="h-12 rounded-md border border-default"
            :style="{ backgroundColor: `var(--ui-color-${role}-500)` }"
          />
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-highlighted capitalize">{{ role }}</span>
            <UBadge :color="role" variant="subtle" size="sm">Aa</UBadge>
          </div>
        </div>
      </div>
    </UCard>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Buttons + badges -->
      <UCard>
        <template #header>
          <h3 class="font-medium text-highlighted">Actions &amp; status</h3>
        </template>
        <div class="space-y-5">
          <div class="flex flex-wrap items-center gap-3">
            <UButton>Primary</UButton>
            <UButton color="neutral" variant="outline">Outline</UButton>
            <UButton color="neutral" variant="ghost">Ghost</UButton>
            <UButton color="primary" variant="subtle">Subtle</UButton>
            <UButton icon="i-lucide-arrow-right" trailing>Continue</UButton>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UBadge>Default</UBadge>
            <UBadge color="neutral" variant="subtle">Neutral</UBadge>
            <UBadge color="success" variant="subtle">Stable</UBadge>
            <UBadge color="warning" variant="subtle">Beta</UBadge>
            <UBadge color="error" variant="subtle">Deprecated</UBadge>
          </div>
          <div class="flex items-center gap-3">
            <UButton size="xs">xs</UButton>
            <UButton size="sm">sm</UButton>
            <UButton size="md">md</UButton>
            <UButton size="lg">lg</UButton>
          </div>
        </div>
      </UCard>

      <!-- Form -->
      <UCard>
        <template #header>
          <h3 class="font-medium text-highlighted">Sign-up form</h3>
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

      <!-- Feedback -->
      <UCard>
        <template #header>
          <h3 class="font-medium text-highlighted">Feedback</h3>
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

      <!-- Navigation -->
      <UCard>
        <template #header>
          <h3 class="font-medium text-highlighted">Navigation</h3>
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
