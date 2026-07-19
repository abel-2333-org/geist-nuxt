<script setup lang="ts">
import { docsShellDomains } from '~/utils/demo/api-docs/docs-shell-data'

// 域页面：每个文档域一个独立路径（/docs-shell/payments、/docs-shell/payouts…），
// 与消费项目的 /docs/[domain]/[...slug] 形态同构——独立规范 URL、可分享、
// 可收藏，域切换器直接用 NuxtLink。useGalleryNav 跳过动态路由，本页不进
// gallery 导航（入口由 index.vue 承担）。
//
// 非法域 replace 跳回默认域，不留历史记录。
const route = useRoute()

const domain = computed(() =>
  docsShellDomains.find(item => item.id === route.params.domain),
)

if (!domain.value) {
  await navigateTo(`/kits/api-docs/docs-shell/${docsShellDomains[0]!.id}`, { replace: true })
}
</script>

<template>
  <DemoApiDocsShell v-if="domain" :domain="domain" />
</template>
