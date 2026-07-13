<script setup lang="ts">
definePageMeta({ nav: { label: 'API Docs', icon: 'i-lucide-file-code', order: 0 } })

// API 文档场景的组合演示（demo/story）——按 geist-nuxt「demo 归 gallery、kit 只 ship
// 数据无关积木」的分层，这里用内联假 ViewModel 驱动 kit 的数据无关组件：代码块 /
// 请求 / 响应（ApiDocsCodeBlock、ApiDocsResponseExample）+ method / lifecycle 徽章
// + enum 值表（ApiDocsMethodBadge、ApiDocsLifecycleBadge、ApiDocsEnumTable）+ 字段树
// （ApiDocsFieldGroup、ApiDocsFieldItem，含递归子字段与 useFieldAnchor 深链接）。
const requestSamples = [
  {
    label: 'cURL',
    language: 'bash',
    code: `curl -X POST https://api.example.com/v1/deployments \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "my-app", "target": "production" }'`,
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
  body: JSON.stringify({ name: "my-app", target: "production" }),
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
    json={"name": "my-app", "target": "production"},
)
deployment = res.json()`,
  },
]

const responseScenarios = [
  {
    id: 'created',
    label: '创建部署',
    statuses: [
      {
        status: 200,
        statusText: '部署已创建。',
        variants: [
          {
            language: 'json',
            code: `{
  "id": "dpl_8Kx2fQ",
  "name": "my-app",
  "target": "production",
  "state": "READY",
  "url": "https://my-app.example.app",
  "createdAt": 1720000000000
}`,
          },
        ],
      },
    ],
  },
]

// Domain badges + enum table — preset wrappers over core's SemanticBadge, plus
// the allowed-values table. Data-agnostic, driven here by inline sample data.
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const lifecycles = ['new', 'beta', 'active', 'maintenance', 'deprecated', 'sunset'] as const
const enumValues = [
  { value: 'production', description: 'Live environment served to end users.' },
  { value: 'preview', description: 'Per-branch deploy for review. Supports `?token=` access.' },
  { value: 'development', description: 'Local or ephemeral environment. **Not** publicly routed.' },
]

// Field tree — the recursive schema view. Inline sample data exercises every
// facet ApiDocsFieldItem renders: the three requiredness states, default value,
// examples, a condition, an enum, constraint notes (both tones), field
// lifecycle (new/beta/deprecated), and nested object children (collapsible +
// deep-linkable). `path` is the stable id used for the URL hash anchor.
const fields = [
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
      {
        path: 'body_meta_key',
        name: 'key',
        type: 'string',
        required: true,
        notes: [{ label: 'Range', text: 'Up to 64 characters.' }],
      },
      {
        path: 'body_meta_value',
        name: 'value',
        type: 'string',
        required: true,
      },
    ],
  },
]

// Honor an incoming `#path` hash: navigate + expand + scroll to the field.
const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())
</script>

<template>
  <UContainer class="py-16 sm:py-24">
    <section id="api-docs" class="scroll-mt-20 space-y-10">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">API 文档场景</h2>
        <p class="text-muted max-w-2xl">
          API 文档场景的领域组件：代码块
          <code class="font-mono text-[0.8125rem]">ApiDocsCodeBlock</code>、
          请求 / 响应示例
          <code class="font-mono text-[0.8125rem]">ApiDocsRequestExample</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsResponseExample</code>，
          以及 method / lifecycle 徽章
          <code class="font-mono text-[0.8125rem]">ApiDocsMethodBadge</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsLifecycleBadge</code>
          与 enum 值表
          <code class="font-mono text-[0.8125rem]">ApiDocsEnumTable</code>，
          以及字段树
          <code class="font-mono text-[0.8125rem]">ApiDocsFieldGroup</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsFieldItem</code>（递归子字段 + 深链接）。
          全部基于 Nuxt UI 原语与 Geist token；徽章在 core 的
          <code class="font-mono text-[0.8125rem]">SemanticBadge</code> 之上包一层域词汇。
        </p>
      </div>

      <div class="space-y-8">
        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">请求示例</h3>
          <ApiDocsCodeBlock :variants="requestSamples" />
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">响应</h3>
          <ApiDocsResponseExample :scenarios="responseScenarios" />
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Method 徽章</h3>
          <div class="flex flex-wrap items-center gap-2">
            <ApiDocsMethodBadge v-for="m in methods" :key="m" :method="m" />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Lifecycle 徽章</h3>
          <div class="flex flex-wrap items-center gap-2">
            <ApiDocsLifecycleBadge v-for="s in lifecycles" :key="s" :status="s" />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Enum 值表</h3>
          <ApiDocsEnumTable :values="enumValues" />
        </div>

        <div>
          <h3 class="mb-1 text-sm font-semibold text-highlighted">字段树</h3>
          <p class="mb-4 max-w-2xl text-sm text-muted">
            递归 schema 视图：对象字段可折叠展开子字段，覆盖 required 三态、默认值、
            示例、条件、enum、约束注记与字段 lifecycle。每行悬停时行首出现链接图标，
            点击即复制该字段的深链接（<code class="font-mono text-[0.8125rem]">#body_gitSource_ref</code>
            这类锚点由 <code class="font-mono text-[0.8125rem]">useFieldAnchor</code> 驱动，
            带入页面时自动展开并滚动定位）。
          </p>
          <ApiDocsFieldGroup label="Request Body" :count="fields.length">
            <ApiDocsFieldItem v-for="f in fields" :key="f.name" v-bind="f" />
          </ApiDocsFieldGroup>
        </div>
      </div>
    </section>
  </UContainer>
</template>
