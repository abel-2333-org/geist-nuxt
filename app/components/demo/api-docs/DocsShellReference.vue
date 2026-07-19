<script setup lang="ts">
import {
  paymentsBodyFields,
  paymentsEndpoint,
  paymentsEndpointStubs,
  paymentsHosts,
  paymentsRequestScenarios,
  paymentsResponseFields,
  paymentsResponseScenarios,
  paymentsWebhook,
  paymentsWebhookPayloadExample,
  paymentsWebhookPayloadFields,
  paymentsWebhookStubs,
  type DocsShellDomain,
} from '~/utils/demo/api-docs/docs-shell-data'

// 文档站外壳的正文列：指南锚点 section + reference 式端点页。出血布局下由
// 正文列自己管理内边距（不依赖外层容器）。
//
// 支付域是完整样板——端点 reference 与 /kits/api-docs/reference 同构：
// 头部走 kit 的 <ApiDocsOperationHeader>（identity）+ <ApiDocsOperationTarget>
// （环境 host + 地址 + 复制）；横向分栏用通用基座的 <SplitPane>（lg+ 可拖拽、
// 独立 storage key 持久化，<lg 自动堆叠），右侧代码栏用 kit 的
// <ApiDocsCodeRail>（Request 上 / Response 下，纵向高度可拖 + 内容优先重分配）。
// 端点段之后是 Webhooks 段：同一 OperationHeader 以 kind="webhook" 渲染
// （EVENT 徽章 + mono 事件名），左 payload 字段树 / 右 payload 示例。
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
  <!-- 支付域首页：概览 + 端点参考长滚动。指南（快速开始/认证/Webhook）已
       拆成一页一文的子页（[domain]/[slug].vue + DocsShellGuidePage）——
       「指南分页、参考长滚动」的拆页策略（见 project-setup.md）。标题层级：
       页面唯一 h1 = 域名（overview 段打头），端点均为 h2，之下才是 h3。 -->
  <div v-if="props.domain.id === 'payments'" class="min-w-0 space-y-14 px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
    <section id="overview" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ props.domain.label }}</h1>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">
        支付 API 按业务用途组织：先用「创建结算会话」把顾客送进托管收银台，需要更细控制时改用
        Direct API 自行编排授权、捕获与退款。所有接口共用同一套密钥与 Webhook 通知机制。
      </p>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">
        接入指南在左侧「指南」分组里按篇阅读（从「快速开始」起步）；本页往下是完整的
        API 参考。左侧菜单里接口按<b class="font-medium text-toned">用途</b>命名，行首的方法色标说「怎么调」、行尾的场景标签说「用在哪」；行首若是
        EVENT 标，则方向相反——是平台在事情发生时回调你（Webhook）。
        找不到入口时用顶栏的全站搜索（<UKbd value="meta" /><UKbd value="K" />），输入场景名（如「订阅」）或方法名（如「POST」）都能命中。
      </p>
    </section>

    <USeparator />

    <!-- 端点 reference：横向分栏 = <SplitPane>（独立 storage key，与
         reference demo 的分栏宽度互不串扰）；右栏钉成视口高 sticky 长条，
         内部 Request/Response 纵向分栏；gate 之下回退为普通堆叠（rail 的
         enabled-from 与之保持同步）。
         gate 用 xl 而非 lg，且外壳把侧栏拖拽上限收到 400（DocsShell）：
         xl 下限 1200 − 侧栏 400 − padding 80 = 720 ≥ 340 + 12 + 340 = 692，
         分栏最小值在整个 xl 区间都放得下。 -->
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
            <!-- identity/header 走 kit 组合件：identity 行（badge + path +
                 #actions 页面级操作位）→ 标题（+ lifecycle）→ 描述 →
                 尾部由消费方摆 OperationTarget（正交，不内嵌）。 -->
            <ApiDocsOperationHeader
              kind="endpoint"
              :method="paymentsEndpoint.method"
              :path="paymentsEndpoint.path"
              :summary="paymentsEndpoint.summary"
              :lifecycle="paymentsEndpoint.lifecycle"
              class="border-b border-default pb-8"
            >
              <template #actions>
                <UButton
                  label="在 Playground 打开"
                  icon="i-lucide-square-play"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
              </template>
              <template #description>
                {{ paymentsEndpoint.description }}
              </template>
              <ApiDocsOperationTarget
                :hosts="paymentsHosts"
                :path="paymentsEndpoint.path"
                select-label="选择环境"
                copy-toast-label="接口地址"
              />
            </ApiDocsOperationHeader>

            <!-- 端点标题是 h2，字段分组归入其下为 h3（FieldGroup 默认 h2
                 是给独立成岛的场景用的） -->
            <div class="mt-8 space-y-10">
              <ApiDocsFieldGroup label="Request Body" :count="paymentsBodyFields.length" :heading-level="3">
                <ApiDocsFieldItem v-for="f in paymentsBodyFields" :key="f.path" v-bind="f" />
              </ApiDocsFieldGroup>

              <ApiDocsFieldGroup label="Response Body" :count="paymentsResponseFields.length" :heading-level="3">
                <ApiDocsFieldItem v-for="f in paymentsResponseFields" :key="f.path" v-bind="f" />
              </ApiDocsFieldGroup>
            </div>
          </div>
        </template>

        <template #end>
          <div class="xl:sticky xl:top-[var(--docs-shell-sticky-offset)] xl:h-[calc(100dvh-var(--docs-shell-sticky-offset)-2rem)]">
            <ApiDocsCodeRail enabled-from="xl" class="h-full max-xl:space-y-4">
              <template #top="{ maxHeight }">
                <ApiDocsRequestExample :scenarios="paymentsRequestScenarios" :max-height="maxHeight" />
              </template>
              <template #bottom="{ maxHeight }">
                <ApiDocsResponseExample :scenarios="paymentsResponseScenarios" :max-height="maxHeight" />
              </template>
            </ApiDocsCodeRail>
          </div>
        </template>
      </SplitPane>
    </section>

    <USeparator />

    <!-- 其余端点的紧凑 stub：让侧栏与全站搜索里的每个锚点都有落点。
         真实项目里每个端点都是一个完整的 reference section（同上）。
         lifecycle 双形态演示：heading 旁 LifecycleBadge（identity 级标记）+
         正文 LifecycleNotice（解释「发生了什么 + 怎么办」）。 -->
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
        <div class="flex flex-wrap items-center gap-2.5">
          <h2 class="text-lg font-semibold tracking-tight text-highlighted">{{ stub.summary }}</h2>
          <ApiDocsLifecycleBadge v-if="stub.lifecycle" :status="stub.lifecycle" />
        </div>
        <p class="max-w-2xl leading-relaxed text-muted text-pretty">{{ stub.description }}</p>
        <ApiDocsLifecycleNotice
          v-if="stub.lifecycle === 'deprecated'"
          status="deprecated"
          title="已弃用"
          description="该接口不再接受新接入，存量调用仍可用。请迁移到「创建退款」并订阅 refund.completed 事件跟踪结果。"
          class="mt-3 max-w-2xl"
        />
      </section>
    </div>

    <USeparator />

    <!-- Webhooks 段：与端点同为 operation，identity 换成事件名——同一个
         OperationHeader 以 kind="webhook" 渲染（EVENT 徽章 + mono 事件名）。
         方向相反（平台回调你），所以没有 OperationTarget（订阅目标是消费方
         自己的回调地址，是一句话说明而非地址栏）。 -->
    <section class="space-y-3">
      <h2 class="font-mono text-xs font-semibold uppercase tracking-widest text-muted">Webhooks</h2>
      <p class="max-w-2xl leading-relaxed text-muted text-pretty">
        行首的 EVENT 标表示这不是你调用的接口，而是事情发生时平台向你的回调地址投递的事件。
        在控制台登记回调地址后即可订阅；处理前先校验签名，并以事件 id 幂等去重。
      </p>
    </section>

    <!-- 完整 webhook 样板：与端点 reference 同构的分栏——左 payload 字段树 /
         右 payload 示例（单卡无双例需求，不用 CodeRail）。 -->
    <section id="webhook-payment-succeeded" class="scroll-mt-[var(--docs-shell-sticky-offset)]">
      <SplitPane
        direction="row"
        mode="fixed"
        fixed-pane="end"
        enabled-from="xl"
        sticky
        sticky-top="var(--docs-shell-sticky-offset)"
        storage-key="docs-shell-webhook-rail"
        :default-size="400"
        :min-size="340"
        :max-size="560"
        :min-opposite="340"
        label="调整事件文档与载荷面板宽度"
      >
        <template #start>
          <div class="lg:pe-8">
            <ApiDocsOperationHeader
              kind="webhook"
              :event="paymentsWebhook.event"
              :summary="paymentsWebhook.summary"
              class="border-b border-default pb-8"
            >
              <template #description>
                {{ paymentsWebhook.description }}
              </template>
            </ApiDocsOperationHeader>

            <div class="mt-8 space-y-10">
              <ApiDocsFieldGroup label="Event Payload" :count="paymentsWebhookPayloadFields.length" :heading-level="3">
                <ApiDocsFieldItem v-for="f in paymentsWebhookPayloadFields" :key="f.path" v-bind="f" />
              </ApiDocsFieldGroup>
            </div>
          </div>
        </template>

        <template #end>
          <div class="xl:sticky xl:top-[var(--docs-shell-sticky-offset)]">
            <ApiDocsRequestExample
              title="Payload"
              :scenarios="[{
                id: 'payload',
                label: 'JSON',
                variants: [{ label: 'JSON', ...paymentsWebhookPayloadExample }],
              }]"
            />
          </div>
        </template>
      </SplitPane>
    </section>

    <!-- 其余事件的紧凑 stub：镜像端点 stub，维持「侧栏 / 搜索里的每个锚点
         在正文都有落点」的不变量。 -->
    <div class="space-y-6">
      <section
        v-for="stub in paymentsWebhookStubs"
        :id="stub.id"
        :key="stub.id"
        class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-2"
      >
        <div class="flex flex-wrap items-center gap-2.5">
          <ApiDocsEventBadge />
          <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ stub.event }}</code>
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
