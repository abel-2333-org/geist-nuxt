<script setup lang="ts">
// Foundations: surfaces the Geist token layer that Nuxt UI reads from.
// Colors are shown via the live --ui-* semantic variables so light/dark both stay accurate.
const colorTokens = [
  { name: '--ui-bg', label: 'Background' },
  { name: '--ui-bg-muted', label: 'Background muted' },
  { name: '--ui-bg-elevated', label: 'Background elevated' },
  { name: '--ui-border', label: 'Border' },
  { name: '--ui-text-muted', label: 'Text muted' },
  { name: '--ui-text', label: 'Text' },
]

const primaryShades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

const typeScale = [
  { label: 'Display', class: 'text-5xl font-semibold tracking-tight', sample: 'Ship at the speed of thought' },
  { label: 'Heading', class: 'text-2xl font-semibold tracking-tight', sample: 'Build with Geist + Nuxt UI' },
  { label: 'Body', class: 'text-base', sample: 'High-contrast neutrals, a violet primary, generous whitespace and small radii.' },
  { label: 'Mono', class: 'text-sm font-mono', sample: 'const theme = useColorMode()' },
]

// Geist's 3-tier radius system, mapped onto Nuxt UI's radius scale.
// Control = rounded-sm (6px), Panel = rounded-lg (12px), Overlay = rounded-xl (pinned to 16px).
const radii = [
  { label: 'Control', token: 'rounded-sm', value: '6px', note: '按钮 · 输入 · 徽章' },
  { label: 'Panel', token: 'rounded-lg', value: '12px', note: '卡片 · 面板 · 菜单' },
  { label: 'Overlay', token: 'rounded-xl', value: '16px', note: '模态 · 全屏浮层' },
]

// Geist's restrained 3-tier elevation. Surfaces + borders carry hierarchy first;
// shadows stay subtle. Cards use shadow-xs, popovers shadow-lg, modals shadow-xl.
const elevation = [
  { label: 'Raised', token: 'shadow-xs', class: 'shadow-xs', note: '卡片 · 提示' },
  { label: 'Overlay', token: 'shadow-lg', class: 'shadow-lg', note: '弹出层 · 菜单' },
  { label: 'Modal', token: 'shadow-xl', class: 'shadow-xl', note: '模态 · 抽屉' },
]

// Tailwind's 4px base scale that Nuxt UI spacing utilities build on.
const spacing = [
  { label: '1', value: '4px' },
  { label: '2', value: '8px' },
  { label: '4', value: '16px' },
  { label: '6', value: '24px' },
  { label: '8', value: '32px' },
  { label: '12', value: '48px' },
]
</script>

<template>
  <section id="foundations" class="scroll-mt-20 space-y-10">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">Foundations</h2>
      <p class="text-muted max-w-2xl">
        Geist tokens mapped onto Nuxt UI's semantic <code class="font-mono text-sm">--ui-*</code> layer. Every
        component below reads from these, so theming is a token change, not a rewrite.
      </p>
    </div>

    <!-- Semantic colors -->
    <div class="space-y-4">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wide">Semantic colors</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div v-for="token in colorTokens" :key="token.name" class="space-y-2">
          <div
            class="h-16 rounded-md border border-default"
            :style="{ backgroundColor: `var(${token.name})` }"
          />
          <div class="space-y-0.5">
            <p class="text-sm font-medium text-highlighted">{{ token.label }}</p>
            <p class="font-mono text-xs text-muted">{{ token.name }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Primary ramp -->
    <div class="space-y-4">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wide">Primary ramp (violet)</h3>
      <div class="flex gap-1">
        <div v-for="shade in primaryShades" :key="shade" class="flex-1 space-y-1.5">
          <div
            class="h-16 rounded-md border border-default"
            :style="{ backgroundColor: `var(--ui-color-primary-${shade})` }"
          />
          <p class="text-center font-mono text-[10px] text-muted">{{ shade }}</p>
        </div>
      </div>
    </div>

    <!-- Spacing scale -->
    <div class="space-y-4">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wide">Spacing scale</h3>
      <div class="space-y-2.5">
        <div v-for="s in spacing" :key="s.label" class="flex items-center gap-4">
          <span class="w-10 shrink-0 font-mono text-xs text-muted">{{ s.label }}</span>
          <div class="h-3 rounded-sm bg-primary" :style="{ width: s.value }" />
          <span class="font-mono text-xs text-muted">{{ s.value }}</span>
        </div>
      </div>
    </div>

    <!-- Type scale -->
    <div class="space-y-4">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wide">Type scale · Geist Sans / Mono</h3>
      <div class="space-y-4 rounded-lg border border-default p-6 bg-elevated/40">
        <div v-for="item in typeScale" :key="item.label" class="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
          <span class="w-20 shrink-0 font-mono text-xs text-muted">{{ item.label }}</span>
          <span :class="item.class" class="text-highlighted">{{ item.sample }}</span>
        </div>
      </div>
    </div>

    <!-- Radii -->
    <div class="space-y-4">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wide">Radii · 三层</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="r in radii" :key="r.label" class="flex items-center gap-4 rounded-lg border border-default p-4">
          <div :class="r.token" class="size-14 shrink-0 border border-default bg-elevated" />
          <div class="space-y-0.5">
            <p class="text-sm font-medium text-highlighted">{{ r.label }}</p>
            <p class="font-mono text-xs text-muted">{{ r.token }} · {{ r.value }}</p>
            <p class="text-xs text-muted">{{ r.note }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Elevation -->
    <div class="space-y-4">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wide">Elevation · 阴影层级</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="e in elevation" :key="e.label" class="space-y-3">
          <div :class="e.class" class="h-24 rounded-lg border border-default bg-default" />
          <div class="space-y-0.5">
            <p class="text-sm font-medium text-highlighted">{{ e.label }}</p>
            <p class="font-mono text-xs text-muted">{{ e.token }}</p>
            <p class="text-xs text-muted">{{ e.note }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
