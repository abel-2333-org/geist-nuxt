<script setup lang="ts">
// docs-shell 采用真实 consumer shape 的路径分段路由：/docs-shell/[domain]。
// 本入口只负责把裸路径重定向到默认域（redirect 值必须是编译期字面量，
// 与 docs-shell-data 的首域 id 保持一致）。gallery 导航仍指向本路径。
definePageMeta({
  nav: { label: '文档站外壳', icon: 'i-lucide-layout-template', order: 6 },
  redirect: '/kits/api-docs/docs-shell/payments',
})
</script>

<template>
  <div />
</template>
