<script setup lang="ts">
// 临时验证 fixture（issue #20 Response body semantics），验证完成后清理。
import type { ResponseScenario } from '../../kits/api-docs/components/ResponseExample.vue'

definePageMeta({ nav: false })

const fullScenarios: ResponseScenario[] = [
  {
    id: 'created',
    label: 'Create user',
    statuses: [
      {
        status: 201,
        statusText: 'Created',
        description: 'The user was created. The response echoes the stored record.',
        bodies: [
          {
            kind: 'code',
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: '{\n  "id": "usr_9f2c",\n  "email": "ada@example.com",\n  "created_at": "2026-07-20T08:00:00Z"\n}',
              },
            ],
          },
          {
            kind: 'code',
            mediaType: 'text/csv',
            variants: [
              {
                language: 'csv',
                label: 'CSV',
                code: 'id,email,created_at\nusr_9f2c,ada@example.com,2026-07-20T08:00:00Z',
              },
            ],
          },
        ],
      },
      {
        status: 204,
        statusText: 'No Content',
        bodies: [{ kind: 'empty' }],
      },
      {
        status: 409,
        statusText: 'Conflict',
        description: 'A user with this email already exists.',
        bodies: [{ kind: 'unavailable', mediaType: 'application/json' }],
      },
      {
        status: 'default',
        statusText: 'Unexpected error',
        bodies: [
          {
            kind: 'code',
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: '{\n  "error": {\n    "code": "internal",\n    "message": "Unexpected error. Retry with the same request id."\n  }\n}',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'export',
    label: 'Export users',
    statuses: [
      {
        status: 200,
        statusText: 'OK',
        description: 'Returns the export archive for the requested date range.',
        bodies: [
          {
            kind: 'file',
            mediaType: 'application/zip',
            filename: 'users-export-2026-07.zip',
            size: '2.4 MB',
            downloadUrl: 'https://example.com/exports/users-export-2026-07.zip',
          },
        ],
      },
      {
        status: 202,
        statusText: 'Accepted',
        bodies: [
          {
            kind: 'file',
            mediaType: 'application/octet-stream',
            note: 'The export is still being prepared; poll the status endpoint.',
          },
        ],
      },
    ],
  },
]

// 旧模型兼容：只有 variants 的调用方零改动。
const legacyScenarios: ResponseScenario[] = [
  {
    id: 'ok',
    label: 'Default',
    statuses: [
      {
        status: 200,
        statusText: 'OK',
        variants: [
          { language: 'json', code: '{\n  "ok": true\n}' },
          { language: 'text', label: 'Text', code: 'ok' },
        ],
      },
    ],
  },
]

// 单场景单状态单 body 退化：所有选择器隐藏。
const singleScenario: ResponseScenario[] = [
  {
    id: 'single',
    label: 'Single',
    statuses: [
      {
        status: 204,
        statusText: 'No Content',
        description: 'Deletion succeeded. There is nothing to return.',
        bodies: [{ kind: 'empty', note: 'DELETE always returns an empty body.' }],
      },
    ],
  },
]

// 长内容边界：长文件名 + 长 note。
const longScenario: ResponseScenario[] = [
  {
    id: 'long',
    label: 'Long content',
    statuses: [
      {
        status: 200,
        statusText: 'OK',
        bodies: [
          {
            kind: 'file',
            mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename:
              'quarterly-consolidated-user-activity-report-with-regional-breakdown-2026-Q2-final.xlsx',
            size: '18.7 MB',
            downloadUrl: 'https://example.com/reports/q2.xlsx',
            note: 'Generated nightly. Rows are grouped by region, then by plan tier; timestamps are UTC. Contact the data platform team if a column is missing.',
          },
        ],
      },
    ],
  },
]
</script>

<template>
  <PlaygroundStage
    title="Response body semantics"
    description="issue #20 验证：numeric/default 状态、empty、unavailable、多 media type、file 及旧 variants 兼容。"
  >
    <ApiDocsResponseExample title="Full model" :scenarios="fullScenarios" />
    <ApiDocsResponseExample title="Legacy variants" :scenarios="legacyScenarios" />
    <ApiDocsResponseExample title="Single fixed response" :scenarios="singleScenario" />
    <ApiDocsResponseExample title="Long content" :scenarios="longScenario" />
  </PlaygroundStage>
</template>
