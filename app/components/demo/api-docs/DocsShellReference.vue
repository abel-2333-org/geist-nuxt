<script setup lang="ts">
import {
  paymentsBodyFields,
  paymentsEndpoint,
  paymentsEndpointStubs,
  paymentsQuickstartVariants,
  paymentsRequestScenarios,
  paymentsResponseFields,
  paymentsResponseScenarios,
  type DocsShellDomain,
} from '~/utils/demo/api-docs/docs-shell-data'

// 文档站外壳的正文列：指南锚点 section + reference 式端点页。出血布局下由
// 正文列自己管理内边距（不依赖外层容器）。
//
// 支付域是完整样板——端点 reference 与 /kits/api-docs/reference 同构：
// 横向分栏用通用基座的 <SplitPane>（lg+ 可拖拽、独立 storage key 持久化，
// <lg 自动堆叠），右侧代码栏用 gallery 私有的 <DemoApiDocsCodeRail>
// （Request 上 / Response 下，纵向高度可拖 + 内容优先重分配）。
// 其余域走 stub 分支：overview + 指南段 + 端点 stub，保证该域侧栏与 ⌘K
// 索引里的每个锚点都有落点——真实项目里每个域都长成支付域那样。
//
// sticky 顶距与锚点 scroll-margin 统一走外壳的 --docs-shell-sticky-offset
// （由 DocsShell 定义 = 全局 header + 外壳工具栏 + 呼吸间距），单点维护。

const props = defineProps<{
  domain: DocsShellDomain
}>()

// 深链接：带 `#path` 进入时自动展开 + 滚动定位到对应字段（三层导航的第三层）。
const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())
</script>

<template>
  <!-- 支付域：完整样板（指南 + reference 式端点页）。标题层级：页面唯一
       h1 = 域名（overview 段打头），指南段与端点均为 h2，之下才是 h3——
       路径路由下每个域就是一个 route，h1 属于 route 级页头。 -->
  <div v-if="props.domain.id === 'payments'" class="min-w-0 space-y-14 px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
    <section id="overview" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ props.domain.label }}</h1>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">
        支付 API 按业务用途组织：先用「创建结算会话」把顾客送进托管收银台，需要更细控制时改用
        Direct API 自行编排授权、捕获与退款。所有接口共用同一套密钥与 Webhook 通知机制。
      </p>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">
        左侧菜单里接口按<b class="font-medium text-toned">用途</b>命名，行首的方法色标说「怎么调」、行尾的场景标签说「用在哪」。
        找不到入口时用顶栏的全站搜索（<UKbd value="meta" /><UKbd value="K" />），输入场景名（如「订阅」）或方法名（如「POST」）都能命中。
      </p>
    </section>

    <section id="quickstart" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3">
      <h2 class="text-xl font-semibold tracking-tight text-highlighted">快速开始</h2>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">
        用测试密钥创建一个结算会话，把返回的 <code class="font-mono text-[0.8125rem]">url</code> 交给顾客即可完成一笔沙箱支付：
      </p>
      <ApiDocsCodeBlock
        :variants="paymentsQuickstartVariants"
        title="创建你的第一个结算会话"
        :labels="{ language: '语言', copy: '复制代码', copied: '已复制到剪贴板', copyToast: '代码' }"
      />
    </section>

    <section id="auth" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3">
      <h2 class="text-xl font-semibold tracking-tight text-highlighted">认证与密钥</h2>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">
        所有请求通过 <code class="font-mono text-[0.8125rem]">Authorization: Bearer</code> 头携带密钥。测试密钥以
        <code class="font-mono text-[0.8125rem]">sk_test_</code> 开头、只操作沙箱数据；生产密钥请存放在服务端环境变量，切勿写进前端代码。
      </p>
    </section>

    <section id="webhooks" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3">
      <h2 class="text-xl font-semibold tracking-tight text-highlighted">Webhook 通知</h2>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">
        支付结果以 Webhook 异步送达（如 <code class="font-mono text-[0.8125rem]">payment.succeeded</code>、<code class="font-mono text-[0.8125rem]">refund.completed</code>）。
        校验签名头后再处理事件，并以事件 id 幂等去重——同一事件可能重复投递。
      </p>
    </section>

    <USeparator />

    <!-- 端点 reference：横向分栏 = <SplitPane>（独立 storage key，与
         reference demo 的分栏宽度互不串扰）；右栏钉成视口高 sticky 长条，
         内部 Request/Response 纵向分栏；gate 之下回退为普通堆叠（rail 的
         enabled-from 与之保持同步）。
         gate 用 xl 而非 lg：外层侧栏可拖到 460px，lg 下限时剩余宽度放不下
         340 + 12 + 340 的分栏最小值——xl（1200px）起才有余量。 -->
    <section id="checkout-create" class="scroll-mt-[var(--docs-shell-sticky-offset)]">
      <SplitPane
        direction="row"
        mode="fixed"
        fixed-pane="end"
        enabled-from="xl"
        sticky
        sticky-top="var(--docs-shell-sticky-offset)"
        storage-key="docs-shell-code-rail"
        :default-size="400"
        :min-size="340"
        :max-size="560"
        :min-opposite="340"
        label="调整文档与代码面板宽度"
      >
        <template #start>
          <div class="lg:pe-8">
            <header class="space-y-4 border-b border-default pb-8">
              <div class="flex flex-wrap items-center gap-2.5">
                <ApiDocsMethodBadge :method="paymentsEndpoint.method" />
                <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ paymentsEndpoint.path }}</code>
              </div>
              <h2 class="text-2xl font-semibold tracking-tight text-highlighted text-balance">
                {{ paymentsEndpoint.summary }}
              </h2>
              <p class="max-w-2xl leading-relaxed text-muted text-pretty">
                {{ paymentsEndpoint.description }}
              </p>
            </header>

            <div class="mt-8 space-y-10">
              <ApiDocsFieldGroup label="Request Body" :count="paymentsBodyFields.length">
                <ApiDocsFieldItem v-for="f in paymentsBodyFields" :key="f.path" v-bind="f" />
              </ApiDocsFieldGroup>

              <ApiDocsFieldGroup label="Response Body" :count="paymentsResponseFields.length">
                <ApiDocsFieldItem v-for="f in paymentsResponseFields" :key="f.path" v-bind="f" />
              </ApiDocsFieldGroup>
            </div>
          </div>
        </template>

        <template #end>
          <div class="xl:sticky xl:top-[var(--docs-shell-sticky-offset)] xl:h-[calc(100dvh-var(--docs-shell-sticky-offset)-2rem)]">
            <DemoApiDocsCodeRail enabled-from="xl" class="h-full max-xl:space-y-4">
              <template #top="{ maxHeight }">
                <ApiDocsRequestExample :scenarios="paymentsRequestScenarios" :max-height="maxHeight" />
              </template>
              <template #bottom="{ maxHeight }">
                <ApiDocsResponseExample :scenarios="paymentsResponseScenarios" :max-height="maxHeight" />
              </template>
            </DemoApiDocsCodeRail>
          </div>
        </template>
      </SplitPane>
    </section>

    <USeparator />

    <!-- 其余端点的紧凑 stub：让侧栏与全站搜索里的每个锚点都有落点。
         真实项目里每个端点都是一个完整的 reference section（同上）。 -->
    <div class="space-y-6">
      <section
        v-for="stub in paymentsEndpointStubs"
        :id="stub.id"
        :key="stub.id"
        class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-2"
      >
        <div class="flex flex-wrap items-center gap-2.5">
          <ApiDocsMethodBadge :method="stub.method" />
          <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ stub.path }}</code>
        </div>
        <h2 class="text-lg font-semibold tracking-tight text-highlighted">{{ stub.summary }}</h2>
        <p class="max-w-2xl leading-relaxed text-muted text-pretty">{{ stub.description }}</p>
      </section>
    </div>
  </div>

  <!-- 其余域（付款 / 发卡 / 账户）：紧凑 stub 正文——overview + 指南段 +
       端点 stub，保证该域侧栏与 ⌘K 索引里的每个锚点都有落点。 -->
  <div v-else class="min-w-0 space-y-14 px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
    <section id="overview" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ props.domain.label }}</h1>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">{{ props.domain.description }}</p>
      <p class="max-w-2xl text-sm text-dimmed">
        本域为入口演示：侧栏、全站搜索索引与正文检索已随域切换换源，完整文档形态见「支付」域。
      </p>
    </section>

    <section
      v-for="guide in props.domain.guideSections"
      :id="guide.id"
      :key="guide.id"
      class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3"
    >
      <h2 class="text-xl font-semibold tracking-tight text-highlighted">{{ guide.title }}</h2>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">{{ guide.body }}</p>
    </section>

    <USeparator />

    <div class="space-y-6">
      <section
        v-for="stub in props.domain.stubs"
        :id="stub.id"
        :key="stub.id"
        class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-2"
      >
        <div class="flex flex-wrap items-center gap-2.5">
          <ApiDocsMethodBadge :method="stub.method" />
          <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ stub.path }}</code>
        </div>
        <h2 class="text-lg font-semibold tracking-tight text-highlighted">{{ stub.summary }}</h2>
        <p class="max-w-2xl leading-relaxed text-muted text-pretty">{{ stub.description }}</p>
      </section>
    </div>
  </div>
</template>
