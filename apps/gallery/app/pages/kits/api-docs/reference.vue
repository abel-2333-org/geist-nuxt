<script setup lang="ts">
definePageMeta({ nav: { label: '参考页组合', icon: 'i-lucide-columns-3', order: 1 } })

// API 文档场景的「整页级组合」demo（不是可分发切片，也不是通用组件）——
// 招牌三栏布局：最左侧栏导航（<ApiDocsSidebarNav>，可调宽、sticky），中间字段树
//（可滚动文档流），右侧代码栏（Request 在上 / Response 在下，可拖动纵向分栏 +
// 内容优先重分配）。中右两栏用通用基座的 <SplitPane> 横向分栏，纵向分栏 + 重分
// 配用 gallery 页私有的 <DemoApiDocsCodeRail>（recipe 留在消费页，不进 core）。
// 所有组件来自 api-docs kit，数据一律由本页内联假 ViewModel 注入。侧栏交互的
// 专注演示（搜索过滤/键盘/场景标签溢出）见「侧边栏导航」页；本页展示它在真实
// 文档站里的岗位。

// --- 侧栏导航：与本页端点（部署 API）同一语境，「创建部署」即当前页为 active ---
const navGroups = [
  {
    label: '文档',
    sections: [
      {
        label: '指南',
        kind: 'guide' as const,
        icon: 'i-lucide-book-open',
        items: [
          { label: '概览', to: '#overview', icon: 'i-lucide-compass' },
          { label: '快速开始', to: '#quickstart', icon: 'i-lucide-rocket' },
          { label: '认证与令牌', to: '#auth', icon: 'i-lucide-key-round' },
        ],
      },
    ],
  },
  {
    label: 'API 参考',
    sections: [
      {
        label: 'DEPLOYMENTS',
        kind: 'endpoints' as const,
        defaultOpen: true,
        items: [
          { label: '创建部署', to: '#', method: 'POST', scenarios: ['Git', '文件'], active: true },
          { label: '查询部署', to: '#deployment-get', method: 'GET', scenarios: ['Git', '文件'] },
          { label: '取消部署', to: '#deployment-cancel', method: 'DELETE', scenarios: ['Git'] },
          { label: '部署事件流', to: '#deployment-events', method: 'GET', scenarios: ['构建'] },
        ],
      },
      {
        label: 'PROJECTS',
        kind: 'endpoints' as const,
        items: [
          { label: '项目列表', to: '#project-list', method: 'GET', scenarios: ['Git'] },
          { label: '更新项目配置', to: '#project-update', method: 'PATCH', scenarios: ['构建'] },
        ],
      },
    ],
  },
]

// --- 端点头信息（本页唯一 <h1>） ---
const endpoint = {
  method: 'POST',
  path: '/v1/deployments',
  summary: 'Create a deployment',
  description:
    'Trigger a new deployment for a project from a Git source or an inline file set. Returns the created deployment with its initial build state.',
}

// --- 请求示例：两个业务场景，触发工具栏场景 select ---
const requestScenarios = [
  {
    id: 'git',
    label: 'Git 部署',
    variants: [
      {
        label: 'cURL',
        language: 'bash',
        code: `curl -X POST https://api.example.com/v1/deployments \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-app",
    "target": "production",
    "gitSource": { "repoId": "ghr_9f2a", "ref": "main" }
  }'`,
      },
      {
        label: 'JavaScript',
        language: 'js',
        code: `const res = await fetch("https://api.example.com/v1/deployments", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "my-app",
    target: "production",
    gitSource: { repoId: "ghr_9f2a", ref: "main" },
  }),
})
const deployment = await res.json()`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

res = requests.post(
    "https://api.example.com/v1/deployments",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "name": "my-app",
        "target": "production",
        "gitSource": {"repoId": "ghr_9f2a", "ref": "main"},
    },
)
deployment = res.json()`,
      },
    ],
  },
  {
    id: 'inline',
    label: '文件部署',
    variants: [
      {
        label: 'cURL',
        language: 'bash',
        code: `curl -X POST https://api.example.com/v1/deployments \\
  -H "Authorization: Bearer $TOKEN" \\
  -F 'name=my-app' \\
  -F 'files=@index.html'`,
      },
    ],
  },
]

// --- 响应示例：场景 + 状态双维度切换 ---
const responseScenarios = [
  {
    id: 'git',
    label: 'Git 部署',
    statuses: [
      {
        status: 200,
        statusText: 'OK',
        variants: [
          {
            language: 'json',
            code: `{
  "id": "dpl_8Kx2fQ",
  "name": "my-app",
  "target": "production",
  "state": "READY",
  "url": "https://my-app.example.app",
  "gitSource": { "repoId": "ghr_9f2a", "ref": "main" },
  "createdAt": 1720000000000
}`,
          },
        ],
      },
      {
        status: 400,
        statusText: 'Bad Request',
        variants: [
          {
            language: 'json',
            code: `{
  "error": {
    "code": "invalid_name",
    "message": "Project name must be lowercase letters, digits and dashes."
  }
}`,
          },
        ],
      },
      {
        status: 401,
        statusText: 'Unauthorized',
        variants: [
          {
            language: 'json',
            code: `{
  "error": { "code": "forbidden", "message": "Missing or invalid token." }
}`,
          },
        ],
      },
    ],
  },
]

// --- 字段树：递归 schema，驱动左侧文档流（够长以演示滚动 + sticky 右栏） ---
const enumValues = [
  { value: 'production', description: 'Live environment served to end users.' },
  { value: 'preview', description: 'Per-branch deploy for review. Supports `?token=` access.' },
  { value: 'development', description: 'Local or ephemeral environment. **Not** publicly routed.' },
]

const bodyFields = [
  {
    path: 'body_name',
    name: 'name',
    type: 'string',
    required: true,
    description: 'Unique project name. Becomes part of the default domain.',
    examples: ['my-app'],
    notes: [
      { label: 'Range', text: '1–52 characters.' },
      { tone: 'caution' as const, label: 'Rule', text: 'Lowercase letters, digits and `-` only.' },
    ],
  },
  {
    path: 'body_target',
    name: 'target',
    type: 'enum',
    required: false,
    defaultValue: 'production',
    description: 'Deploy environment.',
    enumValues,
  },
  {
    path: 'body_gitSource',
    name: 'gitSource',
    type: 'object',
    required: 'conditional' as const,
    condition: 'Required when `type` is `git`.',
    lifecycle: { status: 'beta' as const, since: 'v2.4', description: 'Shape may still change during beta.' },
    description: 'Git repository to deploy from.',
    children: [
      {
        path: 'body_gitSource_repoId',
        name: 'repoId',
        type: 'string',
        required: true,
        description: 'Connected repository id.',
        examples: ['ghr_9f2a'],
      },
      {
        path: 'body_gitSource_ref',
        name: 'ref',
        type: 'string',
        required: false,
        defaultValue: 'main',
        description: 'Branch, tag, or commit SHA to build.',
      },
      {
        path: 'body_gitSource_legacyBranch',
        name: 'legacyBranch',
        type: 'string',
        required: false,
        lifecycle: { status: 'deprecated' as const, since: 'v2.4', description: 'Use `ref` instead.' },
        description: 'Legacy branch selector.',
      },
    ],
  },
  {
    path: 'body_meta',
    name: 'meta',
    type: 'object',
    required: false,
    lifecycle: { status: 'new' as const, since: 'v2.5' },
    description: 'Arbitrary key/value metadata attached to the deployment.',
    children: [
      { path: 'body_meta_key', name: 'key', type: 'string', required: true, notes: [{ label: 'Range', text: 'Up to 64 characters.' }] },
      { path: 'body_meta_value', name: 'value', type: 'string', required: true },
    ],
  },
]

const responseFields = [
  { path: 'res_id', name: 'id', type: 'string', required: true, description: 'Unique deployment id.', examples: ['dpl_8Kx2fQ'] },
  {
    path: 'res_state',
    name: 'state',
    type: 'enum',
    required: true,
    description: 'Current build state.',
    enumValues: [
      { value: 'QUEUED', description: 'Waiting for a build slot.' },
      { value: 'BUILDING', description: 'Build in progress.' },
      { value: 'READY', description: 'Deployed and serving traffic.' },
      { value: 'ERROR', description: 'Build failed.' },
    ],
  },
  { path: 'res_url', name: 'url', type: 'string', required: false, description: 'Public URL once the deployment is `READY`.', examples: ['https://my-app.example.app'] },
  { path: 'res_createdAt', name: 'createdAt', type: 'integer', format: 'unix_ms', required: true, description: 'Creation timestamp in milliseconds.' },
]

// 深链接：带 `#path` 进入时自动展开 + 滚动定位到对应字段。
const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <!-- 三栏文档站布局：侧栏列是 `auto`，跟随导航自身的（可拖拽）宽度；
         中右两栏整体作为 `1fr` 列，内部再由 SplitPane 横向分栏。 -->
    <div class="lg:grid lg:grid-cols-[auto_1fr] lg:gap-8">
      <!-- 左：侧栏导航，sticky 满高，与真实文档站一致。<lg 隐藏——真实站在
           移动端把导航收进 drawer/抽屉（app 层职责，非本组合演示范围）。 -->
      <aside class="max-lg:hidden lg:sticky lg:top-20 lg:self-start">
        <ApiDocsSidebarNav
          :groups="navGroups"
          aria-label="部署 API 文档"
          search-placeholder="搜索文档"
          clear-label="清除搜索"
          empty-label="没有匹配的页面"
          resize-label="调整侧栏宽度"
          width-storage-key="geist-api-reference-nav-width"
          :default-width="248"
        />
      </aside>

      <SplitPane
      direction="row"
      mode="fixed"
      fixed-pane="end"
      sticky
      sticky-top="5rem"
      storage-key="geist-api-reference-rail"
      :default-size="480"
      :min-size="380"
      :max-size="720"
      :min-opposite="380"
      label="Resize documentation and code panels"
    >
      <!-- 左：文档流（端点头 + 字段树），随页面滚动 -->
      <template #start>
        <div class="lg:pe-8">
          <header class="space-y-4 border-b border-default pb-8">
            <div class="flex flex-wrap items-center gap-2.5">
              <ApiDocsMethodBadge :method="endpoint.method" />
              <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ endpoint.path }}</code>
            </div>
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted text-balance sm:text-3xl">
              {{ endpoint.summary }}
            </h1>
            <p class="max-w-2xl leading-relaxed text-muted text-pretty">
              {{ endpoint.description }}
            </p>
          </header>

          <div class="mt-8 space-y-10">
            <ApiDocsFieldGroup label="Request Body" :count="bodyFields.length">
              <ApiDocsFieldItem v-for="f in bodyFields" :key="f.path ?? f.name" v-bind="f" />
            </ApiDocsFieldGroup>

            <ApiDocsFieldGroup label="Response Body" :count="responseFields.length">
              <ApiDocsFieldItem v-for="f in responseFields" :key="f.path ?? f.name" v-bind="f" />
            </ApiDocsFieldGroup>
          </div>
        </div>
      </template>

      <!-- 右：代码栏。lg+ 钉成视口高 sticky 长条，内部 Request/Response 纵向分栏。
           <lg 回退为普通堆叠（rail 自身按断点降级为各卡片自滚动）。 -->
      <template #end>
        <div class="lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]">
          <DemoApiDocsCodeRail class="h-full max-lg:space-y-4">
            <template #top="{ maxHeight }">
              <ApiDocsRequestExample :scenarios="requestScenarios" :max-height="maxHeight" />
            </template>
            <template #bottom="{ maxHeight }">
              <ApiDocsResponseExample :scenarios="responseScenarios" :max-height="maxHeight" />
            </template>
          </DemoApiDocsCodeRail>
        </div>
      </template>
      </SplitPane>
    </div>
  </UContainer>
</template>
