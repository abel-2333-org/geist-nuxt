<script setup lang="ts">
// Uses Nuxt UI's built-in color mode (via @nuxtjs/color-mode, auto-registered).
const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

function toggle() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <ClientOnly>
    <UTooltip :text="isDark ? '切换到浅色' : '切换到深色'">
      <UButton
        :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
        color="neutral"
        variant="ghost"
        :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
        @click="toggle"
      />
    </UTooltip>

    <template #fallback>
      <UButton icon="i-lucide-sun" color="neutral" variant="ghost" aria-label="切换颜色模式" />
    </template>
  </ClientOnly>
</template>
