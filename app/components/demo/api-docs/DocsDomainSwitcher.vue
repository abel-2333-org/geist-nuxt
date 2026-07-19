<script setup lang="ts">
// 域切换器（UPopover + 域卡片面板）：产品级入口用「卡片网格」而不是下拉
// 列表——每张卡 = tile 图标 + 域名 + 一句话简介。这是 Vercel/Stripe 产品
// 切换器的同构形态；用现成原语组合（UPopover + NuxtLink 卡片），不造新组件。
//
// 每个域是独立路径（consumer shape 的路径分段路由），所以卡片就是
// NuxtLink——真实页面导航，非本地状态切换：浏览器原生支持新标签打开、
// 复制链接、前进后退；当前域用 aria-current="page" 表达，配打勾图标，
// 不只靠颜色。键盘 = 链接原生 Tab 顺序，无需自管焦点。
//
// 图标样式遵循 Spectrum 对 workflow icon 的用法：产品级入口的图标不裸露，
// 由圆角容器（tile）承载、与 label 成对出现——对应本系统「色调表面 + 边框
// 优先」的层级语义（tile = bg-elevated + border，当前域转 primary 着色、
// 克制 tint 而非重描边）。
//
// 面板宽度用 container scale token（w-md = 28rem）：两列布局下最长简介
// （12 字）仍单行，避免 CJK 逐字折行把词拆开（如「退/款」）。小屏两列
// 每张卡太窄、简介必然折行——降为单列；域只有四个，单列纵向也不长。

export interface DocsDomainSwitcherItem {
  id: string
  label: string
  description: string
  icon: string
  /** 该域的页面路径（由外壳拼好传入，本组件保持路由结构无关）。 */
  to: string
}

const props = defineProps<{
  domains: DocsDomainSwitcherItem[]
  currentId: string
  ariaLabel?: string
}>()

const open = shallowRef(false)
const activeDomain = computed(() => props.domains.find(domain => domain.id === props.currentId))
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start', sideOffset: 8 }">
    <UButton
      variant="ghost"
      color="neutral"
      size="sm"
      trailing-icon="i-lucide-chevrons-up-down"
      :aria-label="props.ariaLabel ?? `切换文档域，当前：${activeDomain?.label ?? ''}`"
      class="min-w-0"
    >
      <span class="flex min-w-0 items-center gap-2">
        <span class="flex size-5 shrink-0 items-center justify-center rounded border border-default bg-elevated">
          <UIcon v-if="activeDomain" :name="activeDomain.icon" class="size-3 text-muted" />
        </span>
        <span class="truncate text-highlighted">{{ activeDomain?.label }}</span>
      </span>
    </UButton>

    <template #content>
      <nav class="w-md max-w-[calc(100vw-2rem)] p-2" aria-label="文档域">
        <p class="px-2 pb-2 pt-1 text-xs font-medium text-dimmed">切换文档域</p>
        <ul class="grid list-none grid-cols-1 gap-1.5 sm:grid-cols-2">
          <li v-for="domain in props.domains" :key="domain.id">
            <NuxtLink
              :to="domain.to"
              :aria-current="domain.id === props.currentId ? 'page' : undefined"
              class="group flex items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="domain.id === props.currentId
                ? 'border-primary/25 bg-primary/5'
                : 'border-transparent hover:border-default hover:bg-elevated/60'"
              @click="open = false"
            >
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors"
                :class="domain.id === props.currentId
                  ? 'border-primary/25 bg-primary/10 text-primary'
                  : 'border-default bg-elevated text-muted group-hover:text-toned'"
              >
                <UIcon :name="domain.icon" class="size-4" />
              </span>
              <span class="flex min-w-0 flex-col gap-0.5">
                <span class="flex items-center gap-1.5 text-sm/5 font-medium text-highlighted">
                  {{ domain.label }}
                  <UIcon
                    v-if="domain.id === props.currentId"
                    name="i-lucide-check"
                    class="size-3.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                </span>
                <span class="text-xs leading-relaxed text-muted">{{ domain.description }}</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </template>
  </UPopover>
</template>
