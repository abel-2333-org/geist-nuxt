<script setup lang="ts">
import type { DocsShellGuidePage } from '~/utils/demo/api-docs/docs-shell-data'

// 指南子页正文：h1 页头 + 段落（`反引号` 片段渲染为内联代码）+ 可选代码块 +
// 页尾 UContentSurround（prev/next）。一页一文的排版参数与参考长滚动页对齐
// （同一 max-w-2xl 度量、同一间距节奏），读者在两种形态间切换时无跳感。
//
// UContentSurround 纯 prop 驱动（[prev, next]），不依赖 @nuxt/content——
// 消费项目接 queryCollectionItemSurroundings 的返回值即可原样替换。

const props = defineProps<{
  page: DocsShellGuidePage
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

      <UContentSurround :surround="surround" class="pt-4" />
    </div>
  </article>
</template>
