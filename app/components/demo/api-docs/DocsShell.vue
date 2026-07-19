<script setup lang="ts">
import { geistMinWidthQuery } from '../../../../foundation/utils/breakpoints'
import {
  docsShellDomains,
  searchDocsBody,
  toSiteSearchGroups,
  type DocsShellDomain,
} from '~/utils/demo/api-docs/docs-shell-data'

// 「文档站外壳」——把 kit 的三块拼成一个完整可用的文档站骨架，作为下游
// copy & adapt 的活样板：
//
//   顶栏     中性品牌 / 域切换器（<DemoApiDocsDomainSwitcher>）+
//            <ApiDocsSiteSearch>（⌘K 全站搜索）
//   侧栏     <ApiDocsSidebarNav>（sticky 通栏立柱，树内过滤 + 拖宽持久化）
//   正文     <DemoApiDocsShellReference>（指南锚点 section + reference 式端点页）
//
// 三层搜索/导航各司其职、不互相顶替：
//   1. 顶栏 ⌘K 全站搜索 —— 「从任何地方去任何页面」（跨指南与端点）；
//   2. 侧栏 '/' 树内过滤 —— 「在当前菜单里快速缩小范围」；
//   3. 字段树深链接（useFieldAnchor）—— 「直达端点里的某个字段」。
// 两级搜索刻意匹配同样的维度（用途名 / 请求方法 / 场景标签）。
//
// 路由即 consumer shape：每个域一个路径（/docs-shell/[domain]），当前域由
// 页面路由决定、经 prop 传入；域切换器就是 NuxtLink。消费项目照此把
// [domain] 换成自己的 /docs/[domain]/[...slug] 即可。
//
// sticky 单点维护：--docs-shell-toolbar-height 是外壳工具栏高（h-14），
// --docs-shell-sticky-offset = 全局 header + 工具栏 + 呼吸间距，正文锚点
// scroll-margin 与代码栏 sticky 顶距都消费它。gallery 自己有全局 header，
// 外壳工具栏 sticky 在它下方；真实项目把这条工具栏提升为 app 顶栏时，
// 把 --ui-header-height 换成自己顶栏的高度即可。

const props = defineProps<{
  domain: DocsShellDomain
}>()

const route = useRoute()

const DOCS_SHELL_BASE = '/kits/api-docs/docs-shell'

// 域切换器条目：NuxtLink 目标由外壳拼路径——DomainSwitcher 保持路由无关。
const switcherItems = computed(() =>
  docsShellDomains.map(domain => ({
    id: domain.id,
    label: domain.label,
    description: domain.description,
    icon: domain.icon,
    to: `${DOCS_SHELL_BASE}/${domain.id}`,
  })),
)

// 导航目标解析：数据层的 to 是路由无关的（`#hash` = 域首页锚点，裸 slug =
// 指南子页），外壳统一拼成完整路径——「指南分页、参考长滚动」两类目标混排。
const domainBase = computed(() => `${DOCS_SHELL_BASE}/${props.domain.id}`)

function resolveTo(to: string) {
  return to.startsWith('#') ? `${domainBase.value}${to}` : `${domainBase.value}/${to}`
}

// 侧栏 active 双语义，均显式计算（带 hash 的路径 NuxtLink 只按 path 匹配、
// 会把域首页所有锚点同时点亮，所以两类都不能交给 ULink 自动判定）：
// - 指南子页 item：当前 route 的 slug 段等于 to；
// - 锚点 item：在域首页（无 slug）且 route.hash 等于 to。刚进域首页时
//   hash 为空，归一为 #overview——否则整个侧栏没有「当前位置」。
const effectiveHash = computed(() =>
  route.params.slug ? route.hash : (route.hash || '#overview'),
)

const navGroups = computed(() =>
  props.domain.navGroups.map(group => ({
    ...group,
    sections: group.sections.map(section => ({
      ...section,
      items: section.items.map(item => ({
        ...item,
        to: resolveTo(item.to),
        active: item.to.startsWith('#')
          ? !route.params.slug && item.to === effectiveHash.value
          : route.params.slug === item.to,
      })),
    })),
  })),
)

// <lg 侧栏收进左侧抽屉（文档站移动端惯例：汉堡按钮 + Slideover，而不是
// 把整个菜单堆在正文上方）。点击抽屉里的导航链接（hash 跳转）后自动收起。
//
// 单实例约束：SidebarNav 会在 window 上挂 '/' 快捷键 handler，桌面立柱与
// 抽屉不能同时挂载。桌面立柱按断点 v-if（SSR 先渲染立柱、CSS max-lg:hidden
// 兜底移动端首帧），抽屉内容由 USlideover 懒挂载（关闭即卸载）——任意时刻
// 只有一个 SidebarNav 拥有快捷键。断点用 geistMinWidthQuery('lg') 与系统
// token 单点对齐，越过 lg 时同时强制收起抽屉。
const navDrawerOpen = ref(false)
const isDesktop = ref(true)

// 抽屉内点击导航链接：收起抽屉，记下焦点目标，路由落定后把焦点交给目标
// ——Slideover 退场默认把焦点还给汉堡按钮，读屏用户会「回到」顶栏而不是
// 新内容。聚焦时机用事件而非定时器（退场时长可配置、跨路由渲染时序不定，
// 猜毫秒数必有竞态），且要覆盖两条路径：
// - 同页锚点导航：DocsShell 不卸载，Slideover 正常退场 → after:leave 聚焦；
// - 跨页导航（域首页 ↔ 指南子页是不同 page 组件）：DocsShell 整个卸载重建，
//   旧实例的 after:leave 永不触发 → pending 状态放 useState 跨实例存活，
//   由新实例 onMounted 接力聚焦。
// 目标锚点优先，找不到时聚焦正文容器 #docs-shell-content。
const pendingFocusHash = useState<string | null>('docs-shell-pending-focus', () => null)

function onDrawerNavClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const link = target?.closest('a[href]')
  if (!link) return
  const href = link.getAttribute('href') ?? ''
  pendingFocusHash.value = href.includes('#') ? href.slice(href.indexOf('#')) : ''
  navDrawerOpen.value = false
}

async function focusPendingTarget() {
  if (pendingFocusHash.value === null) return
  const hash = pendingFocusHash.value
  pendingFocusHash.value = null
  // 等当前渲染批次落定后再找目标（跨页时目标节点刚挂载）
  await nextTick()
  const dest = (hash && document.querySelector<HTMLElement>(hash))
    || document.getElementById('docs-shell-content')
  if (!dest) return
  // 锚点 section 本身不可聚焦，补程序化聚焦所需的 tabindex
  if (!dest.hasAttribute('tabindex')) dest.setAttribute('tabindex', '-1')
  dest.focus({ preventScroll: true })
}

onMounted(() => {
  // 跨页接力：上一实例来不及处理的焦点目标由新实例完成
  void focusPendingTarget()
})

onMounted(() => {
  const lgQuery = window.matchMedia(geistMinWidthQuery('lg'))
  const sync = () => {
    isDesktop.value = lgQuery.matches
    if (lgQuery.matches) navDrawerOpen.value = false
  }
  sync()
  lgQuery.addEventListener('change', sync)
  onUnmounted(() => lgQuery.removeEventListener('change', sync))
})

// 侧栏 / ⌘K 索引 / 正文检索全部按当前域派生（一份数据、多处消费）。
// ⌘K 结果的 to 同样过 resolveTo——在指南子页上命中锚点结果也能跳回域首页。
const searchGroups = computed(() =>
  toSiteSearchGroups(props.domain).map(group => ({
    ...group,
    items: group.items.map(item => ({ ...item, to: resolveTo(item.to) })),
  })),
)

async function searchBody(query: string) {
  const results = await searchDocsBody(props.domain, query)
  return results.map(item => ({ ...item, to: resolveTo(item.to) }))
}
</script>

<template>
  <div
    class="min-h-[calc(100dvh-var(--ui-header-height))] bg-default"
    style="--docs-shell-toolbar-height: calc(var(--spacing) * 14); --docs-shell-sticky-offset: calc(var(--ui-header-height) + var(--docs-shell-toolbar-height) + var(--spacing) * 6)"
  >
    <a
      href="#docs-shell-content"
      class="sr-only z-50 rounded-md bg-default px-3 py-2 text-sm font-medium text-highlighted shadow-lg focus:fixed focus:start-4 focus:top-4 focus:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      跳到文档正文
    </a>

    <header class="sticky top-[var(--ui-header-height)] z-40 border-y border-default bg-default/95 backdrop-blur">
      <div class="flex h-14 min-w-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <!-- 品牌 / 域切换器（Vercel 式「brand / scope」结构）。品牌为中性
             假品牌——真源 demo 不携带消费项目品牌；消费项目在此换成自己的
             mark 与字标，label/描述��� i18n 注入（见 project-setup.md）。 -->
        <div class="flex min-w-0 items-center gap-1.5">
          <USlideover
            v-model:open="navDrawerOpen"
            side="left"
            title="文档导航"
            :ui="{ content: 'max-w-xs', body: 'p-0 sm:p-0' }"
            @after:leave="focusPendingTarget"
          >
            <UButton
              icon="i-lucide-menu"
              color="neutral"
              variant="ghost"
              class="lg:hidden"
              aria-label="打开文档导航"
            />

            <template #body>
              <div class="h-full min-h-0" @click="onDrawerNavClick">
                <ApiDocsSidebarNav
                  :key="`drawer-${props.domain.id}`"
                  :groups="navGroups"
                  :aria-label="`${props.domain.label}文档`"
                  :resizable="false"
                  search-placeholder="搜索文档"
                  clear-label="清除搜索"
                  empty-label="没有匹配的页面"
                  scenarios-label="服务场景"
                  scenario-separator="、"
                  :results-announcement="(count: number) => `找到 ${count} 个匹配结果`"
                  :no-results-announcement="(q: string) => `没有与“${q}”匹配的结果`"
                  :scenario-overflow-label="(total: number) => `查看全部 ${total} 个服务场景`"
                />
              </div>
            </template>
          </USlideover>

          <NuxtLink
            :to="DOCS_SHELL_BASE"
            class="flex shrink-0 items-center gap-2 rounded-md font-medium text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Acme Pay 文档首页"
          >
            <span class="flex size-7 items-center justify-center rounded-sm bg-inverted text-inverted">
              <UIcon name="i-lucide-zap" class="size-4" />
            </span>
            <span class="text-sm font-semibold tracking-tight max-sm:sr-only">Acme Pay</span>
          </NuxtLink>

          <span class="select-none text-dimmed" aria-hidden="true">/</span>

          <DemoApiDocsDomainSwitcher
            :domains="switcherItems"
            :current-id="props.domain.id"
          />
        </div>

        <ApiDocsSiteSearch
          :key="props.domain.id"
          :groups="searchGroups"
          :search="searchBody"
          search-group-label="正文内容"
          trigger-label="搜索全部文档"
          aria-label="搜索全部文档"
          modal-title="搜索全部文档"
          placeholder="搜索指南与接口…"
          empty-label="没有匹配的结果"
          searching-label="正在搜索文档…"
          search-error-label="搜索暂不可用，请稍后重试。"
        />
      </div>
    </header>

    <!-- 两栏：sticky 通栏侧栏 + 正文。侧栏列宽 auto 跟随其可拖拽宽度；
         lg+ 立柱高度 = 视口减全局 header 与外壳工具栏，菜单太长时在组件
         内部滚动；<lg 立柱卸载（v-if），导航收进工具栏汉堡按钮的左侧抽屉。 -->
    <div class="min-w-0 lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
      <aside
        v-if="isDesktop"
        class="max-lg:hidden lg:sticky lg:top-[calc(var(--ui-header-height)+var(--docs-shell-toolbar-height))] lg:h-[calc(100dvh-var(--ui-header-height)-var(--docs-shell-toolbar-height))] lg:self-start"
      >
        <!-- max-width 收到 400：xl（1200px）下限时正文分栏还要装下
             340 + 12 + 340 + 80px padding（见 DocsShellReference 的 gate
             注释），侧栏上限须 ≤ 1200 − 80 − 692 = 428。 -->
        <ApiDocsSidebarNav
          :key="props.domain.id"
          class="border-r border-default"
          :groups="navGroups"
          :max-width="400"
          :aria-label="`${props.domain.label}文档`"
          search-placeholder="搜索文档"
          clear-label="清除搜索"
          empty-label="没有匹配的页面"
          resize-label="调整侧栏宽度"
          scenarios-label="服务场景"
          scenario-separator="、"
          width-storage-key="docs-shell-sidebar-width"
          :results-announcement="(count: number) => `找到 ${count} 个匹配结果`"
          :no-results-announcement="(q: string) => `没有与“${q}”匹配的结果`"
          :scenario-overflow-label="(total: number) => `查看全部 ${total} 个服务场景`"
        />
      </aside>

      <!-- 正文槽：域首页放参考长滚动（fallback），指南子页由路由页面注入
           一页一文的正文——外壳（顶栏/侧栏/搜索）在两种形态间保持不变。 -->
      <section
        id="docs-shell-content"
        tabindex="-1"
        aria-label="API 文档正文"
        class="min-w-0 focus:outline-none"
      >
        <slot>
          <DemoApiDocsShellReference :key="props.domain.id" :domain="props.domain" />
        </slot>
      </section>
    </div>
  </div>
</template>
