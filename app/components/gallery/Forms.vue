<script setup lang="ts">
// Catalog group: forms. Route Y — one GalleryEntry per heading in
// references/components/forms.md (UFormField / UForm / 控件). Individual controls
// have no own anchors, so they share the "控件" entry via labelled examples.
const DOC = 'https://github.com/abel-2333-org/geist-nuxt/blob/main/references/components/forms.md'

const state = reactive({ email: '', plan: 'pro', bio: '', notify: true, agree: false })
const plans = [
  { label: 'Hobby', value: 'hobby' },
  { label: 'Pro', value: 'pro' },
  { label: 'Enterprise', value: 'enterprise' },
]
</script>

<template>
  <section id="forms" class="scroll-mt-20 space-y-6">
    <h3 class="text-lg font-semibold tracking-tight text-highlighted">Forms</h3>

    <GalleryEntry
      name="UFormField"
      description="Wraps a control to wire up label, description, error, and ARIA."
      :usage-href="`${DOC}#uformfield`"
    >
      <GalleryExample label="Label + description" layout="stack">
        <UFormField label="Email" description="Used for sign-in" required>
          <UInput v-model="state.email" type="email" placeholder="you@example.com" />
        </UFormField>
      </GalleryExample>

      <GalleryExample label="Error state" layout="stack">
        <UFormField label="Email" error="Enter a valid email address">
          <UInput model-value="not-an-email" />
        </UFormField>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UForm"
      description="Binds reactive state (and an optional schema) for validated submits."
      :usage-href="`${DOC}#uform`"
    >
      <GalleryExample label="State-bound form" layout="stack">
        <UForm :state="state" class="space-y-4">
          <UFormField label="Email" name="email">
            <UInput v-model="state.email" type="email" placeholder="you@example.com" />
          </UFormField>
          <UButton type="submit">Submit</UButton>
        </UForm>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="控件 · Controls"
      description="The control primitives — always placed inside a UFormField."
      :usage-href="`${DOC}#控件`"
    >
      <GalleryExample label="Text inputs" layout="stack">
        <UInput placeholder="UInput" icon="i-lucide-search" />
        <UTextarea v-model="state.bio" :rows="3" placeholder="UTextarea" />
      </GalleryExample>

      <GalleryExample label="Select">
        <USelect v-model="state.plan" :items="plans" class="w-48" />
      </GalleryExample>

      <GalleryExample label="Toggles">
        <UCheckbox v-model="state.agree" label="I agree to the terms" />
        <USwitch v-model="state.notify" label="Email notifications" />
      </GalleryExample>
    </GalleryEntry>
  </section>
</template>
