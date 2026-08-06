// <CodeBlock> — toolbar control visibility and code-surface a11y.
//
// Covers the two 2026-08-06 audit fixes:
//  1. the language select is a SELECTION control: with >1 languages it stays
//     visible even when the active variant has no code, so a reader can always
//     switch away from the empty state ("Try another selection.");
//  2. the scrollable code surface is a keyboard-focusable named group
//     (tabindex=0), so keyboard users can scroll past maxHeight without adding
//     one landmark per code block.
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import CodeBlock from '../../kits/api-docs/components/CodeBlock.vue'

const twoLanguages = [
  { language: 'curl', code: 'curl https://api.example.com/v1/pets' },
  { language: 'node', code: '' },
]

/** The language <USelect> in the toolbar (code icon). */
function languageSelect(wrapper: VueWrapper<InstanceType<typeof CodeBlock>>) {
  return wrapper
    .findAllComponents({ name: 'USelect' })
    .find(select => select.props('icon') === 'i-lucide-code')
}

describe('CodeBlock language select visibility', () => {
  it('keeps the select visible when the active variant has no code', async () => {
    const wrapper = await mountSuspended(CodeBlock, {
      props: { variants: twoLanguages },
    })

    const select = languageSelect(wrapper)
    expect(select).toBeDefined()

    // Switch to the empty variant: the empty state shows, but the select must
    // survive so the reader can follow its own hint and switch back.
    select!.vm.$emit('update:modelValue', 'node')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('No example available')
    expect(languageSelect(wrapper)).toBeDefined()

    // Content-bound controls do hide with no code: only the copy/wrap buttons
    // disappear, and the copy source is gone with them.
    expect(wrapper.find('[aria-pressed]').exists()).toBe(false)
  })

  it('hides the select entirely when there are no variants', async () => {
    const wrapper = await mountSuspended(CodeBlock, { props: { variants: [] } })

    expect(languageSelect(wrapper)).toBeUndefined()
    expect(wrapper.text()).toContain('No example available')
  })
})

describe('CodeBlock code surface a11y', () => {
  it('is a keyboard-focusable non-landmark group named by the title', async () => {
    const wrapper = await mountSuspended(CodeBlock, {
      props: { variants: twoLanguages, title: 'request.sh' },
    })

    const group = wrapper.find('[role="group"]')
    expect(group.exists()).toBe(true)
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
    expect(group.attributes('tabindex')).toBe('0')
    expect(group.attributes('aria-label')).toBe('request.sh')
    expect(group.find('pre').attributes('translate')).toBe('no')
  })

  it('falls back to the localizable codeRegion label without a title', async () => {
    const english = await mountSuspended(CodeBlock, {
      props: { variants: twoLanguages },
    })
    expect(english.find('[role="group"]').attributes('aria-label')).toBe('Code sample')

    const localized = await mountSuspended(CodeBlock, {
      props: { variants: twoLanguages, labels: { codeRegion: '代码示例' } },
    })
    expect(localized.find('[role="group"]').attributes('aria-label')).toBe('代码示例')
  })
})
