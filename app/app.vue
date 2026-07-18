<script setup lang="ts">
import { zh_cn } from '@nuxt/ui/locale'

useHead({
  title: 'geist-nuxt · Geist visual language on Nuxt UI',
  meta: [
    {
      name: 'description',
      content:
        'A Source-first design system workspace: Vercel Geist visual language, Adobe Spectrum spec methodology, built on Nuxt UI (Vue).',
    },
  ],
  link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  htmlAttrs: { lang: 'zh-CN' },
})
</script>

<template>
  <UApp :locale="zh_cn">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
