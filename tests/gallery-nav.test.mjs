import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGalleryNav } from '../app/composables/useGalleryNav.ts'

function route(path, nav) {
  return { path, meta: nav === undefined ? {} : { nav } }
}

test('builds a stable two-level tree from static visible routes', () => {
  const items = buildGalleryNav([
    route('/compositions', { label: 'Compositions', order: 2 }),
    route('/kits/zeta/guide'),
    route('/kits/api-docs/docs-shell', { label: '文档站外壳', order: 3 }),
    route('/playground', false),
    route('/kits/api-docs/:domain'),
    route('/kits/api-docs/reference', { label: '参考页组合', order: 1 }),
    route('/kits/api-docs', { label: '组件目录', icon: 'i-lucide-file-code', order: 0 }),
    route('/components', { label: 'Components', order: 1 }),
    route('/', { label: 'Overview', order: 0 }),
    route('/kits/api-docs/sidebar-nav', { label: '侧边栏导航', order: 2 }),
    route('/kits/api-docs/deep/topic', { order: 4 }),
    route('/internal/deep'),
  ], '/components')

  assert.deepEqual(items.map(item => item.label), [
    'Overview',
    'Components',
    'Compositions',
    'Api Docs',
    'Zeta',
  ])

  const apiDocs = items[3]
  assert.deepEqual(apiDocs.children?.map(item => item.label), [
    '组件目录',
    '参考页组合',
    '侧边栏导航',
    '文档站外壳',
    'Topic',
  ])
  assert.equal(apiDocs.children?.some(item => item.children), false)
  assert.equal(apiDocs.active, false)
  assert.equal(apiDocs.defaultOpen, false)

  assert.deepEqual(items[4], {
    label: 'Zeta',
    icon: 'i-lucide-package',
    to: '/kits/zeta/guide',
    active: false,
  })
})

test('marks the kit and longest static page for dynamic descendants', () => {
  const routes = [
    route('/kits/api-docs', { label: '组件目录', order: 0 }),
    route('/kits/api-docs/reference', { label: '参考页组合', order: 1 }),
    route('/kits/api-docs/docs-shell', { label: '文档站外壳', order: 2 }),
    route('/kits/solo/guide'),
  ]
  const items = buildGalleryNav(routes, '/kits/api-docs/docs-shell/payments/quickstart')

  const apiDocs = items[0]
  assert.equal(apiDocs.active, true)
  assert.equal(apiDocs.defaultOpen, true)
  assert.deepEqual(apiDocs.children?.filter(item => item.active).map(item => item.to), [
    '/kits/api-docs/docs-shell',
  ])

  const solo = buildGalleryNav([
    route('/kits/solo/guide'),
  ], '/kits/solo/guide/step')[0]
  assert.equal(solo.active, true)

  const lookalikeKit = buildGalleryNav(routes, '/kits/api-docs-v2/reference')[0]
  assert.equal(lookalikeKit.active, false)
  assert.equal(lookalikeKit.defaultOpen, false)
  assert.equal(lookalikeKit.children?.some(item => item.active), false)

  const lookalikePage = buildGalleryNav(routes, '/kits/api-docs/docs-shell-old')[0]
  assert.deepEqual(lookalikePage.children?.filter(item => item.active).map(item => item.to), [
    '/kits/api-docs',
  ])
})
