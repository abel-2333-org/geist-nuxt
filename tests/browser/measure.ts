import type { Browser, Locator } from 'playwright-core'
import { composite, contrastRatio } from '../../scripts/lib/text-contrast.mjs'

type PaintEngine = { product: string, revision: string, boundedShadow: boolean }
const paintEngines = new WeakMap<Browser, Promise<PaintEngine>>()
async function paintEngine(locator: Locator): Promise<PaintEngine> {
  const browser = locator.page().context().browser()
  if (!browser) return { product: 'unavailable', revision: '', boundedShadow: false }
  let identity = paintEngines.get(browser)
  if (!identity) {
    identity = (async () => {
      try {
        const cdp = await browser.newBrowserCDPSession()
        try {
          const { product, revision } = await cdp.send('Browser.getVersion')
          return { product, revision, boundedShadow: product === 'Chrome/153.0.8010.12'
            && revision === '@971a7443b0c9b0a9b2860529b33331b76077ec62' }
        }
        finally { await cdp.detach() }
      }
      catch { return { product: browser.version(), revision: 'unavailable', boundedShadow: false } }
    })()
    paintEngines.set(browser, identity)
  }
  return identity
}

export async function measure(locator: Locator, pseudo: '::placeholder' | null = null) {
  const engine = await paintEngine(locator)
  const paint = await locator.evaluate((element, { pseudo, engine }) => {
    const target = element as HTMLElement
    const style = getComputedStyle(target, pseudo)
    const rect = target.getBoundingClientRect()
    const input = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    const host = getComputedStyle(target)
    // Form controls do not expose a DOM Range for their text. Their content
    // box is a conservative bound: a thin inset ring outside it cannot paint
    // behind a glyph. Other targets use their actual text range when possible.
    const range = document.createRange()
    range.selectNodeContents(target)
    type Bounds = { left: number, right: number, top: number, bottom: number }
    function transformed(element: Element, allowTranslation = false, wholePixelTranslation = false) {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const css = getComputedStyle(node)
        if (css.zoom !== '1' || (node as Element & { currentCSSZoom?: number }).currentCSSZoom !== 1) return true
        if (css.rotate !== 'none' || css.scale !== 'none' || css.perspective !== 'none' || css.transformStyle !== 'flat') return true
        if (css.transform !== 'none') {
          if (!allowTranslation) return true
          let matrix: DOMMatrixReadOnly
          // CSS strings round small scale changes into apparent identity. Typed
          // OM retains the underlying numbers and must be available for proof.
          try { matrix = (node as any).computedStyleMap().get('transform').toMatrix() }
          catch { return true }
          if (!matrix.is2D || matrix.a !== 1 || matrix.b !== 0 || matrix.c !== 0 || matrix.d !== 1
            || !Number.isFinite(matrix.e) || !Number.isFinite(matrix.f)) return true
          if (wholePixelTranslation && (!Number.isSafeInteger(matrix.e) || !Number.isSafeInteger(matrix.f))) return true
        }
      }
      return false
    }
    // A Range includes clipped glyphs. Intersect only with rectangular clips
    // whose containing-block relationship we can prove; never use an epsilon.
    function clipped(box: Bounds, leaf: Element, includeSelf = true): Bounds {
      const result = { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      for (let node: Element | null = leaf; node; node = node.parentElement) {
        const css = getComputedStyle(node)
        // Out-of-flow content can escape an overflow ancestor. Keeping the
        // larger bounds is conservative when that relationship is unmodeled.
        if (css.position === 'absolute' || css.position === 'fixed') {
          // This one bounded case has a known immediate containing block.
          // Do not infer clips across any other out-of-flow ancestor path.
          if (node === leaf && css.position === 'absolute' && node.parentElement
            && getComputedStyle(node.parentElement).position === 'relative'
            && getComputedStyle(node.parentElement).display !== 'contents'
            && !transformed(node.parentElement)) continue
          break
        }
        if (!includeSelf && node === leaf) continue
        if (css.display === 'contents') continue
        // overflow does not clip a non-replaced inline box. Keep unknown box
        // types conservative instead of treating every computed value as a clip.
        if (!['block', 'inline-block', 'flow-root', 'flex', 'inline-flex', 'grid', 'inline-grid'].includes(css.display)) continue
        if (transformed(node)) continue
        const bounds = node.getBoundingClientRect()
        // overflow:clip can extend via overflow-clip-margin; that geometry
        // is not modeled, so it cannot justify excluding any paint.
        if (/^(hidden|scroll|auto)$/.test(css.overflowX)) {
          result.left = Math.max(result.left, bounds.left + parseFloat(css.borderLeftWidth))
          result.right = Math.min(result.right, bounds.right - parseFloat(css.borderRightWidth))
        }
        if (/^(hidden|scroll|auto)$/.test(css.overflowY)) {
          result.top = Math.max(result.top, bounds.top + parseFloat(css.borderTopWidth))
          result.bottom = Math.min(result.bottom, bounds.bottom - parseFloat(css.borderBottomWidth))
        }
      }
      return result
    }
    const rawTextRect = input ? {
      left: rect.left + parseFloat(host.borderLeftWidth) + parseFloat(host.paddingLeft),
      right: rect.right - parseFloat(host.borderRightWidth) - parseFloat(host.paddingRight),
      top: rect.top + parseFloat(host.borderTopWidth) + parseFloat(host.paddingTop),
      bottom: rect.bottom - parseFloat(host.borderBottomWidth) - parseFloat(host.paddingBottom),
    } : range.getBoundingClientRect()
    function singleGlyphTop() {
      // A text Range includes font leading. Only this isolated, ordinary glyph
      // path has the same shaping/font metrics in DOM and Canvas. Every other
      // path keeps the original Range, including unsupported font features.
      const glyph = target.textContent || ''
      if (input || pseudo || !engine.boundedShadow || devicePixelRatio !== 1 || visualViewport?.scale !== 1
        || !/^[!-~]$/.test(glyph) || target.childNodes.length !== 1 || target.firstChild?.nodeType !== Node.TEXT_NODE
        || range.getClientRects().length !== 1 || !['inline-block', 'flow-root'].includes(host.display)
        || [rawTextRect.left, rawTextRect.right, rawTextRect.top, rawTextRect.bottom].some(v => !Number.isFinite(v) || Math.abs(v) >= 2 ** 18)
        || transformed(target) || host.writingMode !== 'horizontal-tb' || host.direction !== 'ltr'
        || host.fontStyle !== 'normal' || host.fontVariant !== 'normal' || host.fontFeatureSettings !== 'normal'
        || host.fontVariationSettings !== 'normal' || host.fontSizeAdjust !== 'none' || host.fontOpticalSizing !== 'auto'
        || host.fontKerning !== 'auto' || host.textRendering !== 'auto' || host.letterSpacing !== 'normal'
        || !['normal', '0px'].includes(host.wordSpacing) || host.textTransform !== 'none'
        || host.textCombineUpright !== 'none' || host.textEmphasisStyle !== 'none'
        || host.textShadow !== 'none' || host.webkitTextStrokeWidth !== '0px') return null
      const fontProperties = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant',
        'font-feature-settings', 'font-variation-settings', 'font-size-adjust', 'font-optical-sizing', 'font-language-override',
        'text-transform', 'text-shadow', '-webkit-text-stroke-width', 'text-decoration-line', 'text-emphasis-style']
      for (let node: Element | null = target; node; node = node.parentElement) {
        const css = getComputedStyle(node)
        if (node.hasAttribute('xml:lang') || css.getPropertyValue('font-language-override') !== 'normal' || css.translate !== 'none' || css.textDecorationLine !== 'none' || css.textEmphasisStyle !== 'none'
          || css.getPropertyValue('dominant-baseline') !== 'auto' || css.getPropertyValue('text-fit') !== 'none'
          || css.getPropertyValue('text-box-trim') !== 'none' || css.getPropertyValue('text-box-edge') !== 'auto') return null
        for (const name of ['::first-line', '::first-letter']) {
          const ps = getComputedStyle(node, name)
          if (fontProperties.some(key => ps.getPropertyValue(key) !== css.getPropertyValue(key))) return null
        }
      }
      try {
        const map = (target as any).computedStyleMap()
        const size = map.get('font-size'), weight = map.get('font-weight'), stretch = map.get('font-stretch')
        if (size.unit !== 'px' || !Number.isFinite(size.value) || size.value <= 4 || size.value > 256
          || weight.unit !== 'number' || weight.value !== 400 || stretch.unit !== 'percent' || stretch.value !== 100) return null
        // Require a loaded ordinary face for this primary family. Unknown font
        // selection/descriptors are not a license to shrink a Range.
        const family = /^"([^"\\]+)"(?:,|$)/.exec(host.fontFamily)?.[1]
        if (!family || !document.fonts.check(`${size.value}px "${family}"`, glyph)) return null
        const familyFaces = Array.from(document.fonts).filter(face => face.family.replace(/^"|"$/g, '') === family && face.style === 'normal')
        if (familyFaces.some(face => !/^(normal|[0-9]+)$/.test(face.weight))) return null
        const faces = familyFaces.filter(face => ['normal', '400'].includes(face.weight) && ['normal', '100%'].includes(face.stretch))
        const coverage = (face: FontFace) => {
          const ranges = face.unicodeRange.split(',').map(part => /^\s*U\+([0-9A-F]+)(?:-([0-9A-F]+))?\s*$/i.exec(part))
          if (ranges.some(match => !match)) return null
          const code = glyph.codePointAt(0)!
          return ranges.some(match => code >= parseInt(match![1]!, 16) && code <= parseInt(match![2] || match![1]!, 16))
        }
        if (faces.some(face => coverage(face) === null)) return null
        const matches = faces.filter(face => coverage(face))
        if (matches.length !== 1) return null
        const face = matches[0]! as FontFace & { variationSettings?: string, variant?: string, sizeAdjust?: string }
        if (face.variationSettings !== 'normal' || face.variant !== 'normal' || face.status !== 'loaded' || face.featureSettings !== 'normal'
          || face.ascentOverride !== 'normal' || face.descentOverride !== 'normal' || face.lineGapOverride !== 'normal'
          || face.sizeAdjust !== '100%') return null
        const context = document.createElement('canvas').getContext('2d')
        if (!context) return null
        const language = target.closest('[lang]')?.getAttribute('lang') || ''
        const localized = context as CanvasRenderingContext2D & { lang?: string }
        if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language) || typeof localized.lang !== 'string'
          || host.getPropertyValue('-webkit-locale') !== `\"${language}\"`) return null
        localized.lang = language
        if (localized.lang !== language) return null
        context.direction = 'ltr'
        context.font = `${weight.value} ${size.value}px ${host.fontFamily}`
        context.textBaseline = 'alphabetic'
        const metrics = context.measureText(glyph)
        const values = [metrics.fontBoundingBoxAscent, metrics.fontBoundingBoxDescent, metrics.actualBoundingBoxAscent,
          metrics.actualBoundingBoxDescent, metrics.width]
        if (!values.every(Number.isFinite) || metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent <= 0
          || Math.abs(rawTextRect.bottom - rawTextRect.top - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) > 1
          || Math.abs(rawTextRect.right - rawTextRect.left - metrics.width) > 1 / 64) return null
        // Blink's DOM baseline rounds the primary font ascent; Canvas uses its
        // float ascent. Retain 0.5px for that difference and 1px for glyph ink
        // rasterization, then round outward. X and bottom are never tightened.
        const top = Math.max(rawTextRect.top, Math.floor(rawTextRect.top + metrics.fontBoundingBoxAscent
          - metrics.actualBoundingBoxAscent - 0.5 - 1))
        if (top >= rawTextRect.bottom) return null
        return { top, glyph, font: context.font, language, primaryFace: { family: face.family, status: face.status, unicodeRange: face.unicodeRange }, fontBoundingBoxAscent: metrics.fontBoundingBoxAscent,
          actualBoundingBoxAscent: metrics.actualBoundingBoxAscent, baselineAllowance: 0.5, rasterAllowance: 1 }
      }
      catch { return null }
    }
    const glyphBounds = singleGlyphTop()
    const textRect = clipped({ left: rawTextRect.left, right: rawTextRect.right, top: glyphBounds?.top ?? rawTextRect.top,
      bottom: rawTextRect.bottom }, target)
    const text = pseudo ? (target as HTMLInputElement).placeholder : ((target as HTMLInputElement).value || target.textContent?.trim())
    const fail = (reason: string): never => { throw new Error(`unresolved: ${reason}`) }
    if (!text || !rect.width || !rect.height || textRect.right <= textRect.left || textRect.bottom <= textRect.top || getComputedStyle(target).visibility !== 'visible') fail('empty or hidden target')
    if (pseudo && (target as HTMLInputElement).value) fail('placeholder is not visible')
    const probe = document.createElement('span')
    probe.style.position = 'fixed'
    probe.style.visibility = 'hidden'
    document.body.append(probe)
    function color(value: string) {
      // Chromium resolves color-mix/OKLab using its own CSS color engine.
      // Relative color serialization preserves floating channels; canvas
      // getImageData would round them to 8-bit integers before the threshold.
      probe.style.color = ''
      probe.style.color = `color(from ${value} srgb r g b / alpha)`
      if (!probe.style.color) fail(`unsupported color ${value}`)
      const normalized = getComputedStyle(probe).color
      const match = /^color\(srgb ([\d.e+-]+) ([\d.e+-]+) ([\d.e+-]+)(?: \/ ([\d.e+-]+))?\)$/.exec(normalized)
      if (!match) fail(`unsupported serialization ${normalized}`)
      const channels = match!.slice(1, 4).map(Number)
      const alpha = match![4] === undefined ? 1 : Number(match![4])
      if ([...channels, alpha].some(v => !Number.isFinite(v) || v < 0 || v > 1)) fail(`out of gamut ${normalized}`)
      return [...channels.map(v => v * 255), alpha]
    }
    function shadows(value: string) {
      if (value === 'none') return []
      const colors: string[] = []
      return value.replace(/(?:rgba?|color|oklab|oklch|lab|lch)\([^)]*\)/g, value => {
        colors.push(value); return `COLOR${colors.length - 1}`
      }).split(',').map(shadow => {
        const match = /COLOR(\d+)/.exec(shadow)
        if (!match) fail('unsupported shadow color')
        const lengths = shadow.replace(/COLOR\d+|inset/g, '').trim().split(/\s+/)
        if (lengths.length !== 4 || lengths.some(v => !/^-?[\d.]+px$/.test(v))) fail('unsupported shadow geometry')
        const [x, y, blur, spread] = lengths.map(parseFloat)
        if (![x, y, blur, spread].every(Number.isFinite)) fail('unsupported shadow lengths')
        return { inset: shadow.includes('inset'), alpha: color(colors[Number(match![1])]!)[3]!, x: x!, y: y!, blur: blur!, spread: spread! }
      })
    }
    // Border bands and corner rectangles conservatively contain border paint.
    // A transparent background says nothing about these independently colored
    // strokes. Unknown border geometry must not become an empty paint list.
    function supportedBorder(node: Element, css: CSSStyleDeclaration) {
      const sides = [
        [css.borderTopWidth, css.borderTopColor], [css.borderRightWidth, css.borderRightColor],
        [css.borderBottomWidth, css.borderBottomColor], [css.borderLeftWidth, css.borderLeftColor],
      ] as const
      const widths = sides.map(([width, shade]) => parseFloat(width) > 0 && color(shade)[3]! > 0 ? parseFloat(width) : 0)
      if (!widths.some(width => width > 0)) return
      const box = node.getBoundingClientRect()
      if (!overlapsText(clipped(box, node, false))) return
      if (node.getClientRects().length !== 1) fail('unmodeled fragmented border paint')
      if (transformed(node, true)) fail('unmodeled transformed border paint')
      const [top, right, bottom, left] = widths as [number, number, number, number]
      const bands = [
        { left: box.left, right: box.right, top: box.top, bottom: box.top + top },
        { left: box.right - right, right: box.right, top: box.top, bottom: box.bottom },
        { left: box.left, right: box.right, top: box.bottom - bottom, bottom: box.bottom },
        { left: box.left, right: box.left + left, top: box.top, bottom: box.bottom },
      ]
      for (const [radius, isLeft, isTop, painted] of [
        [css.borderTopLeftRadius, true, true, top || left], [css.borderTopRightRadius, false, true, top || right],
        [css.borderBottomLeftRadius, true, false, bottom || left], [css.borderBottomRightRadius, false, false, bottom || right],
      ] as const) {
        if (!painted) continue
        const values = radius.split(' ')
        const length = (value: string, axis: number) => /^\d+(?:\.\d+)?px$/.test(value) ? parseFloat(value)
          : /^\d+(?:\.\d+)?%$/.test(value) ? parseFloat(value) * axis / 100 : NaN
        const x = length(values[0]!, box.width), y = length(values[1] || values[0]!, box.height)
        if (!Number.isFinite(x) || !Number.isFinite(y)) fail('unmodeled border radius paint')
        bands.push({ left: isLeft ? box.left : box.right - x, right: isLeft ? box.left + x : box.right,
          top: isTop ? box.top : box.bottom - y, bottom: isTop ? box.top + y : box.bottom })
      }
      if (bands.some(band => overlapsText(clipped(band, node, false)))) fail(`unmodeled overlapping border paint on ${node.tagName}`)
    }
    function boundedPaintGeometry(node: Element, css: CSSStyleDeclaration) {
      const shape = css.getPropertyValue('border-shape')
      if (!engine.boundedShadow || devicePixelRatio !== 1 || visualViewport?.scale !== 1
        || !(node instanceof HTMLElement) || node.getClientRects().length !== 1
        || (shape && shape !== 'none') || transformed(node, true, true)) return null
      const axes = { x: true, y: true, translationOutset: { x: 0, y: 0 } }
      const ancestors: Element[] = []
      for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
        ancestors.push(ancestor)
        const value = getComputedStyle(ancestor).translate
        if (value === 'none') continue
        const parts = value.split(' ')
        if (parts.length > 3 || parts.some(v => !/^-?\d+(?:\.\d+)?(?:px|%)$/.test(v))) return null
        const [x, y = 0, z = 0] = parts.map(parseFloat)
        if (z !== 0) return null
        // Serialization cannot prove an integer translation is exact. Keep
        // moved axes unknown until the bounded compositor path below proves them.
        if (x !== 0) axes.x = false
        if (y !== 0) axes.y = false
      }
      if (!axes.x || !axes.y) {
        // A DOMRect already contains the actual translation. Do not mistake
        // rounded CSS strings for exact pixel alignment. Instead, this limited
        // static path budgets every ancestor's possible ordinary render surface:
        // 1px enclosure/AA + 1px bilinear sampling, plus the final quad's 1px.
        const ordinarySurfaces = ancestors.every(ancestor => {
          if (!(ancestor instanceof HTMLElement) || ancestor.getAnimations().length) return false
          const current = getComputedStyle(ancestor), box = ancestor.getBoundingClientRect()
          if ([box.left, box.right, box.top, box.bottom].some(value => !Number.isFinite(value) || Math.abs(value) >= 2 ** 18)
            || current.filter !== 'none' || current.backdropFilter !== 'none' || current.maskImage !== 'none'
            || current.clipPath !== 'none' || current.clip !== 'auto' || current.willChange !== 'auto'
            || current.contain !== 'none' || current.containerType !== 'normal'
            || Number(current.opacity) !== 1 || current.mixBlendMode !== 'normal'
            || current.overflowX !== 'visible' || current.overflowY !== 'visible') return false
          const transitionName = current.getPropertyValue('view-transition-name')
          return transitionName === 'none' || (ancestor === document.documentElement && transitionName === 'root')
        })
        let transition = true
        try { transition = document.documentElement.matches(':active-view-transition') }
        catch { /* Unknown view-transition support keeps the axis unproved. */ }
        if (ordinarySurfaces && !transition) {
          const outset = 2 * ancestors.length + 1
          axes.translationOutset = { x: axes.x ? 0 : outset, y: axes.y ? 0 : outset }
          axes.x = true; axes.y = true
        }
      }
      return axes.x || axes.y ? axes : null
    }
    function casterSnapMargin(node: Element, axis: 'x' | 'y') {
      const start = axis === 'x' ? 'left' : 'top', end = axis === 'x' ? 'right' : 'bottom'
      // Below 2^18, binary32 retains Chromium's 1/64 LayoutUnit grid. Large
      // coordinates must not masquerade as aligned after float conversion.
      const aligned = (value: number) => Number.isSafeInteger(value) && Math.abs(value) < 2 ** 18
      if (!aligned(axis === 'x' ? scrollX : scrollY)
        || !aligned(node.getBoundingClientRect()[end])) return 1
      for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
        const boxes = ancestor.getClientRects()
        if (boxes.length !== 1 || !aligned(boxes[0]![start])
          || !aligned(axis === 'x' ? ancestor.scrollLeft : ancestor.scrollTop)) return 1
        if (getComputedStyle(ancestor).transform !== 'none') {
          const matrix = (ancestor as any).computedStyleMap().get('transform').toMatrix() as DOMMatrixReadOnly
          if (!aligned(axis === 'x' ? matrix.e : matrix.f)) return 1
        }
      }
      // On a proven axis all paint origins/scroll mappings and both caster
      // edges are on the DPR1 pixel grid, so caster snapping is the identity.
      // Shadow serialization bounds and the final raster floor/ceil remain.
      return 0
    }
    function onProvenAxes(bounds: Bounds, axes: { x: boolean, y: boolean }): Bounds {
      return { left: axes.x ? bounds.left : -Infinity, right: axes.x ? bounds.right : Infinity,
        top: axes.y ? bounds.top : -Infinity, bottom: axes.y ? bounds.bottom : Infinity }
    }
    function recordBounds(bounds: Bounds) {
      // JSON cannot represent Infinity; keep unknown axes explicit in evidence.
      return Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, Number.isFinite(value) ? value : String(value)]))
    }
    function supportedCompositePaint(node: Element, css: CSSStyleDeclaration) {
      // visibility:hidden does not hide a descendant that restores visibility.
      // A filter on that ancestor still applies to the descendant's paint.
      if (css.filter === 'none' && css.backdropFilter === 'none') return
      const clip = clipped({ left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity }, node, false)
      if (!overlapsText(clip)) return
      if (css.filter !== 'none') fail(`unmodeled expanded filter paint on ${node.tagName}`)
      // backdrop-filter's output is clipped to its border box, unlike filter's
      // projection of descendant paint. Keep the two effects independent.
      const axes = boundedPaintGeometry(node, css)
      if (!axes) fail(`unmodeled backdrop geometry on ${node.tagName}`)
      const box = node.getBoundingClientRect()
      const bounds = onProvenAxes({ left: Math.floor(box.left - 1), right: Math.ceil(box.right + 1),
        top: Math.floor(box.top - 1), bottom: Math.ceil(box.bottom + 1) }, axes!)
      if (overlapsText(clipped(bounds, node, false))) fail(`unmodeled overlapping backdrop paint on ${node.tagName}`)
      excludedPaint.push({ node: node.tagName, reason: 'outside backdrop-filter border-box clip', bounds: recordBounds(bounds) })
    }
    function supportedOverflowPaint(node: Element, css: CSSStyleDeclaration) {
      // These effects can escape a zero-size or distant border box. Check them
      // before excluding the host by geometry, while retaining proven ancestor
      // clips and the existing opaque stacking-context exclusion.
      const clip = clipped({ left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity }, node, false)
      if (!overlapsText(clip)) return
      const borderShape = css.getPropertyValue('border-shape')
      if (borderShape && borderShape !== 'none') fail(`unmodeled border shape paint on ${node.tagName}`)
      if (css.borderImageSource !== 'none') fail(`unmodeled expanded border image paint on ${node.tagName}`)
      if (css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0 && color(css.outlineColor)[3]! > 0) {
        const axes = boundedPaintGeometry(node, css)
        // This Blink revision bounds a non-auto outline of one ordinary box
        // by that box. Auto outlines may include descendant ink; inline or
        // fragmented outlines also need different geometry, so remain unknown.
        if (!axes || css.outlineStyle === 'auto'
          || !['block', 'inline-block', 'flow-root', 'flex', 'inline-flex', 'grid', 'inline-grid'].includes(css.display)
          || !/^-?[\d.]+px$/.test(css.outlineWidth) || !/^-?[\d.]+px$/.test(css.outlineOffset)) fail(`unmodeled outline paint on ${node.tagName}`)
        const width = parseFloat(css.outlineWidth), offset = parseFloat(css.outlineOffset)
        const unit = (value: number) => value === 0 ? 0 : 10 ** (Number(Math.abs(value).toExponential().split('e')[1]) - 5)
        // Negative offsets are clamped during painting; never use them to
        // reduce this outer bound. Keep serialization and caster-snap margins.
        const extent = width + unit(width) + Math.max(0, offset + unit(offset))
        const snapX = casterSnapMargin(node, 'x'), snapY = casterSnapMargin(node, 'y')
        const box = node.getBoundingClientRect()
        const bounds = onProvenAxes({ left: Math.floor(box.left - extent - snapX - axes!.translationOutset.x), right: Math.ceil(box.right + extent + snapX + axes!.translationOutset.x),
          top: Math.floor(box.top - extent - snapY - axes!.translationOutset.y), bottom: Math.ceil(box.bottom + extent + snapY + axes!.translationOutset.y) }, axes!)
        if (overlapsText(clipped(bounds, node, false))) fail(`unmodeled overlapping outline paint on ${node.tagName}`)
        excludedPaint.push({ node: node.tagName, reason: 'outside verified Chromium ordinary outline bounds',
          outline: { style: css.outlineStyle, width, offset, color: css.outlineColor }, snapMargin: { x: snapX, y: snapY }, translationOutset: axes!.translationOutset, bounds: recordBounds(bounds) })
      }
      for (const shadow of shadows(css.boxShadow)) {
        if (shadow.inset || shadow.alpha === 0) continue
        // An outer shadow is clipped out of its caster's border shape. Reuse
        // only the proven interior geometry (including rounded corners).
        if (coversText(node, css)) continue
        // This is the verified Blink ink-overflow bound, not a guessed Gaussian
        // cutoff. A browser upgrade or a different coordinate mapping requires
        // new proof; see README for the exact revision and source chain.
        const axes = boundedPaintGeometry(node, css)
        if (!axes) fail(`unmodeled outer shadow paint on ${node.tagName}`)
        const box = node.getBoundingClientRect()
        // Computed CSS uses %.6g. Expand by one full last-place unit before
        // reproducing Blink's float sigma=blur/2 and ceil(3*sigma) outset.
        const unit = (value: number) => value === 0 ? 0 : 10 ** (Number(Math.abs(value).toExponential().split('e')[1]) - 5)
        const blur = shadow.blur + unit(shadow.blur)
        const extent = Math.ceil(Math.fround(3 * Math.fround(Math.fround(blur) * 0.5)))
          + Math.max(0, shadow.spread + unit(shadow.spread))
        const xError = unit(shadow.x), yError = unit(shadow.y)
        // Retain a full pixel for uncertain caster snapping. Only explicitly
        // aligned axes may omit it; final raster bounds still round outward.
        const snapX = casterSnapMargin(node, 'x'), snapY = casterSnapMargin(node, 'y')
        const bounds = onProvenAxes({ left: Math.floor(box.left + shadow.x - xError - extent - snapX - axes!.translationOutset.x),
          right: Math.ceil(box.right + shadow.x + xError + extent + snapX + axes!.translationOutset.x),
          top: Math.floor(box.top + shadow.y - yError - extent - snapY - axes!.translationOutset.y),
          bottom: Math.ceil(box.bottom + shadow.y + yError + extent + snapY + axes!.translationOutset.y) }, axes!)
        if (overlapsText(clipped(bounds, node, false))) fail(`unmodeled overlapping outer shadow paint on ${node.tagName}`)
        excludedPaint.push({ node: node.tagName, reason: 'outside verified Chromium box-shadow bounds', shadow, snapMargin: { x: snapX, y: snapY }, translationOutset: axes!.translationOutset, bounds: recordBounds(bounds) })
      }
    }
    function supported(node: Element, computed: CSSStyleDeclaration) {
      if (computed.backgroundImage !== 'none' || computed.filter !== 'none' || computed.backdropFilter !== 'none'
        || computed.mixBlendMode !== 'normal' || computed.maskImage !== 'none') fail(`unsupported paint on ${node.tagName}`)
      for (const shadow of shadows(computed.boxShadow)) {
        if (!shadow.inset || shadow.alpha === 0) continue
        const box = node.getBoundingClientRect()
        const clearance = Math.min(textRect.left - box.left, box.right - textRect.right, textRect.top - box.top, box.bottom - textRect.bottom)
        if (shadow.x !== 0 || shadow.y !== 0 || shadow.blur !== 0 || shadow.spread < 0 || shadow.spread > clearance) fail('inset shadow may overlap text')
      }
    }

    function supportedPseudos(node: Element, allowItem = false, sibling = false) {
      const paints: any[] = []
      for (const pseudoName of ['::before', '::after']) {
        const ps = getComputedStyle(node, pseudoName)
        const background = color(ps.backgroundColor)
        if (ps.display === 'none' || ps.visibility !== 'visible' || Number(ps.opacity) === 0) continue
        if (ps.content === 'none' || ps.content === 'normal') continue
        const emptyContent = ps.content === '""' || ps.content === "''"
        const borderPaint = [ps.borderTopWidth, ps.borderRightWidth, ps.borderBottomWidth, ps.borderLeftWidth].some(value => parseFloat(value) > 0)
        if (emptyContent && !borderPaint && background[3] === 0 && ps.backgroundImage === 'none' && ps.boxShadow === 'none' && ps.filter === 'none' && ps.backdropFilter === 'none') continue
        const current = getComputedStyle(node)
        // A pseudo has no DOM rect. Only a bounded absolute box in this
        // positioned host permits geometric exclusion; zero-sized/static
        // hosts cannot prove that their generated paint stays out of the text.
        if (sibling && emptyContent && node.scrollLeft === 0 && node.scrollTop === 0
          && !transformed(node, true) && current.position === 'relative' && current.display !== 'contents'
          && ps.position === 'absolute' && ps.transform === 'none' && ps.translate === 'none'
          && ps.rotate === 'none' && ps.scale === 'none' && ps.boxShadow === 'none' && ps.filter === 'none' && ps.backdropFilter === 'none') {
          const lengths = [ps.left, ps.top, ps.width, ps.height, ps.marginLeft, ps.marginTop]
          if (lengths.every(value => /^-?\d+(?:\.\d+)?px$/.test(value))) {
            const [left, top, width, height, marginLeft, marginTop] = lengths.map(parseFloat)
            const box = node.getBoundingClientRect()
            const x = box.left + parseFloat(current.borderLeftWidth) + left! + marginLeft!
            const y = box.top + parseFloat(current.borderTopWidth) + top! + marginTop!
            const extraX = ps.boxSizing === 'border-box' ? 0 : parseFloat(ps.paddingLeft) + parseFloat(ps.paddingRight) + parseFloat(ps.borderLeftWidth) + parseFloat(ps.borderRightWidth)
            const extraY = ps.boxSizing === 'border-box' ? 0 : parseFloat(ps.paddingTop) + parseFloat(ps.paddingBottom) + parseFloat(ps.borderTopWidth) + parseFloat(ps.borderBottomWidth)
            if (!overlapsText({ left: x, top: y, right: x + width! + extraX, bottom: y + height! + extraY })) continue
          }
        }
        if (!allowItem || pseudoName !== '::before' || node.getAttribute('data-slot') !== 'item'
          || !['option', 'menuitem'].includes(node.getAttribute('role') || '')
          || ps.position !== 'absolute' || ps.zIndex !== '-1' || current.position !== 'relative'
          || current.zIndex !== 'auto' || color(current.backgroundColor)[3] !== 0
          || !emptyContent || borderPaint || ps.backgroundImage !== 'none' || ps.boxShadow !== 'none' || ps.filter !== 'none' || ps.backdropFilter !== 'none') fail(`unmodeled ${pseudoName} on ${node.tagName}${node.id ? '#' + node.id : ''}`)
        const insets = [ps.left, ps.right, ps.top, ps.bottom]
        if (insets.some(v => !/^\d+(?:\.\d+)?px$/.test(v))) fail('unresolved item pseudo geometry')
        const [left, right, top, bottom] = insets.map(parseFloat)
        const box = node.getBoundingClientRect()
        if (box.left + left! > textRect.left || box.right - right! < textRect.right || box.top + top! > textRect.top || box.bottom - bottom! < textRect.bottom) fail('partial item pseudo coverage')
        // Negative z-index belongs to the nearest stacking context. Ensure no
        // intervening painted surface could cover this known item underlay.
        let stackingRoot = node.parentElement
        while (stackingRoot) {
          const ancestor = getComputedStyle(stackingRoot)
          if (ancestor.isolation === 'isolate' || ancestor.transform !== 'none'
            || (ancestor.position !== 'static' && ancestor.zIndex !== 'auto')) break
          if (color(ancestor.backgroundColor)[3] !== 0 || Number(ancestor.opacity) !== 1) fail('item pseudo stacking unresolved')
          stackingRoot = stackingRoot.parentElement
        }
        if (!stackingRoot) fail('item pseudo has no verified stacking context')
        background[3] *= Number(ps.opacity)
        paints.push({ kind: 'item-before', background, raw: ps.backgroundColor, opacity: Number(ps.opacity), insets, stackingRoot: stackingRoot!.getAttribute('data-slot') || stackingRoot!.tagName })
      }
      return paints
    }
    const chain: { node: string, background: number[], rawBackground: string, opacity: number, underlays: any[] }[] = []
    const own = getComputedStyle(target)
    if (style.textShadow !== 'none') fail('text shadow')
    const foreground = color(style.color)
    if (pseudo) foreground[3] *= Number(style.opacity)
    let branch: Element | null = null
    const layers: any[] = []
    let opaqueSurface: Element | null = null
    const excludedPaint: any[] = []
    const overlapsText = (box: { left: number, right: number, top: number, bottom: number }) =>
      box.left < box.right && box.top < box.bottom && box.left < textRect.right && box.right > textRect.left && box.top < textRect.bottom && box.bottom > textRect.top

    // Only use a bounded, provable part of CSS painting order. A positioned
    // stacking context is atomic: descendants cannot escape its stack level.
    // DOM order alone says nothing about a sibling with a higher z-index.
    function positionedContext(leaf: Element, ancestor: Element) {
      const path: Element[] = []
      for (let node: Element | null = leaf; node && node !== ancestor; node = node.parentElement) path.unshift(node)
      for (const node of path) {
        const css = getComputedStyle(node)
        if (css.display === 'contents') continue // no box: inspect the actual descendant contexts
        const positioned = css.position !== 'static'
        if (positioned && (css.zIndex !== 'auto' || css.position === 'fixed' || css.position === 'sticky')) {
          const level = css.zIndex === 'auto' ? 0 : Number(css.zIndex)
          return Number.isInteger(level) ? { node, level } : null
        }
        if (css.isolation === 'isolate' && css.zIndex === 'auto') return { node, level: 0 }
        // These may establish a different atomic context. Do not flatten it
        // or let a nested positioned descendant masquerade as an outer one.
        const parentDisplay = node.parentElement ? getComputedStyle(node.parentElement).display : ''
        if (Number(css.opacity) !== 1 || css.transform !== 'none' || css.translate !== 'none'
          || css.rotate !== 'none' || css.scale !== 'none' || css.perspective !== 'none'
          || css.filter !== 'none' || css.backdropFilter !== 'none' || css.isolation === 'isolate'
          || css.mixBlendMode !== 'normal' || css.clipPath !== 'none' || css.maskImage !== 'none'
          || css.contain !== 'none' || css.containerType !== 'normal' || css.willChange !== 'auto'
          || (css.zIndex !== 'auto' && /flex|grid/.test(parentDisplay))) return null
      }
      return { node: null, level: 0 }
    }
    function behindOpaqueBranch(paintNode: Element, ancestor: Element) {
      if (!opaqueSurface) return false
      const content = positionedContext(target, ancestor)
      const other = positionedContext(paintNode, ancestor)
      if (!content?.node || !other || !content.node.contains(opaqueSurface)) return false
      const below = content.level > 0 && other.level < content.level
      const earlierPeer = other.node && content.level === other.level
        && (other.node.compareDocumentPosition(content.node) & Node.DOCUMENT_POSITION_FOLLOWING)
      if (!below && !earlierPeer) return false
      excludedPaint.push({ node: paintNode.tagName, reason: 'behind opaque positioned stacking context', contentLevel: content.level, otherLevel: other.level })
      return true
    }
    function coversText(node: Element, css: CSSStyleDeclaration) {
      const borderShape = css.getPropertyValue('border-shape')
      if (borderShape && borderShape !== 'none') return false
      if (node.getClientRects().length !== 1 || transformed(node, true)) return false
      if (css.backgroundClip !== 'border-box' || css.clipPath !== 'none' || css.clip !== 'auto') return false
      const box = node.getBoundingClientRect()
      if (box.left > textRect.left || box.right < textRect.right || box.top > textRect.top || box.bottom < textRect.bottom) return false
      // Do not treat the transparent corners of a rounded box as opaque.
      // Reject the whole corner rectangle instead of approximating an ellipse.
      for (const [radius, left, top] of [
        [css.borderTopLeftRadius, true, true], [css.borderTopRightRadius, false, true],
        [css.borderBottomLeftRadius, true, false], [css.borderBottomRightRadius, false, false],
      ] as const) {
        const values = radius.split(' ')
        const length = (value: string, axis: number) => /^\d+(?:\.\d+)?px$/.test(value) ? parseFloat(value)
          : /^\d+(?:\.\d+)?%$/.test(value) ? parseFloat(value) * axis / 100 : NaN
        const x = length(values[0]!, box.width)
        const y = length(values[1] || values[0]!, box.height)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false
        if ((left ? textRect.left < box.left + x : textRect.right > box.right - x)
          && (top ? textRect.top < box.top + y : textRect.bottom > box.bottom - y)) return false
      }
      return true
    }
    function* renderedSubtree(node: Element): Generator<Element> {
      const css = getComputedStyle(node)
      if (css.display === 'none' || (css.display !== 'contents' && Number(css.opacity) === 0)) return
      yield node
      // Transparent, zero-sized, non-overlapping, or visibility:hidden wrappers
      // do not prove their descendants harmless (overflow/visibility may differ).
      for (const child of node.children) yield* renderedSubtree(child)
    }
    try {
      // Native top-layer content/backdrops escape ordinary ancestor stacking
      // and clipping. Our portal model does not prove their paint ordering.
      if (document.querySelector(':modal, :popover-open')) fail('unmodeled top-layer paint')
      for (let node: Element | null = target; node; branch = node, node = node.parentElement) {
        const current = getComputedStyle(node)
        supported(node, current)
        if (current.display === 'none') fail('display:none ancestor')
        const underlays = supportedPseudos(node, true)
        if (branch) for (const siblingRoot of node.children) {
          if (siblingRoot === branch || siblingRoot === probe) continue
          for (const sibling of renderedSubtree(siblingRoot)) {
            const siblingStyle = getComputedStyle(sibling)
            const box = sibling.getBoundingClientRect()
            if (behindOpaqueBranch(sibling, node)) continue
            supportedPseudos(sibling, false, true)
            supportedCompositePaint(sibling, siblingStyle)
            if (siblingStyle.display === 'contents' || siblingStyle.visibility !== 'visible' || Number(siblingStyle.opacity) === 0) continue
            supportedOverflowPaint(sibling, siblingStyle)
            if (!box.width || !box.height || !overlapsText(clipped(box, sibling, false))) continue
            supported(sibling, siblingStyle)
            supportedBorder(sibling, siblingStyle)
            const background = color(siblingStyle.backgroundColor)
            const painted = background[3] > 0 || siblingStyle.backgroundImage !== 'none'
            // A transparent element can still paint text or replaced content.
            // Such overlap has no modeled composition and must not pass silently.
            if (sibling instanceof SVGElement || /^(IMG|VIDEO|CANVAS|IFRAME)$/.test(sibling.tagName)) fail(`unmodeled overlapping content ${sibling.tagName}`)
            for (const child of sibling.childNodes) {
              if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue
              const range = document.createRange()
              range.selectNode(child)
              if (Array.from(range.getClientRects()).some(box => overlapsText(clipped(box, sibling)))) fail(`unmodeled overlapping text ${sibling.tagName}`)
            }
            if (!painted) continue
            const isIndicator = sibling.getAttribute('data-slot') === 'indicator' && target.closest('[role="tab"]')
            const isArrival = sibling.hasAttribute('data-field-arrival-cue')
            if (!isIndicator && !isArrival) fail(`unmodeled overlapping sibling ${sibling.tagName}.${sibling.className}`)
            // Both accepted layers precede the positioned content in DOM paint
            // order. Reject a changed stacking contract instead of guessing.
            if (sibling !== siblingRoot || !(sibling.compareDocumentPosition(branch) & Node.DOCUMENT_POSITION_FOLLOWING)
              || siblingStyle.zIndex !== 'auto' || getComputedStyle(branch).zIndex !== 'auto'
              || getComputedStyle(branch).position === 'static') fail('unverified sibling stacking order')
            if (box.left > rect.left + 1 || box.right < rect.right - 1 || box.top > rect.top + 1 || box.bottom < rect.bottom - 1) fail('partial sibling coverage')
            background[3] *= Number(siblingStyle.opacity)
            underlays.push({ kind: isIndicator ? 'tabs-indicator' : 'arrival-cue', background, raw: siblingStyle.backgroundColor, opacity: Number(siblingStyle.opacity), box: box.toJSON() })
          }
        }
        if (Number(current.opacity) !== 1) opaqueSurface = null
        else if (!opaqueSurface && color(current.backgroundColor)[3] === 1 && coversText(node, current)) opaqueSurface = node
        chain.push({ node: node.tagName + (node.id ? `#${node.id}` : ''), background: color(current.backgroundColor), rawBackground: current.backgroundColor, opacity: Number(current.opacity), underlays })
      }
      layers.push(...chain)
      return { text, textBounds: { raw: { left: rawTextRect.left, right: rawTextRect.right, top: rawTextRect.top, bottom: rawTextRect.bottom }, used: textRect, glyph: glyphBounds }, rawForeground: style.color, foreground, layers, excludedPaint, engine, rect: rect.toJSON(), pseudo, fontFamily: style.fontFamily, fontSize: style.fontSize, ownOpacity: own.opacity }
    }
    finally { probe.remove() }
  }, { pseudo, engine })
  let background = [0, 0, 0, 0]
  let foreground = paint.foreground
  for (const layer of paint.layers) {
    let surface = layer.background
    for (const underlay of layer.underlays) surface = composite(underlay.background, surface)
    background = composite(background, surface)
    foreground = composite(foreground, surface)
    background[3] *= layer.opacity
    foreground[3] *= layer.opacity
  }
  if (background[3] !== 1 || foreground[3] !== 1) throw new Error('unresolved: no opaque canvas in the actual ancestor chain')
  return { ...paint, effectiveForeground: foreground, effectiveBackground: background, ratio: contrastRatio(foreground, background) }
}
