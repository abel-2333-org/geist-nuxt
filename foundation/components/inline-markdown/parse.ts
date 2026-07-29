import { Lexer, type Token } from 'marked'

export type Node =
  | { type: 'text', value: string }
  | { type: 'code', value: string }
  | { type: 'strong', children: Node[] }
  | { type: 'em', children: Node[] }
  | { type: 'del', children: Node[] }
  | { type: 'link', href: string, external: boolean, children: Node[] }

const base = new URL('https://geist.invalid')

function link(href: string) {
  try {
    const url = new URL(href, base)
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null
    return {
      href,
      external: /^(https?:)?\/\//i.test(href),
    }
  }
  catch {
    return null
  }
}

const identifier = /\p{ID_Continue}/u

function edge(raw: string | undefined, side: 'first' | 'last') {
  const chars = [...(raw ?? '')]
  return side === 'first' ? chars[0] : chars.at(-1)
}

function isIntrawordStar(tokens: Token[], index: number, token: Token) {
  return token.type === 'em'
    && token.raw.startsWith('*')
    && identifier.test(edge(tokens[index - 1]?.raw, 'last') ?? '')
    && identifier.test(edge(tokens[index + 1]?.raw, 'first') ?? '')
}

function parseToken(token: Token, tokens: Token[], index: number): Node {
  if (token.type === 'text' || token.type === 'escape') {
    return { type: 'text', value: token.raw }
  }
  if (token.type === 'codespan') {
    return { type: 'code', value: token.text }
  }
  if (isIntrawordStar(tokens, index, token)) {
    return { type: 'text', value: token.raw }
  }
  if (token.type === 'strong' || token.type === 'em' || token.type === 'del') {
    return { type: token.type, children: parseTokens(token.tokens ?? []) }
  }
  if (token.type === 'link' && token.raw.startsWith('[')) {
    const target = link(token.href)
    if (target) {
      return {
        type: 'link',
        ...target,
        children: parseTokens(token.tokens ?? []),
      }
    }
  }
  return { type: 'text', value: token.raw }
}

function parseTokens(tokens: Token[]): Node[] {
  return tokens.map((token, index) => parseToken(token, tokens, index))
}

export function parse(text: string): Node[] {
  return parseTokens(Lexer.lexInline(text))
}
