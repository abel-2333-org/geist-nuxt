<script setup lang="ts">
const cardVariants = ['solid', 'outline', 'soft', 'subtle', 'default'] as const
const emptyVariants = ['solid', 'outline', 'soft', 'subtle', 'naked', 'default'] as const
const pageCardVariants = ['solid', 'outline', 'soft', 'subtle', 'ghost', 'naked', 'default'] as const
const pricingSlots = 'description discount billingCycle billingPeriod featureTitle tagline terms'
</script>

<template>
  <section data-testid="container-variants" class="space-y-8">
    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="variant in cardVariants" :key="variant"
        :data-testid="`card-${variant}`" data-contrast-component="Card" :data-contrast-variant="variant"
        data-contrast-slots="description" data-contrast-input="props"
      >
        <UCard v-bind="variant === 'default' ? {} : { variant }" title="Card title" description="Card description">
          Card body
          <template #footer>Card footer</template>
        </UCard>
      </div>
      <div
        data-testid="card-solid-slot" data-contrast-component="Card" data-contrast-variant="solid"
        data-contrast-slots="description" data-contrast-input="slot"
      >
        <UCard variant="solid" title="Named slot card">
          <template #description>Named slot description</template>
        </UCard>
      </div>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="variant in emptyVariants" :key="variant"
        :data-testid="`empty-${variant}`" data-contrast-component="Empty" :data-contrast-variant="variant"
        data-contrast-slots="description" data-contrast-input="props"
      >
        <UEmpty v-bind="variant === 'default' ? {} : { variant }" title="Empty title" description="Empty description" />
      </div>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="variant in emptyVariants" :key="variant"
        :data-testid="`page-cta-${variant}`" data-contrast-component="PageCTA" :data-contrast-variant="variant"
        data-contrast-slots="description" data-contrast-input="props"
      >
        <UPageCTA v-bind="variant === 'default' ? {} : { variant }" title="CTA title" description="CTA description" />
      </div>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="variant in pageCardVariants" :key="variant"
        :data-testid="`page-card-${variant}`" data-contrast-component="PageCard" :data-contrast-variant="variant"
        data-contrast-slots="description" data-contrast-input="props"
      >
        <UPageCard
          v-bind="variant === 'default' ? {} : { variant }"
          to="#__contrast-page-card-target" title="Page card title" description="Page card description"
        />
      </div>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="variant in cardVariants" :key="variant"
        :data-testid="`pricing-plan-${variant}`" data-contrast-component="PricingPlan" :data-contrast-variant="variant"
        :data-contrast-slots="pricingSlots" data-contrast-input="props"
      >
        <UPricingPlan
          v-bind="variant === 'default' ? {} : { variant }"
          title="Pricing title" description="Pricing description"
          price="$20" discount="$10" billing-period="per month" billing-cycle="billed yearly"
          :features="['Included feature']" tagline="Plan tagline" terms="Plan terms"
        />
      </div>
    </div>
    <span id="__contrast-page-card-target" class="text-muted">Page card navigation target</span>
  </section>
</template>
