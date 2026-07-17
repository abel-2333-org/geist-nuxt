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
          // Endpoints are named by purpose (not path). One endpoint appears
          // ONCE; the business scenarios it serves ride along as `scenarios`
          // tags — our APIs aren't strictly RESTful and one endpoint often
          // covers several scenarios (订阅 / 授权 / …).
          { label: '创建结算会话', to: '#checkout-create', scenarios: ['支付', '订阅'], active: true },
        ],
      },
      {
        label: 'DIRECT API',
        kind: 'endpoints',
        items: [
          { label: '发起支付', to: '#pay', scenarios: ['支付', '订阅', '授权'] },
          { label: '捕获支付', to: '#pay-capture', scenarios: ['授权'] },
          { label: '取消支付', to: '#pay-cancel', scenarios: ['支付', '授权'] },
          { label: '冲正支付', to: '#pay-reverse', scenarios: ['退款'] },
          { label: '客户管理', to: '#customers', scenarios: ['订阅', '授权'] },
          { label: '支付授权协议', to: '#mandate', scenarios: ['订阅', '授权'] },
        ],
      },
      {
        label: '卡 TOKEN',
        kind: 'endpoints',
        items: [
          { label: '卡令牌', to: '#token', scenarios: ['支付', '订阅'] },
        ],
      },
      {
        label: '支付方式',
        kind: 'endpoints',
        items: [
          { label: '查询支付方式', to: '#pm-list', scenarios: ['支付'] },
        ],
      },
      {
        label: '支付查询',
        kind: 'endpoints',
        items: [
          { label: '搜索支付', to: '#search-pay', scenarios: ['支付'] },
          { label: '搜索退款', to: '#search-refund', scenarios: ['退款'] },
        ],
      },
      {
        label: '订阅',
        kind: 'endpoints',
        items: [
          { label: '订阅', to: '#subscription', scenarios: ['订阅'], badge: 'beta' },
        ],
      },
      {
        label: 'PAYMENT LINK',
        kind: 'endpoints',
        items: [
          { label: '支付链接', to: '#payment-link', scenarios: ['支付', '订阅'] },
        ],
      },
      {
        label: '退款',
        kind: 'endpoints',
        items: [
          { label: '创建退款', to: '#refund-create', scenarios: ['退款'] },
        ],
      },
      {
        label: 'ETHOCA',
        kind: 'endpoints',
        items: [
          { label: '欺诈告警', to: '#ethoca-alerts', scenarios: ['风控'] },
          { label: '提交告警处理结果', to: '#ethoca-outcome', scenarios: ['风控'] },
          { label: 'Webhook 配置', to: '#ethoca-webhooks', scenarios: ['风控'] },
        ],
      },
    ],
  },
]

// The #header slot stand-in. A real docs app would open <UContentSearch> here
// (⌘K full-text over @nuxt/content); the gallery has no content collection, so
// we just explain the split. defineShortcuts wires ⌘K so the trigger feels real.
const toast = useToast()
function onSiteSearch() {
  toast.add({
    title: '全站搜索（演示占位）',
    description: '真实项目在此处接 UContentSearch（⌘K 全文检索 @nuxt/content）。侧栏内的过滤搜索与它各司其职。',
    icon: 'i-lucide-search',
    color: 'neutral',
  })
}
defineShortcuts({ meta_k: onSiteSearch })
</script>

<template>
  <UContainer class="py-16 sm:py-24">
    <section id="sidebar-nav" class="scroll-mt-20 space-y-10">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">侧边栏导航</h2>
        <p class="max-w-2xl text-muted">
          <code class="font-mono text-[0.8125rem]">ApiDocsSidebarNav</code>：一个菜单容纳多个可折叠板块，
          而各板块指向的页面性质差异很大——「指南」板块是文字链接，接口板块是<b class="font-medium text-toned">按用途命名</b>的端点链接。
          接口不严格遵循 REST、一个接口常服务多个业务场景，所以它<b class="font-medium text-toned">只出现一次</b>，
          行内用<b class="font-medium text-toned">场景标签</b>（订阅、授权…）标明它覆盖哪些场景。板块可同时展开、各带计数；
          顶部单一全局搜索跨所有板块过滤（聚焦时按 <UKbd value="/" /> 快速定位，同时匹配用途名与场景标签），命中板块自动展开，
          让子项很多的大板块（如 <span class="font-mono">DIRECT API</span>）也能被快速检索到。
        </p>
      </div>

      <!-- Mock docs-shell top bar. Site-wide full-text search (⌘K) belongs in
           the app's top navbar — a different level from the sidebar's in-tree
           filter — so the two searches read as distinct, not two look-alike
           boxes stacked together. Real apps put <UContentSearchButton> here. -->
      <div class="flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated/40 px-4 py-2.5">
        <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
          <UIcon name="i-lucide-credit-card" class="size-4 text-muted" />
          支付 API 文档
        </div>
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          class="text-muted"
          @click="onSiteSearch"
        >
          <UIcon name="i-lucide-search" class="size-4" />
          <span class="max-sm:hidden">搜索全部文档</span>
          <span class="flex items-center gap-0.5">
            <UKbd value="meta" />
            <UKbd value="K" />
          </span>
        </UButton>
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
          />
        </div>

        <!-- Explanatory panel: what to try. Not part of the component. -->
        <div class="space-y-4">
          <div class="rounded-lg border border-default bg-elevated/30 p-5">
            <h3 class="mb-3 text-sm font-semibold text-highlighted">试一试</h3>
            <ul class="space-y-2 text-sm text-muted">
              <li class="flex gap-2">
                <UIcon name="i-lucide-command" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span><b class="font-medium text-toned">顶部导航栏</b>的「搜索全部文档」（或按 <UKbd value="meta" /><UKbd value="K" />）是<b class="font-medium text-toned">全站全文搜索</b>——它属于 app top bar，与侧栏的树内过滤不同层级、不并排。真实项目在此接 <code class="font-mono text-[0.8125rem]">UContentSearch</code>（<code class="font-mono text-[0.8125rem]">@nuxt/content</code>）；此处为演示占位。</span>
              </li>
              <li class="flex gap-2">
                <UIcon name="i-lucide-search" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span>在侧栏搜索框输入用途名 <code class="font-mono text-[0.8125rem]">支付</code>，或直接输入<b class="font-medium text-toned">场景名</b> <code class="font-mono text-[0.8125rem]">订阅</code>——搜索<b class="font-medium text-toned">同时匹配用途名与场景标签</b>，输入「订阅」会浮出所有服务该场景的接口。这是导航树内就地过滤：板块被过滤并自动展开，计数徽章显示「命中/总数」。</span>
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
                <span>板块按 <code class="font-mono text-[0.8125rem]">文档</code> / <code class="font-mono text-[0.8125rem]">API 参考</code> 分组，组间有 eyebrow 小标题和分隔线；<b class="font-medium text-toned">指南型</b>板块头是柔和 sans、子项为图标链接，<b class="font-medium text-toned">接口型</b>板块头是大写等宽 mono、子项是<b class="font-medium text-toned">用途名 + 后置场景标签</b>——两类界限分明，chrome 保持中性、颜色只交给 active 态。</span>
              </li>
              <li class="flex gap-2">
                <UIcon name="i-lucide-tag" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span>接口按<b class="font-medium text-toned">用途命名</b>（非路径），一个接口可服务<b class="font-medium text-toned">多个业务场景</b>但只出现一次——如「发起支付」并排 <b class="text-toned">支付</b> <b class="text-toned">订阅</b> <b class="text-toned">授权</b> 三个中性场景标签。当前「创建结算会话」为 active 态。</span>
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
