<script setup lang="ts">
import { docsShellDomains, paymentsGuidePages } from '~/utils/demo/api-docs/docs-shell-data'

// 指南子页：一页一文、线性阅读——「指南分页、参考长滚动」拆页策略的分页侧
// （消费项目对应 /docs/[domain]/[...slug] + @nuxt/content，此处 demo 数据
// 直供）。页尾 UContentSurround 串出上一篇/下一篇学习路径，首尾分别接回
// 域首页（概览）与端点参考（长滚动锚点）。
//
// demo 只给支付域配了指南子页（最小示范）；其余域与非法 slug 一律 replace
// 回域首页，与 [domain]/index.vue 的非法域回落同一策略。
const route = useRoute()

const domain = computed(() =>
  docsShellDomains.find(item => item.id === route.params.domain),
)

const page = computed(() =>
  domain.value?.id === 'payments'
    ? paymentsGuidePages.find(p => p.slug === route.params.slug)
    : undefined,
)

if (!domain.value) {
  await navigateTo(`/kits/api-docs/docs-shell/${docsShellDomains[0]!.id}`, { replace: true })
}
else if (!page.value) {
  await navigateTo(`/kits/api-docs/docs-shell/${domain.value.id}`, { replace: true })
}

// prev/next：数组序即阅读序；第一篇的 prev 是域首页（概览），最后一篇的
// next 是端点参考（域首页的长滚动锚点）——指南读完自然落进 API 参考。
const surround = computed(() => {
  if (!domain.value || !page.value) return []
  const base = `/kits/api-docs/docs-shell/${domain.value.id}`
  const index = paymentsGuidePages.findIndex(p => p.slug === page.value!.slug)
  const prev = index > 0
    ? { path: `${base}/${paymentsGuidePages[index - 1]!.slug}`, title: paymentsGuidePages[index - 1]!.title, description: paymentsGuidePages[index - 1]!.description }
    : { path: base, title: '概览', description: `${domain.value.label}域文档首页与两条收款路径。` }
  const next = index < paymentsGuidePages.length - 1
    ? { path: `${base}/${paymentsGuidePages[index + 1]!.slug}`, title: paymentsGuidePages[index + 1]!.title, description: paymentsGuidePages[index + 1]!.description }
    : { path: `${base}#checkout-create`, title: 'API 参考', description: '创建结算会话——字段树与请求/响应示例。' }
  return [prev, next]
})
</script>

<template>
  <DemoApiDocsShell v-if="domain && page" :domain="domain">
    <DemoApiDocsShellGuidePage :page="page" :surround="surround" />
  </DemoApiDocsShell>
</template>
