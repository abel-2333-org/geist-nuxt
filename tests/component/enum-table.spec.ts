// ApiDocsEnumTable structural behavior — everything above the i18n contract
// (that lives in chrome-labels.spec.ts). Covers the variant `when` caption, the
// keyboard-reachable scroll region, the filter live region, and the single
// filter pass shared by tab badges and the rendered body.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import EnumTable from '../../kits/api-docs/components/EnumTable.vue'

let scrollHeight = 0
let clientHeight = 0
let observers: TestResizeObserver[] = []
let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
let frameRuns = 0

class TestResizeObserver {
  readonly targets = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this)
  }

  observe(target: Element) {
    this.targets.add(target)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

beforeEach(() => {
  scrollHeight = 0
  clientHeight = 0
  observers = []
  frames = new Map()
  nextFrame = 0
  frameRuns = 0
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => scrollHeight)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => clientHeight)
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
    frames.delete(id)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setOverflow(scroll: number, client: number) {
  scrollHeight = scroll
  clientHeight = client
}

function resize(element: Element) {
  const observer = observers.find(candidate => candidate.targets.has(element))
  if (!observer) throw new Error('EnumTable scroll box is not observed')
  observer.trigger()
}

function flushAnimationFrames() {
  const pending = [...frames.entries()]
  frames.clear()
  for (const [id, callback] of pending) {
    frameRuns += 1
    callback(id)
  }
}

/** ≥ filterThreshold(8) so the filter + bounded scroll box appear. */
const manyValues = Array.from({ length: 8 }, (_, i) => ({
  value: `value_${i}`,
  description: `desc ${i}`,
}))

const variants = [
  {
    id: 'git',
    title: 'Git deploys',
    when: 'Applies when `gitSource` is set.',
    values: [
      { value: 'BUILDING', description: 'Build running.' },
      { value: 'READY', description: 'Serving traffic.' },
    ],
  },
  {
    id: 'prebuilt',
    title: 'Prebuilt uploads',
    when: 'Applies to a prebuilt output.',
    values: [{ value: 'UPLOADING', description: 'Archive uploading.' }],
  },
]

/** The bounded scroll box; only long lists get one. */
function scrollBox(html: string) {
  return html.includes('max-h-80')
}

describe('variant applicability caption', () => {
  it('renders the active variant `when` and swaps it with the selection', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { variants } })

    const caption = wrapper.get('[data-enum-when]')
    expect(caption.text()).toContain('Applies when gitSource is set.')
    expect(caption.classes()).toContain('wrap-anywhere')
    expect(caption.classes()).toContain('min-w-0')
    expect(wrapper.text()).not.toContain('Applies to a prebuilt output.')

    // `when` is authored copy, so it goes through InlineMarkdown like every
    // other description in this kit — the backticks become inline code.
    expect(caption.get('code').text()).toBe('gitSource')

    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'prebuilt')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Applies to a prebuilt output.')
    expect(wrapper.text()).not.toContain('Applies when gitSource is set.')
  })

  it('omits the caption entirely for a variant without `when`', async () => {
    const wrapper = await mountSuspended(EnumTable, {
      props: {
        variants: [{ id: 'only', title: 'Only group', values: [{ value: 'a', description: '' }] }],
      },
    })

    expect(wrapper.text()).toContain('Only group')
    expect(wrapper.text()).not.toContain('Applies')
    expect(wrapper.find('[data-enum-when]').exists()).toBe(false)
  })
})

describe('scroll region reachability', () => {
  it('gives the bounded scroll box a named tab stop', async () => {
    // Nothing inside the box is focusable, so without this a keyboard-only
    // user cannot scroll past the fold (focus-a11y.md 键盘可达).
    setOverflow(640, 320)
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })
    flushAnimationFrames()
    await wrapper.vm.$nextTick()
    const box = wrapper.find('[role="group"]')

    expect(box.exists()).toBe(true)
    expect(box.attributes('tabindex')).toBe('0')
    expect(box.attributes('aria-label')).toBe('Allowed values')
    expect(box.classes()).toContain('focus-visible:outline-primary')
  })

  it('leaves a short list without a tab stop — it does not scroll', async () => {
    const wrapper = await mountSuspended(EnumTable, {
      props: { values: [{ value: 'a', description: 'only one' }] },
    })

    expect(scrollBox(wrapper.html())).toBe(false)
    expect(wrapper.find('[role="group"]').exists()).toBe(false)
  })

  it('keeps seven values below the inclusive default threshold', async () => {
    const wrapper = await mountSuspended(EnumTable, {
      props: { values: manyValues.slice(0, 7) },
    })

    expect(wrapper.findComponent({ name: 'UInput' }).exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(scrollBox(wrapper.html())).toBe(false)
  })

  it('keeps a long authored list bounded while filtering its visible rows', async () => {
    setOverflow(640, 320)
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })
    flushAnimationFrames()
    await wrapper.vm.$nextTick()
    const box = wrapper.get('[data-enum-scroll]')
    expect(box.attributes('tabindex')).toBe('0')

    setOverflow(40, 40)
    wrapper.findComponent({ name: 'UInput' }).vm.$emit('update:modelValue', 'value_1')
    await wrapper.vm.$nextTick()
    flushAnimationFrames()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('dt')).toHaveLength(1)
    expect(scrollBox(wrapper.html())).toBe(true)
    expect(box.attributes('tabindex')).toBeUndefined()
    expect(box.attributes('role')).toBeUndefined()

    setOverflow(360, 320)
    resize(box.element)
    flushAnimationFrames()
    await wrapper.vm.$nextTick()
    expect(box.attributes('tabindex')).toBe('0')
    expect(box.attributes('role')).toBe('group')
  })

  it('coalesces resize work and cancels a pending frame on unmount', async () => {
    setOverflow(640, 320)
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })
    const box = wrapper.get('[data-enum-scroll]')

    resize(box.element)
    resize(box.element)
    expect(frames.size).toBe(1)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3)
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(2)

    const runsBeforeUnmount = frameRuns
    wrapper.unmount()
    expect(frames.size).toBe(0)
    flushAnimationFrames()
    expect(frameRuns).toBe(runsBeforeUnmount)
  })
})

describe('filter live region', () => {
  it('announces hit count and the no-match case, staying silent while idle', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })
    const region = wrapper.find('[role="status"]')
    const filter = wrapper.findComponent({ name: 'UInput' })

    expect(region.exists()).toBe(true)
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toBe('')

    filter.vm.$emit('update:modelValue', 'value_')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').text()).toBe('8 values found')

    filter.vm.$emit('update:modelValue', 'zzz')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').text()).toBe('No matching values for “zzz”')
  })

  it('singularizes a lone hit', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })

    wrapper.findComponent({ name: 'UInput' }).vm.$emit('update:modelValue', 'value_7')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text()).toBe('1 value found')
  })

  it('has no live region when the list is too short to filter', async () => {
    const wrapper = await mountSuspended(EnumTable, {
      props: { values: [{ value: 'a', description: '' }] },
    })

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('clears a query when a reused list becomes too short to filter', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { values: manyValues } })
    const filter = wrapper.findComponent({ name: 'UInput' })

    filter.vm.$emit('update:modelValue', 'zzz')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('No matching values')

    await wrapper.setProps({ values: [{ value: 'a', description: 'only one' }] })
    expect(wrapper.findComponent({ name: 'UInput' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('only one')
    expect(wrapper.text()).not.toContain('No matching values')
  })

  it('announces matches across every variant instead of only the active panel', async () => {
    const wrapper = await mountSuspended(EnumTable, {
      props: { variants, filterThreshold: 1 },
    })

    wrapper.findComponent({ name: 'UInput' }).vm.$emit('update:modelValue', 'UPLOADING')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('dt')).toHaveLength(0)
    expect(wrapper.find('[role="status"]').text())
      .toBe('1 value found across all options; 0 in Git deploys')
    const items = wrapper.findComponent({ name: 'UTabs' }).props('items') as Array<{ badge: string }>
    expect(items.map(i => i.badge)).toEqual(['0', '1'])
  })
})

describe('variant selection', () => {
  it('warns when authored ids are duplicated', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mountSuspended(EnumTable, {
      props: {
        variants: [
          { id: 'same', title: 'First', values: [] },
          { id: 'same', title: 'Second', values: [] },
        ],
      },
    })

    expect(warn).toHaveBeenCalledWith(
      '[EnumTable] variant ids must be non-empty and unique; invalid index 1, received "same"',
    )
  })

  it('warns when a JavaScript consumer omits a variant id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mountSuspended(EnumTable, {
      props: {
        variants: [
          // @ts-expect-error — simulate an untyped JavaScript/JSON consumer.
          { title: 'Missing', values: [] },
        ],
      },
    })

    expect(warn).toHaveBeenCalledWith(
      '[EnumTable] variant ids must be non-empty and unique; invalid index 0, received undefined',
    )
  })

  it('badges each tab with its filtered count, matching what the body renders', async () => {
    // Badges and body read one filtered array, so a badge can never claim a
    // count the panel disagrees with.
    const wrapper = await mountSuspended(EnumTable, {
      props: { variants, filterThreshold: 1 },
    })

    wrapper.findComponent({ name: 'UInput' }).vm.$emit('update:modelValue', 'READY')
    await wrapper.vm.$nextTick()

    const items = wrapper.findComponent({ name: 'UTabs' }).props('items') as Array<{ badge: string }>
    expect(items.map(i => i.badge)).toEqual(['1', '0'])
    expect(wrapper.findAll('dt')).toHaveLength(1)
    expect(wrapper.text()).toContain('READY')
  })

  it('falls back to the first group when the selected variant disappears', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { variants } })

    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'prebuilt')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('UPLOADING')

    // A reused instance whose field data shrank to a single group would
    // otherwise strand the selector on a gone tab and show the empty state.
    await wrapper.setProps({ variants: [variants[0]] })
    expect(wrapper.text()).toContain('BUILDING')
    expect(wrapper.text()).not.toContain('No matching values')

    // The raw selection is reset, not merely hidden by a computed fallback.
    // Re-expanding must therefore keep the first group selected.
    await wrapper.setProps({ variants })
    expect(wrapper.findComponent({ name: 'UTabs' }).props('modelValue')).toBe('git')
    expect(wrapper.text()).toContain('BUILDING')
    expect(wrapper.text()).not.toContain('UPLOADING')
  })

  it('drops the selection when an equal-length dataset replaces the groups', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { variants } })

    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'prebuilt')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('UPLOADING')

    // Same length, unrelated groups: an index-keyed selection would silently
    // land on the second group of a dataset it was never chosen from.
    await wrapper.setProps({
      variants: [
        { id: 'preview', title: 'Preview', values: [{ value: 'QUEUED', description: 'Waiting.' }] },
        { id: 'production', title: 'Production', values: [{ value: 'PROMOTED', description: 'Live.' }] },
      ],
    })

    expect(wrapper.findComponent({ name: 'UTabs' }).props('modelValue')).toBe('preview')
    expect(wrapper.text()).toContain('QUEUED')
    expect(wrapper.text()).not.toContain('PROMOTED')
  })

  it('follows the selected variant through a reorder', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { variants } })

    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'prebuilt')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('UPLOADING')

    // Selection is the group's identity, not its position.
    await wrapper.setProps({ variants: [variants[1], variants[0]] })

    expect(wrapper.findComponent({ name: 'UTabs' }).props('modelValue')).toBe('prebuilt')
    expect(wrapper.text()).toContain('UPLOADING')
    expect(wrapper.text()).toContain('Applies to a prebuilt output.')
  })

  it('keeps the selected id when localized titles change', async () => {
    const wrapper = await mountSuspended(EnumTable, { props: { variants } })

    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'prebuilt')
    await wrapper.vm.$nextTick()
    await wrapper.setProps({
      variants: [
        { ...variants[0], title: 'Git 部署' },
        { ...variants[1], title: '预构建上传' },
      ],
    })

    expect(wrapper.findComponent({ name: 'UTabs' }).props('modelValue')).toBe('prebuilt')
    expect(wrapper.text()).toContain('预构建上传')
    expect(wrapper.text()).toContain('UPLOADING')
    expect(wrapper.text()).not.toContain('BUILDING')
  })

  it('keeps a short active variant out of the tab order when the total remains filterable', async () => {
    setOverflow(640, 320)
    const wrapper = await mountSuspended(EnumTable, {
      props: {
        variants: [
          { id: 'first', title: 'First', values: manyValues },
          { id: 'second', title: 'Second', values: [{ value: 'only', description: 'One value.' }] },
        ],
      },
    })

    flushAnimationFrames()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="group"]').exists()).toBe(true)
    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'second')
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'UInput' }).exists()).toBe(true)
    expect(wrapper.find('[role="group"]').exists()).toBe(false)
    expect(scrollBox(wrapper.html())).toBe(false)
  })
})
