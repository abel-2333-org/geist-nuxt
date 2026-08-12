// <CodeBlock> — toolbar control visibility, code-surface a11y, and the trusted
// dual-theme fragment contract.
//
// Covers the two 2026-08-06 audit fixes:
//  1. the language select is a SELECTION control: with >1 languages it stays
//     visible even when the active variant has no code, so a reader can always
//     switch away from the empty state ("Try another selection.");
//  2. the scrollable code surface is a keyboard-focusable named group
//     (tabindex=0), so keyboard users can scroll past maxHeight without adding
//     one landmark per code block.
// Plus the #79 dual-theme fragment behavior boundaries: trusted fragments
// render as elements with their token styles intact, untrusted input stays
// escaped, and the scoped dark-token switch rule ships with the component.
// The computed light/dark token COLORS are deliberately not asserted here —
// happy-dom neither injects SFC styles nor cascades CSS, so that proof is
// owned by the real-browser gallery acceptance (issue #79).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import CodeBlock from '../../kits/api-docs/components/CodeBlock.vue'
import CopyButton from '../../foundation/components/CopyButton.vue'

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

// A realistic build-time Shiki dual-theme fragment: no `.shiki` / `<pre>`
// wrapper, each token span carries an inline light color plus `--shiki-dark`.
const dualThemeFragment
  = '<span class="line">'
    + '<span style="color:#A0111F;--shiki-dark:#89DDFF">curl</span>'
    + '<span style="color:#023B95;--shiki-dark:#C3E88D"> --request</span>'
    + '</span>'

const highlightedVariants = [
  { language: 'bash', code: 'curl --request', highlightedHtml: dualThemeFragment },
]

describe('CodeBlock trusted dual-theme fragments', () => {
  it('renders trusted fragments as elements with token styles intact', async () => {
    const wrapper = await mountSuspended(CodeBlock, {
      props: { variants: highlightedVariants, trustHighlightedHtml: true },
    })

    // v-html must keep both halves of every dual-theme token declaration.
    const tokens = wrapper.findAll('pre span[style]')
    expect(tokens).toHaveLength(2)
    expect(tokens[0]!.attributes('style')).toContain('color:#A0111F')
    expect(tokens[0]!.attributes('style')).toContain('--shiki-dark:#89DDFF')
    expect(tokens[1]!.attributes('style')).toContain('color:#023B95')
    expect(tokens[1]!.attributes('style')).toContain('--shiki-dark:#C3E88D')

    // The clipboard truth stays the raw source, never the markup.
    expect(wrapper.findComponent(CopyButton).props('value')).toBe('curl --request')
  })

  it('escapes the fragment without the explicit trust opt-in', async () => {
    const wrapper = await mountSuspended(CodeBlock, {
      props: { variants: highlightedVariants },
    })

    expect(wrapper.find('pre span').exists()).toBe(false)
    expect(wrapper.find('pre').text()).toBe('curl --request')
  })

  it('ships the scoped dark-token switch rule with the component', async () => {
    // Resolved from the repo root (vitest cwd): the Nuxt test environment does
    // not expose file:// module URLs, so import.meta.url cannot anchor this.
    const source = await readFile(
      join(process.cwd(), 'kits/api-docs/components/CodeBlock.vue'),
      'utf8',
    )
    const style = source.slice(source.indexOf('<style'))
    expect(style).toContain('.dark .raw-pre :deep(span)')
    expect(style).toContain('color: var(--shiki-dark, inherit) !important')
  })
})
