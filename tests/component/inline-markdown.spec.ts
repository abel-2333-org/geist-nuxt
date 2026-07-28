// Tokenizer contract for the inline markdown subset. InlineMarkdown is the
// most-depended-on foundation atom (TermAnnotation, DocAnnotation, EnumTable,
// FieldItem, FieldAnnotation), and every string a doc author writes into a
// field description, condition, note or enum row passes through it — so its
// parsing rules ARE a public contract.
//
// The invariant these tests protect: authored copy never renders a stray
// marker character. Either a run is recognised and consumed whole, or it is
// left alone as literal text. A half-consumed run (`<strong>*x</strong>*`) is
// the one outcome that must not happen, because it corrupts published docs.
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import InlineMarkdown from '../../foundation/components/InlineMarkdown.vue'

async function render(text: string) {
  const wrapper = await mountSuspended(InlineMarkdown, { props: { text } })
  return wrapper
}

/** Rendered text with whitespace collapsed — what a reader actually sees. */
async function textOf(text: string) {
  return (await render(text)).text().replace(/\s+/g, ' ')
}

describe('InlineMarkdown markers', () => {
  it('renders each single-marker form through its Prose element', async () => {
    expect((await render('**bold**')).find('strong').text()).toBe('bold')
    expect((await render('__bold__')).find('strong').text()).toBe('bold')
    expect((await render('*em*')).find('em').text()).toBe('em')
    expect((await render('_em_')).find('em').text()).toBe('em')
    expect((await render('~~gone~~')).find('del').text()).toBe('gone')
    expect((await render('`token`')).find('code').text()).toBe('token')
  })

  it('nests strong around em for a triple run', async () => {
    for (const input of ['***both***', '___both___']) {
      const wrapper = await render(input)
      const strong = wrapper.find('strong')
      expect(strong.exists()).toBe(true)
      expect(strong.find('em').text()).toBe('both')
      // The whole run is consumed: no surplus marker survives as text.
      expect(wrapper.text()).toBe('both')
    }
  })

  it('parses markers recursively but never re-parses a code span', async () => {
    // KNOWN LIMITATION: an inner run sitting FLUSH against the closing markers
    // (`**a *b***`) still strands one, because resolving it needs CommonMark's
    // delimiter-run algorithm rather than an ordered rule list. Separated by
    // any text, as here, nesting resolves correctly.
    const nested = await render('**bold with `code` and *em* here**')
    expect(nested.find('strong').find('code').text()).toBe('code')
    expect(nested.find('strong').find('em').text()).toBe('em')

    const raw = await render('`a*b*c`')
    expect(raw.find('code').text()).toBe('a*b*c')
    expect(raw.find('em').exists()).toBe(false)
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
    // ULink manages rel for external targets; assert it actually arrives.
    expect(external.attributes('rel')).toContain('noopener')
  })

  it('parses the label but leaves the url a bare attribute', async () => {
    const wrapper = await render('[**bold** label](/a_b_c)')
    expect(wrapper.find('a').find('strong').text()).toBe('bold')
    expect(wrapper.find('a').attributes('href')).toBe('/a_b_c')
  })
})

describe('InlineMarkdown leaves technical text alone', () => {
  // Every string here occurs naturally in API reference copy. None may be
  // emphasised, and — more importantly — none may come back with a marker
  // character partially eaten.
  const literal = [
    'snake_case_name',
    'MAX__VALUE__LIMIT',
    'my__dunder__thing',
    'field__a__b__c',
    'order_id and user_id',
    'https://example.com/a_b_c',
    '1_000_000',
    '2*3*4',
    '5*3',
    'func(a, b) with * star',
    '* not a list item',
    'C_MAX_ value',
    'x ** y',
    'pattern ^\\d{3}\\*$',
    'C:\\*.txt',
    'regex [a-z_]__[0-9]',
    '**unclosed',
    '__x',
  ]

  it.each(literal)('renders %j verbatim', async (input) => {
    expect(await textOf(input)).toBe(input)
  })
})

describe('InlineMarkdown never strands a marker', () => {
  // Regression guard for the class of bug this suite was written for: a rule
  // consuming part of a marker run and leaving the remainder visible.
  const inputs = [
    '***both***',
    '___both___',
    '__bold__',
    '__init__',
    '__bold with *em*__',
    'a ___b___ c',
    '**a** __b__ ***c***',
    '**bold***em*',
    'a **b** c *d* e',
    '~~a~~ and **b**',
  ]

  it.each(inputs)('leaves no literal marker in %j', async (input) => {
    const rendered = await textOf(input)
    expect(rendered).not.toMatch(/[*_~]/)
  })
})

describe('InlineMarkdown mixed content', () => {
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

  it('emphasises CJK-adjacent runs while leaving CJK identifiers alone', async () => {
    expect((await render('参数 **必填** 说明')).find('strong').text()).toBe('必填')
    expect(await textOf('参数 **必填** 说明')).toBe('参数 必填 说明')
  })
})
