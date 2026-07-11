<template>
  <UContainer class="flex flex-col items-start gap-6 py-14 sm:py-20">
    <UBadge color="neutral" variant="outline" size="sm" class="font-mono">
      Design System
    </UBadge>

    <h1 class="text-4xl font-semibold tracking-tight text-highlighted sm:text-5xl lg:text-6xl text-balance">
      geist-nuxt
    </h1>

    <p class="max-w-2xl text-lg text-muted leading-relaxed text-pretty">
      以 <span class="text-highlighted">Vercel Geist</span> 为视觉语言、
      <span class="text-highlighted">Adobe Spectrum</span> 为规格方法论、
      <span class="text-highlighted">Nuxt UI (Vue)</span> 为组件基座的可复用设计系统基座。
      高对比中性色搭配紫色主色、Geist Sans / Mono 字体、小圆角与大留白。
    </p>

    <div class="flex flex-wrap items-center gap-3">
      <UButton size="lg" trailing-icon="i-lucide-arrow-right">
        开始使用
      </UButton>
      <UButton
        size="lg"
        color="neutral"
        variant="outline"
        icon="i-lucide-book-open"
        to="https://ui.nuxt.com"
        target="_blank"
      >
        组件文档
      </UButton>
    </div>
  </UContainer>
</template>
