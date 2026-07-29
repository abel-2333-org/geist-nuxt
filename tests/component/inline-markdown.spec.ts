import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import InlineMarkdown from '../../foundation/components/InlineMarkdown.vue'
import { parse, type Node } from '../../foundation/components/inline-markdown/parse'

async function render(text: string) {
  return mountSuspended(InlineMarkdown, { props: { text } })
}

async function textOf(text: string) {
  return (await render(text)).text().replace(/\s+/g, ' ')
}

function visibleText(nodes: Node[]): string {
  return nodes.map(node =>
    node.type === 'text' || node.type === 'code'
      ? node.value
      : visibleText(node.children),
  ).join('')
}

describe('InlineMarkdown supported subset', () => {
  it('renders supported markers through their semantic elements', async () => {
    expect((await render('**bold**')).find('strong').text()).toBe('bold')
    expect((await render('__bold__')).find('strong').text()).toBe('bold')
    expect((await render('*em*')).find('em').text()).toBe('em')
    expect((await render('_em_')).find('em').text()).toBe('em')
    expect((await render('~~gone~~')).find('del').text()).toBe('gone')
    expect((await render('`token`')).find('code').text()).toBe('token')
  })

  it('uses CommonMark delimiter semantics for nested and adjacent runs', async () => {
    for (const input of ['***both***', '___both___']) {
      const wrapper = await render(input)
      expect(wrapper.find('strong').exists()).toBe(true)
      expect(wrapper.find('em').exists()).toBe(true)
      expect(wrapper.text()).toBe('both')
    }

    const nested = await render('**bold *em***')
    expect(nested.find('strong').text()).toBe('bold em')
    expect(nested.find('strong').find('em').text()).toBe('em')
    expect(nested.text()).toBe('bold em')
  })

  it('parses recursively but never re-parses a code span', async () => {
    const nested = await render('**bold with `code` and *em* here**')
    expect(nested.find('strong').find('code').text()).toBe('code')
    expect(nested.find('strong').find('em').text()).toBe('em')

    const raw = await render('`a*b*c`')
    expect(raw.find('code').text()).toBe('a*b*c')
    expect(raw.find('em').exists()).toBe(false)
  })

  it('keeps surrounding text, order and multiple matches intact', async () => {
    expect(await textOf('a **b** c *d* e')).toBe('a b c d e')
    expect(await textOf('see [docs](/d) and [more](/m)')).toBe('see docs and more')
    expect(await textOf('multi\nline **bold**')).toBe('multi line bold')
  })

  it('renders empty text as an empty span', async () => {
    const wrapper = await render('')
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('span').exists()).toBe(true)
  })
})

describe('InlineMarkdown links', () => {
  it('routes internal hrefs and opens external ones in a new tab', async () => {
    const internal = (await render('[docs](/reference)')).find('a')
    expect(internal.attributes('href')).toBe('/reference')
    expect(internal.attributes('target')).toBeUndefined()

    const external = (await render('[site](https://example.com)')).find('a')
    expect(external.attributes('href')).toBe('https://example.com')
    expect(external.attributes('target')).toBe('_blank')
    expect(external.attributes('rel')).toContain('noopener')
  })

  it('parses the label but leaves the safe URL as an attribute', async () => {
    const wrapper = await render('[**bold** label](/a_b_c)')
    expect(wrapper.find('a').find('strong').text()).toBe('bold')
    expect(wrapper.find('a').attributes('href')).toBe('/a_b_c')
  })

  it('leaves unsafe links literal', async () => {
    const input = '[open](javascript:alert(1))'
    const wrapper = await render(input)
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toBe(input)
  })
})

describe('InlineMarkdown literal syntax', () => {
  it.each([
    '<kbd>Enter</kbd>',
    '![logo](logo.png)',
    '<https://example.com>',
  ])('does not widen the subset for %j', async (input) => {
    const wrapper = await render(input)
    expect(wrapper.text()).toBe(input)
    expect(wrapper.find('kbd').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it.each([
    'snake_case_name',
    'MAX__VALUE__LIMIT',
    '参数_必填_说明',
    'ключ_значение',
    'café_valeur',
    'https://example.com/a_b_c',
    '1_000_000',
    '2*3*4',
    'foo*bar*baz',
    '参数*必填*说明',
    'e\u0301*value*tail',
    'regex [a-z_]__[0-9]',
  ])('keeps technical text %j literal', (input) => {
    expect(visibleText(parse(input))).toBe(input)
  })

  it.each([
    String.raw`^\d{3}\*$`,
    String.raw`C:\*.txt`,
    String.raw`\*literal\*`,
  ])('preserves backslashes in %j', (input) => {
    expect(visibleText(parse(input))).toBe(input)
  })

  it.each([
    '*',
    '**',
    '***',
    '****',
    '*****',
    '******',
    '_',
    '__',
    '___',
    '____',
    '_____',
    '______',
  ])('leaves an unmatched delimiter run %j literal', (input) => {
    expect(visibleText(parse(input))).toBe(input)
  })

  it('preserves unmatched excess delimiters according to CommonMark', () => {
    expect(visibleText(parse('**foo***'))).toBe('foo*')
    expect(visibleText(parse('****x****'))).toBe('x')
    expect(visibleText(parse('**unclosed'))).toBe('**unclosed')
  })
})
