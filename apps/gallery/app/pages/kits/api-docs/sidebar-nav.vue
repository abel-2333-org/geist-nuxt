<script setup lang="ts">
definePageMeta({ nav: { label: '侧边栏导航', icon: 'i-lucide-panel-left', order: 2 } })

// Demo/story for <ApiDocsSidebarNav> — per the geist-nuxt layering, demos live
// in gallery and the kit only ships the data-agnostic component. Inline fake
// ViewModel drives one payments-style docs portal sidebar, now split into two
// labelled groups so the guide/endpoints boundary is unmistakable:
//   · "文档"      — guide-kind sections (prose + SDK), soft sans headers.
//   · "API 参考"  — endpoints-kind sections, UPPER MONO headers + method badges,
//                    including one deliberately long section (DIRECT API) that
//                    exercises the global search filter + force-open + in-nav
//                    scroll at real scale.
type Item = { label: string; to?: string; method?: string; icon?: string; badge?: string | number; active?: boolean }
type Section = { label: string; kind?: 'guide' | 'endpoints'; icon?: string; defaultOpen?: boolean; items: Item[] }
type Group = { label?: string; sections: Section[] }

const groups: Group[] = [
  {
    label: '文档',
    sections: [
      {
        label: '指南',
        kind: 'guide',
        icon: 'i-lucide-book-open',
        defaultOpen: true,
        items: [
          { label: '概览', to: '#overview', icon: 'i-lucide-compass' },
          { label: '快速开始', to: '#quickstart', icon: 'i-lucide-rocket' },
          { label: '认证与密钥', to: '#auth', icon: 'i-lucide-key-round' },
          { label: '测试环境', to: '#sandbox', icon: 'i-lucide-flask-conical' },
          { label: 'Webhook 通知', to: '#webhooks', icon: 'i-lucide-webhook' },
        ],
      },
      {
        label: 'SDK',
        kind: 'guide',
        icon: 'i-lucide-package',
        items: [
          { label: 'JavaScript', to: '#sdk-js', icon: 'i-simple-icons-javascript' },
          { label: 'Python', to: '#sdk-py', icon: 'i-simple-icons-python' },
        ],
      },
    ],
  },
  {
    label: 'API 参考',
    sections: [
      {
        label: 'CHECKOUT',
        kind: 'endpoints',
        defaultOpen: true,
        items: [
          { label: '/checkout/sessions', to: '#checkout-create', method: 'POST', active: true },
        ],
      },
      {
        label: 'DIRECT API',
        kind: 'endpoints',
        items: [
          { label: '/payments', to: '#pay-create', method: 'POST' },
          { label: '/payments/{id}', to: '#pay-get', method: 'GET' },
          { label: '/payments/{id}', to: '#pay-update', method: 'PATCH' },
          { label: '/payments/{id}/capture', to: '#pay-capture', method: 'POST' },
          { label: '/payments/{id}/cancel', to: '#pay-cancel', method: 'POST' },
          { label: '/payments/{id}/reverse', to: '#pay-reverse', method: 'POST' },
          { label: '/authorizations', to: '#auth-create', method: 'POST' },
          { label: '/authorizations/{id}', to: '#auth-get', method: 'GET' },
          { label: '/authorizations/{id}', to: '#auth-void', method: 'DELETE' },
          { label: '/customers', to: '#cust-list', method: 'GET' },
          { label: '/customers', to: '#cust-create', method: 'POST' },
          { label: '/customers/{id}', to: '#cust-update', method: 'PUT' },
          { label: '/mandates/{id}', to: '#mandate-get', method: 'GET' },
        ],
      },
      {
        label: '卡 TOKEN',
        kind: 'endpoints',
        items: [
          { label: '/tokens', to: '#token-create', method: 'POST' },
          { label: '/tokens/{id}', to: '#token-get', method: 'GET' },
          { label: '/tokens/{id}', to: '#token-delete', method: 'DELETE' },
        ],
      },
      {
        label: '支付方式',
        kind: 'endpoints',
        items: [
          { label: '/payment-methods', to: '#pm-list', method: 'GET' },
        ],
      },
      {
        label: '支付查询',
        kind: 'endpoints',
        items: [
          { label: '/search/payments', to: '#search-pay', method: 'POST' },
          { label: '/search/refunds', to: '#search-refund', method: 'POST' },
        ],
      },
      {
        label: '订阅',
        kind: 'endpoints',
        items: [
          { label: '/subscriptions', to: '#sub-create', method: 'POST', badge: 'beta' },
          { label: '/subscriptions/{id}', to: '#sub-get', method: 'GET' },
        ],
      },
      {
        label: 'PAYMENT LINK',
        kind: 'endpoints',
        items: [
          { label: '/payment-links', to: '#link-create', method: 'POST' },
          { label: '/payment-links/{id}', to: '#link-get', method: 'GET' },
          { label: '/payment-links/{id}', to: '#link-expire', method: 'DELETE' },
        ],
      },
      {
        label: '退款',
        kind: 'endpoints',
        items: [
          { label: '/refunds', to: '#refund-create', method: 'POST' },
        ],
      },
      {
        label: 'ETHOCA',
        kind: 'endpoints',
        items: [
          { label: '/ethoca/alerts', to: '#ethoca-list', method: 'GET' },
          { label: '/ethoca/alerts/{id}', to: '#ethoca-get', method: 'GET' },
          { label: '/ethoca/alerts/{id}/outcome', to: '#ethoca-outcome', method: 'POST' },
          { label: '/ethoca/webhooks', to: '#ethoca-hook-create', method: 'POST' },
          { label: '/ethoca/webhooks/{id}', to: '#ethoca-hook-delete', method: 'DELETE' },
        ],
      },
    ],
  },
]
</script>

<template>
  <UContainer class="py-16 sm:py-24">
    <section id="sidebar-nav" class="scroll-mt-20 space-y-10">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">侧边栏导航</h2>
        <p class="max-w-2xl text-muted">
          <code class="font-mono text-[0.8125rem]">ApiDocsSidebarNav</code>：一个菜单容纳多个可折叠板块，
          而各板块指向的页面性质差异很大——「指南」板块是文字链接，接口板块是带
          <code class="font-mono text-[0.8125rem]">method</code> 色标的端点链接。板块可同时展开、各带计数；
          顶部单一全局搜索跨所有板块过滤（聚焦时按 <UKbd value="/" /> 快速定位），命中板块自动展开，
          让子项很多的大板块（如 <span class="font-mono">DIRECT API</span>）也能被快速检索到。
        </p>
      </div>

      <div class="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <!-- The sidebar itself, sticky like a real docs shell. -->
        <div class="lg:sticky lg:top-20 lg:self-start">
          <ApiDocsSidebarNav
            :groups="groups"
            aria-label="支付文档"
            search-placeholder="搜索文档"
            clear-label="清除搜索"
            empty-label="没有匹配的页面"
            method-filter-label="按方法筛选"
          />
        </div>

        <!-- Explanatory panel: what to try. Not part of the component. -->
        <div class="space-y-4">
          <div class="rounded-lg border border-default bg-elevated/30 p-5">
            <h3 class="mb-3 text-sm font-semibold text-highlighted">试一试</h3>
            <ul class="space-y-2 text-sm text-muted">
              <li class="flex gap-2">
                <UIcon name="i-lucide-search" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span>在顶部搜索框输入 <code class="font-mono text-[0.8125rem]">payments</code> 或 <code class="font-mono text-[0.8125rem]">POST</code>，观察板块被过滤并自动展开，计数徽章显示「命中/总数」。</span>
              </li>
              <li class="flex gap-2">
                <UIcon name="i-lucide-filter" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span>点搜索框下方的 <b class="font-mono text-toned">GET</b> / <b class="font-mono text-toned">POST</b> 等方法 chip 只看某类接口（可多选、与关键词叠加）；chip 只在数据里真的出现该方法时才显示。</span>
              </li>
              <li class="flex gap-2">
                <UIcon name="i-lucide-keyboard" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span>把焦点移出输入框后按 <UKbd value="/" /> 可瞬间聚焦搜索；按 <UKbd value="esc" /> 清空并失焦。</span>
              </li>
              <li class="flex gap-2">
                <UIcon name="i-lucide-list-tree" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span>多个板块可同时展开对照；菜单再长也只在侧栏内部滚动，不推动页面。</span>
              </li>
              <li class="flex gap-2">
                <UIcon name="i-lucide-layers" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span>板块按 <code class="font-mono text-[0.8125rem]">文档</code> / <code class="font-mono text-[0.8125rem]">API 参考</code> 分组，组间有 eyebrow 小标题和分隔线；<b class="font-medium text-toned">指南型</b>板块头是柔和 sans、子项为图标链接，<b class="font-medium text-toned">接口型</b>板块头是大写等宽 mono、子项带 method 色标——两类界限分明，chrome 保持中性、颜色只交给 method 色标与 active 态。</span>
              </li>
              <li class="flex gap-2">
                <UIcon name="i-lucide-tag" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span>接口行的 method 色标复用 <code class="font-mono text-[0.8125rem]">ApiDocsMethodBadge</code>。当前 <span class="font-mono">/checkout/sessions</span> 为 active 态。</span>
              </li>
            </ul>
          </div>

          <p class="text-sm text-dimmed">
            数据由本页内联假 ViewModel 驱动，不写进 kit。接口链接指向 <code class="font-mono text-[0.8125rem]">#</code> 锚点仅作演示。
          </p>
        </div>
      </div>
    </section>
  </UContainer>
</template>
