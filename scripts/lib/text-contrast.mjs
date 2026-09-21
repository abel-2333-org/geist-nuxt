import postcss from 'postcss'

export const normalTextTokens = Object.freeze([
  '--ui-text-dimmed', '--ui-text-muted', '--ui-text-toned', '--ui-text', '--ui-text-highlighted',
])
export const neutralBackgroundTokens = Object.freeze([
  '--ui-bg', '--ui-bg-muted', '--ui-bg-elevated', '--ui-bg-accented',
])
export const minimumTextContrast = 4.5

const numberPattern = /^(?:\d+(?:\.\d+)?|\.\d+)$/
// CSS whitespace is ASCII space, tab, LF, CR and FF. JS trim()/\s also
// consume identifier characters such as NBSP, which changes selector meaning.
const trimCssWhitespace = value => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')

function channel(value, maximum, label) {
  if (!numberPattern.test(value)) throw new Error(`Unsupported ${label}: ${value}`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed > maximum) throw new Error(`Out-of-range ${label}: ${value}`)
  return parsed
}

/**
 * Finite sRGB subset: hex (3/4/6/8 digits) and numeric rgb()/rgba(), either
 * comma syntax or space syntax with optional / alpha. RGB is 0..255, alpha
 * is 0..1. No percentages, signs, exponents, color spaces, keywords, or
 * browser-style clamping. Browser callers must normalize other CSS colors
 * first and verify that the normalization did not lose gamut or alpha.
 */
export function parseColor(input) {
  if (typeof input !== 'string') throw new Error('Color must be a CSS string')
  const value = trimCssWhitespace(input)
  const hex = value.match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i)
  if (hex) {
    const expanded = hex[1].length <= 4 ? [...hex[1]].map(digit => digit + digit).join('') : hex[1]
    return [
      Number.parseInt(expanded.slice(0, 2), 16),
      Number.parseInt(expanded.slice(2, 4), 16),
      Number.parseInt(expanded.slice(4, 6), 16),
      expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    ]
  }

  const functional = value.match(/^rgba?\(([^()]*)\)$/i)
  if (!functional) throw new Error(`Unsupported color format: ${input}`)
  const body = trimCssWhitespace(functional[1])
  let channels
  let alpha
  if (body.includes(',')) {
    const parts = body.split(',').map(trimCssWhitespace)
    if (parts.length !== 3 && parts.length !== 4) throw new Error(`Unsupported color format: ${input}`)
    channels = parts.slice(0, 3)
    alpha = parts[3]
  }
  else {
    const parts = body.split('/').map(trimCssWhitespace)
    if (parts.length > 2) throw new Error(`Unsupported color format: ${input}`)
    channels = parts[0].split(/[\t\n\f\r ]+/)
    alpha = parts[1]
    if (channels.length !== 3) throw new Error(`Unsupported color format: ${input}`)
  }
  return [...channels.map(value => channel(value, 255, 'RGB channel')), alpha === undefined ? 1 : channel(alpha, 1, 'alpha')]
}

function assertColor(color) {
  if (!Array.isArray(color) || color.length !== 4 || Array.from(color).some((value, index) =>
    !Number.isFinite(value) || value < 0 || value > (index === 3 ? 1 : 255))) {
    throw new Error('Color must contain finite RGB channels in 0..255 and alpha in 0..1')
  }
}

/** Source-over compositing in sRGB; both input and result are [r, g, b, a]. */
export function composite(foreground, background) {
  assertColor(foreground)
  assertColor(background)
  const alpha = foreground[3] + background[3] * (1 - foreground[3])
  if (alpha === 0) return [0, 0, 0, 0]
  return [
    ...foreground.slice(0, 3).map((value, index) =>
      (value * foreground[3] + background[index] * background[3] * (1 - foreground[3])) / alpha),
    alpha,
  ]
}

function luminance(color) {
  const linear = color.slice(0, 3).map(value => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

/** Raw WCAG ratio. Resolve all opacity/background layers before calling. */
export function contrastRatio(foreground, background) {
  assertColor(foreground)
  assertColor(background)
  if (foreground[3] !== 1 || background[3] !== 1) throw new Error('Contrast requires two opaque colors')
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function declarationThemes(declaration) {
  const rule = declaration.parent
  if (rule.type !== 'rule' || rule.parent.type !== 'root') {
    throw declaration.error(`Conditional or nested token declaration is unsupported: ${declaration.prop}`)
  }
  const selectors = rule.selector.split(',').map(trimCssWhitespace).sort().join(',')
  if (selectors === ':root' || selectors === '.light,:root') return ['light', 'dark']
  if (selectors === '.light') return ['light']
  if (selectors === '.dark') return ['dark']
  throw declaration.error(`Unsupported token selector: ${rule.selector}`)
}

/**
 * This checks the SOURCE foundation token contract, not arbitrary CSS or a
 * browser cascade. Only top-level :root, .light, :root/.light, and .dark
 * definitions are supported, modeling <html class="light|dark">. They have
 * equal specificity; applicable declarations are evaluated in source order.
 * Relevant variables may use a literal supported color or one entire var()
 * without fallback. Every declaration in their dependency closure is checked,
 * including shadowed declarations, so unsupported overrides fail closed.
 *
 * The only imports accepted are the existing bare tailwindcss/@nuxt/ui
 * imports at the start of the source; their layered defaults are not expanded.
 * Other at-rules are limited to theme/media/supports/layer/keyframes/property;
 * no CSS preprocessor directive may synthesize additional token declarations.
 * This contract is intentionally independent from the built-CSS/browser gate.
 * Unrelated font/layout/functional-color declarations are outside this matrix.
 */
export function checkTextContrast(css, { from } = {}) {
  const root = postcss.parse(css, { from })
  const definitions = new Map()
  const supportedAtRules = new Set(['import', 'theme', 'media', 'supports', 'layer', 'keyframes', 'property'])
  root.walkAtRules(node => {
    if (!supportedAtRules.has(node.name.toLowerCase())) throw node.error(`Unsupported foundation at-rule: @${node.name}`)
    if (node.name.toLowerCase() === 'import' && node.parent.type !== 'root') throw node.error('Nested imports are unsupported')
  })
  let pastImports = false
  for (const node of root.nodes) {
    if (node.type === 'comment') continue
    if (node.type === 'atrule' && node.name.toLowerCase() === 'import') {
      if (pastImports || !/^(?:"(?:tailwindcss|@nuxt\/ui)"|'(?:tailwindcss|@nuxt\/ui)')$/.test(node.params)) {
        throw node.error('Only initial bare tailwindcss and @nuxt/ui imports are supported')
      }
    }
    else pastImports = true
  }
  root.walkDecls(declaration => {
    if (declaration.prop.includes('\\')) throw declaration.error('Escaped property names are unsupported')
    if (!declaration.prop.startsWith('--')) return
    const declarations = definitions.get(declaration.prop) ?? []
    declarations.push(declaration)
    definitions.set(declaration.prop, declarations)
  })

  const required = [...normalTextTokens, ...neutralBackgroundTokens]
  const relevant = new Set(required)
  const parsedDeclarations = new Map()
  for (const token of relevant) {
    const declarations = definitions.get(token)
    if (!declarations?.length) throw new Error(`Missing token: ${token}`)
    for (const declaration of declarations) {
      const themes = declarationThemes(declaration)
      if (declaration.important) throw declaration.error(`Important token declarations are unsupported: ${token}`)
      const value = trimCssWhitespace(declaration.value)
      const alias = value.match(/^var\([\t\n\f\r ]*(--[a-zA-Z0-9_-]+)[\t\n\f\r ]*\)$/)?.[1]
      if (alias) relevant.add(alias)
      const color = alias ? undefined : parseColor(value)
      if (color && color[3] !== 1) throw declaration.error(`Foundation matrix requires opaque tokens: ${token}`)
      parsedDeclarations.set(declaration, { themes, alias, color })
    }
  }
  root.walkAtRules(node => {
    if (node.name.toLowerCase() === 'property' && (relevant.has(trimCssWhitespace(node.params)) || node.params.includes('\\'))) {
      throw node.error('Custom-property registration is unsupported for contrast tokens')
    }
  })

  // Reject cycles even in shadowed declarations. This finite source contract
  // deliberately does not try to prove a cycle harmless under every cascade.
  const verified = new Set()
  function verifyAcyclic(token, visiting = new Set()) {
    if (visiting.has(token)) throw new Error(`Circular token reference: ${[...visiting, token].join(' -> ')}`)
    if (verified.has(token)) return
    for (const declaration of definitions.get(token)) {
      const { alias } = parsedDeclarations.get(declaration)
      if (alias) verifyAcyclic(alias, new Set([...visiting, token]))
    }
    verified.add(token)
  }
  for (const token of required) verifyAcyclic(token)

  const themes = { light: new Map(), dark: new Map() }
  root.walkDecls(declaration => {
    const parsed = parsedDeclarations.get(declaration)
    if (!parsed) return
    for (const theme of parsed.themes) themes[theme].set(declaration.prop, parsed)
  })

  const pairs = []
  for (const [theme, values] of Object.entries(themes)) {
    function resolve(token, visiting = new Set()) {
      if (visiting.has(token)) throw new Error(`Circular token reference in ${theme}: ${[...visiting, token].join(' -> ')}`)
      const value = values.get(token)
      if (!value) throw new Error(`Missing token in ${theme}: ${token}`)
      if (value.color) return value.color
      return resolve(value.alias, new Set([...visiting, token]))
    }
    for (const textToken of normalTextTokens) {
      for (const backgroundToken of neutralBackgroundTokens) {
        const foreground = resolve(textToken)
        const background = resolve(backgroundToken)
        const ratio = contrastRatio(foreground, background)
        pairs.push({ theme, textToken, backgroundToken, foreground, background, ratio, passed: ratio >= minimumTextContrast })
      }
    }
  }
  return { pairs, failures: pairs.filter(pair => !pair.passed), minimumRatio: Math.min(...pairs.map(pair => pair.ratio)) }
}

export function assertTextContrast(css, options) {
  const result = checkTextContrast(css, options)
  if (result.failures.length) {
    const details = result.failures.map(pair =>
      `${pair.theme} ${pair.textToken} on ${pair.backgroundToken}: ${pair.ratio}`).join('\n')
    throw new Error(`Normal text contrast failed (${result.failures.length}/${result.pairs.length}; minimum ${minimumTextContrast}:1):\n${details}`)
  }
  return result
}
