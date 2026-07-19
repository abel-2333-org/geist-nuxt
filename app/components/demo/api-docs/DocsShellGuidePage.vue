<script setup lang="ts">
import type { DocsShellGuidePage } from '~/utils/demo/api-docs/docs-shell-data'

// 指南子页正文：h1 页头 + 段落（`反引号` 片段渲染为内联代码）+ 可选代码块 +
// 页尾 prev/next。一页一文的排版参数与参考长滚动页对齐（同一 max-w-2xl
// 度量、同一间距节奏），读者在两种形态间切换时无跳感。
//
// prev/next 为自组实现：UContentSurround 只在装了 @nuxt/content 时注册，
// 本项目未装（demo 数据直供）。样式对齐 Nuxt UI content-surround 主题
// （grid 双列卡片 + 图标徽 + hover 强调）；surround 的数据形状与
// queryCollectionItemSurroundings 返回值兼容——消费项目装了 content 后
// 用 <UContentSurround :surround="surround" /> 原样替换页尾即可。

const props = defineProps<{
  page: DocsShellGuidePage
  /** [prev, next]，与 UContentSurround 的 surround prop 同形。 */
  surround: { path: string, title: string, description?: string }[]
}>()

/** 把段落按 `反引号` 切成 text/code token（避免 v-html）。 */
function toTokens(paragraph: string) {
  return paragraph.split(/(`[^`]+`)/g).filter(Boolean).map(part =>
    part.startsWith('`') && part.endsWith('`')
      ? { code: true, text: part.slice(1, -1) }
      : { code: false, text: part },
  )
}
</script>

<template>
  <article class="min-w-0 px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
    <div class="mx-auto w-full max-w-3xl space-y-8">
      <header class="space-y-3 border-b border-default pb-8">
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted text-balance">{{ props.page.title }}</h1>
        <p class="leading-relaxed text-muted text-pretty">{{ props.page.description }}</p>
      </header>

      <div class="space-y-5">
        <p
          v-for="(paragraph, i) in props.page.paragraphs"
          :key="i"
          class="max-w-2xl leading-relaxed text-muted text-pretty"
        >
          <template v-for="(token, j) in toTokens(paragraph)" :key="j">
            <code v-if="token.code" class="font-mono text-[0.8125rem] text-toned">{{ token.text }}</code>
            <template v-else>{{ token.text }}</template>
          </template>
        </p>

        <ApiDocsCodeBlock
          v-if="props.page.code"
          :variants="props.page.code.variants"
          :title="props.page.code.title"
          :labels="{ language: '语言', copy: '复制代码', copied: '已复制到剪贴板', copyToast: '代码' }"
        />
      </div>

      <nav aria-label="上一篇 / 下一篇" class="grid grid-cols-1 gap-8 pt-4 sm:grid-cols-2">
        <template v-for="(link, i) in props.surround" :key="link.path">
          <ULink
            :to="link.path"
            raw
            class="group block rounded-lg border border-default px-6 py-8 transition-colors outline-primary/25 hover:bg-elevated/50 focus-visible:border-primary focus-visible:outline-3"
            :class="i === 1 ? 'text-end' : ''"
          >
            <div class="mb-4 inline-flex items-center rounded-full bg-elevated p-1.5 ring ring-accented transition group-hover:bg-primary/10 group-hover:ring-primary/50">
              <UIcon
                :name="i === 0 ? 'i-lucide-arrow-left' : 'i-lucide-arrow-right'"
                class="size-5 shrink-0 text-highlighted transition-[color,translate] group-hover:text-primary"
                :class="i === 0 ? 'group-active:-translate-x-0.5' : 'group-active:translate-x-0.5'"
              />
            </div>
            <p class="mb-1 truncate text-[15px] font-medium text-highlighted">{{ link.title }}</p>
            <p class="line-clamp-2 text-sm text-muted">{{ link.description }}</p>
          </ULink>
        </template>
      </nav>
    </div>
  </article>
</template>
