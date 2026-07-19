export interface DocsShellNavItem {
  label: string
  to: string
  method?: string
  scenarios?: string[]
  icon?: string
}

export interface DocsShellNavSection {
  label: string
  kind: 'guide' | 'endpoints'
  icon?: string
  defaultOpen?: boolean
  items: DocsShellNavItem[]
}

export interface DocsShellNavGroup {
  id: string
  label: string
  sections: DocsShellNavSection[]
}

export interface DocsShellField {
  path: string
  name: string
  type: string
  required?: boolean | 'conditional'
  condition?: string
  description: string
  defaultValue?: string
  examples?: string[]
}

export interface DocsShellSearchItem {
  label: string
  to: string
  icon?: string
  suffix?: string
}

export interface DocsShellDomainSummary {
  id: string
  label: string
  description: string
  icon: string
}

export interface DocsShellDomain extends DocsShellDomainSummary {
  navGroups: DocsShellNavGroup[]
  overview: string
  quickstart: string
  authentication: string
  endpoint: {
    id: string
    method: string
    path: string
    title: string
    description: string
    scenarios: string[]
    fields: DocsShellField[]
    request: string
    response: string
  }
  secondaryEndpoints: Array<{
    id: string
    method: string
    title: string
    description: string
  }>
  bodySearchItems: DocsShellSearchItem[]
}

interface DomainSeed extends DocsShellDomainSummary {
  collection: string
  resource: string
  resourceLabel: string
  scenarios: string[]
  fields: DocsShellField[]
  requestPayload: Record<string, unknown>
}

function createDomain(seed: DomainSeed): DocsShellDomain {
  const createId = `${seed.id}-create`
  const listId = `${seed.id}-list`
  const retrieveId = `${seed.id}-retrieve`
  const resourceVariable = seed.resource.replace(/[^a-z0-9]/gi, '_')
  const resourceName = seed.resource.toLowerCase()
  const article = /^[aeiou]/i.test(resourceName) ? 'an' : 'a'

  return {
    id: seed.id,
    label: seed.label,
    description: seed.description,
    icon: seed.icon,
    overview: `${seed.label} exposes stable primitives for integrating ${resourceName} workflows into your application.`,
    quickstart: `Create a test credential, send one request to the ${seed.collection} endpoint, and inspect the returned identifier before enabling live traffic.`,
    authentication: 'Send a bearer token in the Authorization header. Keep credentials in server-side runtime configuration and rotate them independently for each environment.',
    endpoint: {
      id: createId,
      method: 'POST',
      path: `/v1/${seed.collection}`,
      title: `Create ${article} ${resourceName}`,
      description: `Creates one ${resourceName} and returns its initial state. The request accepts an idempotency key for safe retries.`,
      scenarios: seed.scenarios,
      fields: seed.fields.map(field => ({
        ...field,
        path: `${seed.id}_${field.path}`,
      })),
      request: `curl --request POST https://api.example.com/v1/${seed.collection} \\
  --header "Authorization: Bearer $EXAMPLE_TOKEN" \\
  --header "Content-Type: application/json" \\
  --data '${JSON.stringify(seed.requestPayload, null, 2)}'`,
      response: `{
  "id": "${resourceVariable}_01J8W7N9M4",
  "status": "active",
  "createdAt": "2026-07-19T08:30:00Z"
}`,
    },
    secondaryEndpoints: [
      {
        id: listId,
        method: 'GET',
        title: `List ${seed.resourceLabel.toLowerCase()}`,
        description: 'Returns a cursor-paginated collection ordered by creation time.',
      },
      {
        id: retrieveId,
        method: 'GET',
        title: `Retrieve ${article} ${resourceName}`,
        description: 'Returns the latest state for one resource identifier.',
      },
    ],
    navGroups: [
      {
        id: `${seed.id}-docs`,
        label: 'Documentation',
        sections: [
          {
            label: 'Guides',
            kind: 'guide',
            icon: 'i-lucide-book-open',
            defaultOpen: true,
            items: [
              { label: 'Overview', to: '#overview', icon: 'i-lucide-compass' },
              { label: 'Quickstart', to: '#quickstart', icon: 'i-lucide-rocket' },
              { label: 'Authentication', to: '#authentication', icon: 'i-lucide-key-round' },
            ],
          },
        ],
      },
      {
        id: `${seed.id}-reference`,
        label: 'API reference',
        sections: [
          {
            label: seed.resourceLabel,
            kind: 'endpoints',
            defaultOpen: true,
            items: [
              { label: `Create ${article} ${resourceName}`, to: `#${createId}`, method: 'POST', scenarios: seed.scenarios },
              { label: `List ${seed.resourceLabel.toLowerCase()}`, to: `#${listId}`, method: 'GET', scenarios: ['Operations'] },
              { label: `Retrieve ${article} ${resourceName}`, to: `#${retrieveId}`, method: 'GET', scenarios: ['Operations'] },
            ],
          },
        ],
      },
    ],
    bodySearchItems: [
      { label: 'Idempotent retries', to: `#${createId}`, icon: 'i-lucide-refresh-cw', suffix: 'Request behavior' },
      { label: 'Credential rotation', to: '#authentication', icon: 'i-lucide-key-round', suffix: 'Security guide' },
    ],
  }
}

export const docsShellDomains: DocsShellDomain[] = [
  createDomain({
    id: 'core',
    label: 'Core API',
    description: 'Shared resources and platform primitives.',
    icon: 'i-lucide-box',
    collection: 'resources',
    resource: 'resource',
    resourceLabel: 'Resources',
    scenarios: ['Platform', 'Automation'],
    requestPayload: {
      reference: 'demo-001',
      metadata: { source: 'docs-shell' },
    },
    fields: [
      { path: 'reference', name: 'reference', type: 'string', required: true, description: 'A unique reference from your system.', examples: ['demo-001'] },
      { path: 'metadata', name: 'metadata', type: 'object', description: 'Structured metadata returned on subsequent reads.' },
    ],
  }),
  createDomain({
    id: 'billing',
    label: 'Billing API',
    description: 'Invoices, balances, and billing workflows.',
    icon: 'i-lucide-receipt-text',
    collection: 'invoices',
    resource: 'invoice',
    resourceLabel: 'Invoices',
    scenarios: ['Billing', 'Reconciliation'],
    requestPayload: {
      customerId: 'customer_01J8W7N9M4',
      currency: 'USD',
    },
    fields: [
      { path: 'customerId', name: 'customerId', type: 'string', required: true, description: 'The customer that owns the invoice.' },
      { path: 'currency', name: 'currency', type: 'string', required: true, description: 'Three-letter ISO currency code.', examples: ['USD'] },
    ],
  }),
  createDomain({
    id: 'identity',
    label: 'Identity API',
    description: 'Users, sessions, and access controls.',
    icon: 'i-lucide-fingerprint',
    collection: 'sessions',
    resource: 'session',
    resourceLabel: 'Sessions',
    scenarios: ['Authentication', 'Access'],
    requestPayload: {
      userId: 'user_01J8W7N9M4',
      expiresIn: 3600,
    },
    fields: [
      { path: 'userId', name: 'userId', type: 'string', required: true, description: 'The user that starts the session.' },
      { path: 'expiresIn', name: 'expiresIn', type: 'integer', defaultValue: '3600', description: 'Session lifetime in seconds.' },
    ],
  }),
  createDomain({
    id: 'events',
    label: 'Events API',
    description: 'Subscriptions and delivery management.',
    icon: 'i-lucide-radio-tower',
    collection: 'subscriptions',
    resource: 'subscription',
    resourceLabel: 'Subscriptions',
    scenarios: ['Webhooks', 'Automation'],
    requestPayload: {
      url: 'https://example.com/events',
      events: ['resource.created'],
    },
    fields: [
      { path: 'url', name: 'url', type: 'string', required: true, description: 'HTTPS destination that receives events.' },
      { path: 'events', name: 'events', type: 'string[]', required: true, description: 'Event types delivered to this subscription.' },
    ],
  }),
]

export function toSiteSearchGroups(domain: DocsShellDomain) {
  return domain.navGroups.map(group => ({
    id: group.id,
    label: group.label,
    items: group.sections.flatMap(section => section.items.map(item => ({
      label: item.label,
      to: item.to,
      method: item.method,
      scenarios: item.scenarios,
      icon: item.icon,
      suffix: section.label,
    }))),
  }))
}

export function searchDocsBody(domain: DocsShellDomain, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []
  return domain.bodySearchItems.filter(item => [item.label, item.suffix]
    .some(value => value?.toLowerCase().includes(normalizedQuery)))
}
