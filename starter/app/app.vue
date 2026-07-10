<script setup lang="ts">
useHead({
  title: 'geist-nuxt starter',
  meta: [
    {
      name: 'description',
      content: 'A clean Nuxt starter on the geist-nuxt design system (@geist-nuxt/core).',
    },
  ],
  link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  htmlAttrs: { lang: 'zh-CN' },
})
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
