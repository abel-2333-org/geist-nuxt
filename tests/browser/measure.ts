import type { Browser, JSHandle, Locator } from 'playwright-core'
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

type GeneratedText = {
  path: number[], tag: string, pseudo: string, text: string, hostBounds: number[], bounds: number[],
  styles: Record<string, string>, backendNodeId: number, platformFonts: unknown,
}
type PlainText = {
  path: number[], tag: string, original: string, rendered: string, styles: Record<string, string>,
  fragments: Array<{ start: number, length: number, bounds: number[] }>,
  platformFonts: { fonts: Array<{ familyName: string, isCustomFont: boolean, glyphCount: number }> },
}
const generatedStyleNames = ['content', 'display', 'visibility', 'position', 'color', 'opacity', 'font-family', 'font-size', 'font-weight',
  'font-style', 'font-stretch', 'font-variant', 'font-feature-settings', 'font-variation-settings', 'font-size-adjust',
  'line-height', 'letter-spacing', 'word-spacing', 'text-transform', 'writing-mode', 'direction', 'vertical-align',
  'margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
  'text-shadow', '-webkit-text-stroke-width', '-webkit-text-fill-color', '-webkit-text-security', 'text-decoration-line', 'text-emphasis-style',
  '-webkit-locale', 'font-language-override', 'background-color', 'background-image', 'box-shadow', 'outline-style', 'outline-width', 'outline-color',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'transform', 'translate', 'rotate', 'scale', 'filter', 'backdrop-filter', 'mask-image', 'mix-blend-mode']
const textStyleNames = [...new Set([...generatedStyleNames, 'font-optical-sizing', 'font-kerning', 'text-rendering',
  'white-space', 'text-align', 'text-align-last', 'text-indent', 'text-justify', 'word-break', 'overflow-wrap', 'hyphens',
  'text-wrap-style', 'text-spacing-trim', 'text-autospace', 'unicode-bidi', 'text-combine-upright',
  'dominant-baseline', 'text-fit', 'text-box-trim', 'text-box-edge'])]

type GeneratedGuard = { check(): { domMutations: number, events: number, geometryMatches: boolean }, stop(): void }

async function generatedTextLayout(locator: Locator) {
  const page = locator.page()
  const cdp = await page.context().newCDPSession(page)
  let guard: JSHandle<GeneratedGuard> | null = null
  const changes: string[] = []
  const close = async () => {
    try { if (guard) { await guard.evaluate(value => value.stop()); await guard.dispose() } }
    finally { await cdp.detach() }
  }
  try {
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    await cdp.send('DOM.getDocument')
    // Keep these events alive through the final synchronous paint read. CDP's
    // stylesheet notifications include CSSOM writes, even when reverted before
    // the final computed-style read; FontFace updates have a separate event.
    for (const name of ['CSS.styleSheetAdded', 'CSS.styleSheetRemoved', 'CSS.styleSheetChanged', 'CSS.fontsUpdated', 'DOM.documentUpdated'] as const) {
      cdp.on(name, () => changes.push(name))
    }
    guard = await page.evaluateHandle(() => {
      let domMutations = 0, events = 0
      const observer = new MutationObserver(records => { domMutations += records.length })
      observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true })
      const changed = () => { events++ }
      const registrations: Array<[EventTarget, string]> = [
        [document, 'scroll'], [window, 'scroll'], [window, 'resize'],
        [document.fonts, 'loading'], [document.fonts, 'loadingdone'], [document.fonts, 'loadingerror'],
        [document, 'load'], [document, 'error'], [document, 'transitionrun'], [document, 'animationstart'],
      ]
      if (visualViewport) registrations.push([visualViewport, 'scroll'], [visualViewport, 'resize'])
      for (const [target, name] of registrations) target.addEventListener(name, changed, true)
      const ambient = () => JSON.stringify({
        viewport: [innerWidth, innerHeight, scrollX, scrollY, devicePixelRatio, visualViewport?.scale, visualViewport?.offsetLeft, visualViewport?.offsetTop],
        fonts: Array.from(document.fonts, font => [font.family, font.style, font.weight, font.stretch, font.status, font.unicodeRange,
          font.featureSettings, (font as FontFace & { variationSettings?: string }).variationSettings, font.ascentOverride, font.descentOverride, font.lineGapOverride]),
        elements: Array.from(document.querySelectorAll('*'), node => [node.scrollLeft, node.scrollTop,
          Array.from(node.getClientRects(), rect => [rect.x, rect.y, rect.width, rect.height]),
          node instanceof HTMLImageElement ? [node.complete, node.naturalWidth, node.naturalHeight] : null]),
      })
      const baseline = ambient()
      return {
        check() {
          domMutations += observer.takeRecords().length
          return { domMutations, events, geometryMatches: baseline === ambient() }
        },
        stop() {
          observer.disconnect()
          for (const [target, name] of registrations) target.removeEventListener(name, changed, true)
        },
      }
    })
    const plainPaths = await locator.evaluate(target => {
      if (target.childNodes.length !== 1 || target.firstChild?.nodeType !== Node.TEXT_NODE) return []
      return [target, ...Array.from(target.parentElement?.children || [])].filter(node => node.childNodes.length === 1
        && node.firstChild?.nodeType === Node.TEXT_NODE).map(node => {
        const path: number[] = []
        for (let current = node; current.parentElement; current = current.parentElement) path.unshift(Array.from(current.parentElement.children).indexOf(current))
        return JSON.stringify(path)
      })
    })
    const snapshot = await cdp.send('DOMSnapshot.captureSnapshot', { computedStyles: textStyleNames })
    if (snapshot.documents.length !== 1) throw new Error('unresolved: generated text in a multi-document snapshot')
    const snapshotDocument = snapshot.documents[0]!, { nodes, layout, textBoxes } = snapshotDocument
    const value = (index: number) => snapshot.strings[index] || ''
    const pseudoNodes = new Set(nodes.pseudoType?.index || [])
    const path = (index: number): number[] => {
      const parent = nodes.parentIndex![index]!
      if (parent < 0 || nodes.nodeType![parent] === 9) return []
      const siblings = nodes.parentIndex!.flatMap((owner, candidate) => owner === parent
        && nodes.nodeType![candidate] === 1 && !pseudoNodes.has(candidate) ? [candidate] : [])
      return [...path(parent), siblings.indexOf(index)]
    }
    const viewport = (box: number[]) => [box[0]! - snapshotDocument.scrollOffsetX!, box[1]! - snapshotDocument.scrollOffsetY!, box[2]!, box[3]!]
    const result: GeneratedText[] = []
    for (const [offset, nodeIndex] of (nodes.pseudoType?.index || []).entries()) {
      const pseudo = '::' + value(nodes.pseudoType!.value[offset]!)
      const hostIndex = nodes.parentIndex![nodeIndex]!
      const boxes = textBoxes.layoutIndex.flatMap((layoutIndex, boxIndex) => layout.nodeIndex[layoutIndex] === nodeIndex
        ? [{ layoutIndex, boxIndex }] : [])
      const hostLayouts = layout.nodeIndex.flatMap((index, candidate) => index === hostIndex ? [candidate] : [])
      // No surrogate range, multi-fragment union, or inferred text is accepted.
      if (boxes.length !== 1 || hostLayouts.length !== 1) continue
      const { layoutIndex, boxIndex } = boxes[0]!
      const text = value(layout.text[layoutIndex]!)
      if (text !== '*' || textBoxes.start[boxIndex] !== 0 || textBoxes.length[boxIndex] !== 1) continue
      const backendNodeId = nodes.backendNodeId![nodeIndex]!
      const pushed = await cdp.send('DOM.pushNodesByBackendIdsToFrontend', { backendNodeIds: [backendNodeId] })
      const platformFonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: pushed.nodeIds[0]! })
      result.push({ path: path(hostIndex), tag: value(nodes.nodeName![hostIndex]!), pseudo, text,
        hostBounds: viewport(layout.bounds[hostLayouts[0]!]!), bounds: viewport(textBoxes.bounds[boxIndex]!),
        styles: Object.fromEntries(generatedStyleNames.map((name, index) => [name, value(layout.styles[layoutIndex]![index]!)])),
        backendNodeId, platformFonts })
    }
    const plain: PlainText[] = []
    for (const [layoutIndex, nodeIndex] of layout.nodeIndex.entries()) {
      if (nodes.nodeType![nodeIndex] !== 3) continue
      const hostIndex = nodes.parentIndex![nodeIndex]!, hostPath = path(hostIndex)
      if (!plainPaths.includes(JSON.stringify(hostPath))) continue
      const hostLayout = layout.nodeIndex.indexOf(hostIndex)
      if (hostLayout < 0) continue
      const pushed = await cdp.send('DOM.pushNodesByBackendIdsToFrontend', { backendNodeIds: [nodes.backendNodeId![hostIndex]!] })
      plain.push({ path: hostPath, tag: value(nodes.nodeName![hostIndex]!), original: value(nodes.nodeValue![nodeIndex]!),
        rendered: value(layout.text[layoutIndex]!),
        styles: Object.fromEntries(textStyleNames.map((name, index) => [name, value(layout.styles[hostLayout]![index]!)])),
        fragments: textBoxes.layoutIndex.flatMap((owner, index) => owner === layoutIndex
          ? [{ start: textBoxes.start[index]!, length: textBoxes.length[index]!, bounds: viewport(textBoxes.bounds[index]!) }] : []),
        platformFonts: await cdp.send('CSS.getPlatformFontsForNode', { nodeId: pushed.nodeIds[0]! }) })
    }
    return {
      generated: result,
      plain,
      guard,
      async verify() {
        // This also drains the CDP event stream through another renderer read.
        // Equality is supplementary; the epochs above reject change-and-revert.
        const after = await cdp.send('DOMSnapshot.captureSnapshot', { computedStyles: textStyleNames })
        if (changes.length) throw new Error(`unresolved: generated snapshot changed during measurement (${[...new Set(changes)].join(', ')})`)
        if (JSON.stringify(snapshot) !== JSON.stringify(after)) throw new Error('unresolved: generated snapshot changed during measurement (snapshot payload differs)')
        return { cssOrFontEvents: changes.length, snapshotsMatch: true }
      },
      close,
    }
  }
  catch (error) { await close(); throw error }
}

export async function measure(locator: Locator, pseudo: '::placeholder' | '::after' | null = null) {
  const engine = await paintEngine(locator)
  const evaluate = (generated: GeneratedText[] | null, guard: JSHandle<GeneratedGuard> | null = null, plain: PlainText[] | null = null) => locator.evaluate((element, { pseudo, engine, generated, guard, plain }) => {
    const consistency = guard?.check() || null
    // No page task can interleave with the synchronous measurement below.
    // Disconnect before our own temporary color parser mutates the DOM.
    guard?.stop()
    if (consistency && (consistency.domMutations || consistency.events || !consistency.geometryMatches)) throw new Error(`unresolved: generated snapshot changed before measurement (${JSON.stringify(consistency)})`)
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
        if (css.offsetPath !== 'none' || css.rotate !== 'none' || css.scale !== 'none' || css.perspective !== 'none' || css.transformStyle !== 'flat') return true
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
    const fail = (reason: string): never => { throw new Error(`unresolved: ${reason}`) }
    function canvasLanguage(context: CanvasRenderingContext2D, node: Element, css: CSSStyleDeclaration) {
      const language = node.closest('[lang]')?.getAttribute('lang') || ''
      const localized = context as CanvasRenderingContext2D & { lang?: string }
      if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language) || typeof localized.lang !== 'string'
        || css.getPropertyValue('-webkit-locale') !== `"${language}"`) return null
      localized.lang = language
      return localized.lang === language ? language : null
    }
    function generatedProof(node: Element, name: string) {
      if (!engine.boundedShadow || devicePixelRatio !== 1 || visualViewport?.scale !== 1) fail('generated text engine or viewport is unverified')
      if (generated === null) fail('generated text requires CDP layout')
      const path: number[] = []
      for (let current = node; current.parentElement; current = current.parentElement) path.unshift(Array.from(current.parentElement.children).indexOf(current))
      const proof = generated!.find(item => item.pseudo === name && item.tag === node.tagName && JSON.stringify(item.path) === JSON.stringify(path))
      if (!proof) fail('generated text has no single CDP text box')
      const ps = getComputedStyle(node, name), box = node.getBoundingClientRect()
      if (Object.entries(proof!.styles).some(([key, value]) => ps.getPropertyValue(key) !== value)
        || [box.x, box.y, box.width, box.height].some((value, index) => value !== proof!.hostBounds[index])
        || document.getAnimations().some(animation => animation.playState === 'running' || animation.pending)
        || document.fonts.status !== 'loaded') fail('generated text layout is not stable')
      // The text box is an actual generated asterisk, never its label's Range.
      // Keep a 1px raster allowance and only ordinary inline text with no paint
      // escaping that box. F-03 outline rejection still happens independently.
      if (ps.content !== '"*"' || ps.display !== 'inline' || ps.position !== 'static'
        || ps.visibility !== 'visible' || Number(ps.opacity) <= 0
        || ps.fontStyle !== 'normal' || ps.writingMode !== 'horizontal-tb' || ps.direction !== 'ltr'
        || ps.textShadow !== 'none' || ps.webkitTextStrokeWidth !== '0px' || ps.textDecorationLine !== 'none'
        || ps.webkitTextFillColor !== ps.color || ps.getPropertyValue('-webkit-text-security') !== 'none'
        || ps.textEmphasisStyle !== 'none' || ps.backgroundImage !== 'none' || ps.boxShadow !== 'none'
        || ps.filter !== 'none' || ps.backdropFilter !== 'none' || ps.maskImage !== 'none' || ps.mixBlendMode !== 'normal'
        || ps.transform !== 'none' || ps.translate !== 'none' || ps.rotate !== 'none' || ps.scale !== 'none'
        || ps.textTransform !== 'none' || ps.fontFeatureSettings !== 'normal' || ps.fontVariationSettings !== 'normal'
        || ps.fontVariant !== 'normal' || ps.fontStretch !== '100%' || ps.fontSizeAdjust !== 'none'
        || ps.fontOpticalSizing !== 'auto' || ps.getPropertyValue('font-language-override') !== 'normal'
        || ps.fontKerning !== 'auto' || ps.textRendering !== 'auto' || ps.letterSpacing !== 'normal'
        || !['normal', '0px'].includes(ps.wordSpacing) || ps.textCombineUpright !== 'none'
        || ps.backgroundColor !== 'rgba(0, 0, 0, 0)'
        || [ps.borderTopWidth, ps.borderRightWidth, ps.borderBottomWidth, ps.borderLeftWidth].some(width => parseFloat(width) !== 0)
        || transformed(node)) fail('unsupported generated text paint')
      for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
        const css = getComputedStyle(ancestor)
        if (ancestor.hasAttribute('xml:lang') || css.getPropertyValue('font-language-override') !== 'normal'
          || css.translate !== 'none' || css.textDecorationLine !== 'none' || css.textEmphasisStyle !== 'none'
          || css.webkitTextStrokeWidth !== '0px' || css.textShadow !== 'none') fail('unsupported generated text ancestor')
        for (const name of ['::first-line', '::first-letter']) {
          const first = getComputedStyle(ancestor, name)
          if (['font-family', 'font-size', 'font-style', 'font-weight', 'font-feature-settings', 'font-variation-settings', 'text-shadow', '-webkit-text-stroke-width']
            .some(key => first.getPropertyValue(key) !== css.getPropertyValue(key))) fail('unsupported generated first-line or first-letter')
        }
      }
      const [x, y, width, height] = proof!.bounds
      if (![x, y, width, height].every(value => Number.isFinite(value) && Math.abs(value!) < 2 ** 18) || width! <= 0 || height! <= 0) fail('invalid generated text bounds')
      const canvas = document.createElement('canvas').getContext('2d')
      if (!canvas) fail('generated text metrics unavailable')
      const language = canvasLanguage(canvas!, node, ps)
      if (!language) fail('generated text language is unverified')
      canvas!.font = `${ps.fontWeight} ${ps.fontSize} ${ps.fontFamily}`
      canvas!.direction = 'ltr'; canvas!.textBaseline = 'alphabetic'
      const metric = canvas!.measureText('*')
      const metrics = { width: metric.width, fontAscent: metric.fontBoundingBoxAscent, fontDescent: metric.fontBoundingBoxDescent,
        left: metric.actualBoundingBoxLeft, right: metric.actualBoundingBoxRight,
        ascent: metric.actualBoundingBoxAscent, descent: metric.actualBoundingBoxDescent }
      if (!Object.values(metrics).every(Number.isFinite) || Math.abs(metrics.width - width!) > 1 / 64
        || Math.abs(metrics.fontAscent + metrics.fontDescent - height!) > 1) fail('generated text DOM and Canvas metrics differ')
      // Retain the whole CDP range; widen it if ink overhangs its advance/font
      // box. The verified Blink baseline differs by at most 0.5px; add 1px
      // raster allowance as in the existing singleGlyphTop proof.
      return { ...proof!, language, metrics, box: {
        left: Math.floor(Math.min(x!, x! - metrics.left) - 1),
        right: Math.ceil(Math.max(x! + width!, x! + metrics.right) + 1),
        top: Math.floor(Math.min(y!, y! + metrics.fontAscent - metrics.ascent - 0.5) - 1),
        bottom: Math.ceil(Math.max(y! + height!, y! + metrics.fontAscent + metrics.descent + 0.5) + 1),
      } }
    }
    const generatedTarget = pseudo === '::after' ? generatedProof(target, pseudo) : null
    const rawTextRect = generatedTarget?.box || (input ? {
      left: rect.left + parseFloat(host.borderLeftWidth) + parseFloat(host.paddingLeft),
      right: rect.right - parseFloat(host.borderRightWidth) - parseFloat(host.paddingRight),
      top: rect.top + parseFloat(host.borderTopWidth) + parseFloat(host.paddingTop),
      bottom: rect.bottom - parseFloat(host.borderBottomWidth) - parseFloat(host.paddingBottom),
    } : range.getBoundingClientRect())
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
        const language = canvasLanguage(context, target, host)
        if (!language) return null
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
    const text = generatedTarget?.text || (pseudo === '::placeholder' ? (target as HTMLInputElement).placeholder : ((target as HTMLInputElement).value || target.textContent?.trim()))
    if (!text || !rect.width || !rect.height || textRect.right <= textRect.left || textRect.bottom <= textRect.top || getComputedStyle(target).visibility !== 'visible') fail('empty or hidden target')
    if (pseudo === '::placeholder' && (target as HTMLInputElement).value) fail('placeholder is not visible')
    const probe = document.createElement('span')
    probe.style.position = 'fixed'
    probe.style.visibility = 'hidden'
    // This hidden parser must not interpolate its successive input colors.
    // In particular, reduced-motion CSS can assign a nonzero global duration.
    probe.style.transitionProperty = 'none'
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
            || current.offsetPath !== 'none' || current.getPropertyValue('-webkit-box-reflect') !== 'none'
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
      const reflection = css.getPropertyValue('-webkit-box-reflect')
      if (reflection && reflection !== 'none') fail(`unmodeled reflection paint on ${node.tagName}`)
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
        // A pseudo's outline is independent of its host and can escape its
        // box. Check it before either empty-paint or separated-box exclusion;
        // auto focus rings do not share ordinary zero-width/color guarantees.
        if (ps.outlineStyle === 'auto' || (ps.outlineStyle !== 'none'
          && ps.outlineWidth !== '0px' && color(ps.outlineColor)[3] !== 0)) fail(`unmodeled ${pseudoName} outline on ${node.tagName}${node.id ? '#' + node.id : ''}`)
        const emptyContent = ps.content === '""' || ps.content === "''"
        const borderPaint = [ps.borderTopWidth, ps.borderRightWidth, ps.borderBottomWidth, ps.borderLeftWidth].some(value => parseFloat(value) > 0)
        if (emptyContent && !borderPaint && background[3] === 0 && ps.backgroundImage === 'none' && ps.boxShadow === 'none' && ps.filter === 'none' && ps.backdropFilter === 'none') continue
        if (!emptyContent && ps.content === '"*"') {
          const proof = generatedProof(node, pseudoName)
          if (node === target && pseudo === pseudoName) continue
          if (overlapsText(clipped(proof.box, node))) fail(`overlapping generated text ${pseudoName}`)
          excludedPaint.push({ node: node.tagName, reason: 'outside verified CDP generated text bounds', ...proof })
          continue
        }
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

    function plainTextInk(node: Element) {
      // This is only an exclusion proof for ordinary sibling text. Background,
      // border, pseudo, shadow and outline checks keep the original union.
      if (!engine.boundedShadow || devicePixelRatio !== 1 || visualViewport?.scale !== 1 || document.fonts.status !== 'loaded'
        || document.getAnimations().some(animation => animation.playState === 'running' || animation.pending)
        || node.childNodes.length !== 1 || node.firstChild?.nodeType !== Node.TEXT_NODE || transformed(node)) return null
      const css = getComputedStyle(node), original = node.firstChild.textContent || ''
      if (!/^[!-~]+(?: [!-~]+)*$/.test(original) || original.length > 256 || css.display !== 'inline' || css.position !== 'static'
        || css.visibility !== 'visible' || css.writingMode !== 'horizontal-tb' || css.direction !== 'ltr' || css.unicodeBidi !== 'normal'
        || css.fontStyle !== 'normal' || css.fontVariant !== 'normal' || css.fontFeatureSettings !== 'normal'
        || css.fontVariationSettings !== 'normal' || css.fontStretch !== '100%' || css.fontSizeAdjust !== 'none'
        || css.fontOpticalSizing !== 'auto' || css.fontKerning !== 'auto' || css.textRendering !== 'auto'
        || !['normal', '0px'].includes(css.wordSpacing) || !['none', 'uppercase'].includes(css.textTransform)
        || css.whiteSpace !== 'normal' || css.textCombineUpright !== 'none' || css.verticalAlign !== 'baseline'
        || !['start', 'left'].includes(css.textAlign) || css.textAlignLast !== 'auto' || css.textIndent !== '0px'
        || css.getPropertyValue('text-justify') !== 'auto' || css.wordBreak !== 'normal' || css.overflowWrap !== 'normal'
        || css.hyphens !== 'manual' || css.getPropertyValue('text-wrap-style') !== 'auto'
        || css.getPropertyValue('text-spacing-trim') !== 'normal' || css.getPropertyValue('text-autospace') !== 'no-autospace'
        || css.textShadow !== 'none' || css.webkitTextStrokeWidth !== '0px' || css.textDecorationLine !== 'none'
        || css.webkitTextFillColor !== css.color || css.getPropertyValue('-webkit-text-security') !== 'none'
        || css.textEmphasisStyle !== 'none') return null
      const typography = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant',
        'font-feature-settings', 'font-variation-settings', 'font-size-adjust', 'font-optical-sizing', 'font-language-override',
        'font-kerning', 'text-rendering', 'letter-spacing', 'word-spacing', 'text-transform', 'text-shadow',
        '-webkit-text-stroke-width', '-webkit-text-fill-color', 'text-decoration-line', 'text-emphasis-style', '-webkit-locale']
      for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
        const current = getComputedStyle(ancestor)
        if (ancestor.hasAttribute('xml:lang') || current.getPropertyValue('font-language-override') !== 'normal'
          || current.translate !== 'none' || current.textShadow !== 'none' || current.webkitTextStrokeWidth !== '0px'
          || current.textDecorationLine !== 'none' || current.textEmphasisStyle !== 'none'
          || current.getPropertyValue('dominant-baseline') !== 'auto' || current.getPropertyValue('text-fit') !== 'none'
          || current.getPropertyValue('text-box-trim') !== 'none' || current.getPropertyValue('text-box-edge') !== 'auto') return null
        for (const name of ['::first-line', '::first-letter']) {
          const first = getComputedStyle(ancestor, name)
          if (typography.some(key => first.getPropertyValue(key) !== current.getPropertyValue(key))) return null
        }
      }
      if (plain === null) fail('plain text ink requires CDP layout')
      const path: number[] = []
      for (let current = node; current.parentElement; current = current.parentElement) path.unshift(Array.from(current.parentElement.children).indexOf(current))
      const proof = plain!.find(item => item.tag === node.tagName && JSON.stringify(item.path) === JSON.stringify(path))
      if (!proof || proof.original !== original || proof.rendered.length !== original.length
        || !/^[!-~]+(?: [!-~]+)*$/.test(proof.rendered)
        || Object.entries(proof.styles).some(([key, value]) => css.getPropertyValue(key) !== value)) return null
      const range = document.createRange(); range.selectNodeContents(node)
      const ranges = Array.from(range.getClientRects()), fonts = proof.platformFonts.fonts
      if (ranges.length !== proof.fragments.length || !ranges.length || ranges.length > 8
        || fonts.length !== 1 || !fonts[0]!.isCustomFont
        || fonts[0]!.glyphCount !== proof.fragments.reduce((total, fragment) => total + fragment.length, 0)) return null
      const familyMatch = /^(?:"([^"\\]+)"|([A-Za-z][A-Za-z0-9_-]*))(?:,|$)/.exec(css.fontFamily)
      const family = familyMatch?.[1] || familyMatch?.[2]
      const size = Number.parseFloat(css.fontSize), weight = Number(css.fontWeight)
      if (!family || fonts[0]!.familyName !== family || !Number.isFinite(size) || size <= 4 || size > 256
        || !Number.isInteger(weight) || weight < 100 || weight > 900) return null
      const covers = (face: FontFace) => {
        const ranges = face.unicodeRange.split(',').map(part => /^\s*U\+([0-9A-F]+)(?:-([0-9A-F]+))?\s*$/i.exec(part))
        return ranges.every(match => match) && Array.from(proof.rendered).every(char => ranges.some(match => char.codePointAt(0)! >= parseInt(match![1]!, 16)
          && char.codePointAt(0)! <= parseInt(match![2] || match![1]!, 16)))
      }
      const faces = Array.from(document.fonts).filter(face => face.family.replace(/^"|"$/g, '') === family && face.style === 'normal'
        && Number(face.weight === 'normal' ? 400 : face.weight) === weight && ['normal', '100%'].includes(face.stretch) && covers(face))
      if (faces.length !== 1) return null
      const face = faces[0]! as FontFace & { variationSettings?: string, variant?: string, sizeAdjust?: string }
      if (face.status !== 'loaded' || face.featureSettings !== 'normal' || face.variationSettings !== 'normal' || face.variant !== 'normal'
        || face.sizeAdjust !== '100%' || face.ascentOverride !== 'normal' || face.descentOverride !== 'normal' || face.lineGapOverride !== 'normal') return null
      const canvas = document.createElement('canvas').getContext('2d')
      if (!canvas) return null
      const language = canvasLanguage(canvas, node, css)
      if (!language) return null
      canvas.font = `${weight} ${size}px "${family}"`
      const selected = /^(?:(\d+) )?([\d.]+)px (.+)$/.exec(canvas.font)
      if (!selected || Number(selected[1] || 400) !== weight || Number(selected[2]) !== size
        || ![family, `"${family}"`].includes(selected[3]!)) return null
      const properties = { direction: 'ltr', textAlign: 'left', textBaseline: 'alphabetic', fontKerning: 'auto',
        fontStretch: 'normal', fontVariantCaps: 'normal', textRendering: 'auto', wordSpacing: '0px',
        letterSpacing: css.letterSpacing === 'normal' ? '0px' : css.letterSpacing }
      for (const [key, value] of Object.entries(properties)) {
        if (typeof (canvas as any)[key] !== 'string') return null
        ;(canvas as any)[key] = value
        if ((canvas as any)[key] !== value) return null
      }
      const equal = (rect: DOMRect, bounds: number[]) => [rect.x, rect.y, rect.width, rect.height].every((value, index) => value === bounds[index])
      let end = 0
      const fragments: Array<{ text: string, bounds: number[], box: Bounds, metrics: Record<string, number> }> = []
      for (const [index, fragment] of proof.fragments.entries()) {
        if (!Number.isSafeInteger(fragment.start) || !Number.isSafeInteger(fragment.length) || fragment.length <= 0
          || fragment.start < end || fragment.start + fragment.length > original.length || !equal(ranges[index]!, fragment.bounds)) return null
        if (fragment.start !== end) {
          // The only unpainted source character accepted is one soft-wrap
          // separator omitted by CDP. Blink returns zero-width caret boxes at
          // one or both line ends; their union is not a text paint rectangle.
          if (fragment.start !== end + 1 || original[end] !== ' ' || index === 0) return null
          range.setStart(node.firstChild!, end); range.setEnd(node.firstChild!, end + 1)
          const separators = Array.from(range.getClientRects()), previous = proof.fragments[index - 1]!.bounds
          if (!separators.length || separators.length > 2 || separators.some(box => box.width !== 0
            || ![previous, fragment.bounds].some(bounds => box.top === bounds[1] && box.height === bounds[3]
              && (Math.abs(box.left - bounds[0]!) <= 1 / 64 || Math.abs(box.left - bounds[0]! - bounds[2]!) <= 1 / 64)))) return null
        }
        end = fragment.start + fragment.length
        range.setStart(node.firstChild!, fragment.start); range.setEnd(node.firstChild!, end)
        if (range.getClientRects().length !== 1 || !equal(range.getBoundingClientRect(), fragment.bounds)) return null
        const text = proof.rendered.slice(fragment.start, end)
        if (text.startsWith(' ') || text.endsWith(' ')) return null
        const [x, y, width, height] = fragment.bounds as [number, number, number, number]
        if (fragment.bounds.some(value => !Number.isFinite(value) || Math.abs(value) >= 2 ** 18) || width <= 0 || height <= 0) return null
        const m = canvas.measureText(text), metrics = { width: m.width, fontAscent: m.fontBoundingBoxAscent, fontDescent: m.fontBoundingBoxDescent,
          left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent }
        if (!Object.values(metrics).every(Number.isFinite) || Math.abs(metrics.width - width) > 1 / 64
          || Math.abs(metrics.fontAscent + metrics.fontDescent - height) > 1) return null
        fragments.push({ text, bounds: fragment.bounds, metrics, box: {
          left: Math.floor(Math.min(x, x - metrics.left) - 1), right: Math.ceil(Math.max(x + width, x + metrics.right) + 1),
          top: Math.floor(Math.min(y, y + metrics.fontAscent - metrics.ascent - 0.5) - 1),
          bottom: Math.ceil(Math.max(y + height, y + metrics.fontAscent + metrics.descent + 0.5) + 1),
        } })
      }
      if (end !== original.length) return null
      return { path, original, rendered: proof.rendered, language, font: canvas.font, letterSpacing: canvas.letterSpacing,
        platformFonts: proof.platformFonts, fragments, baselineAllowance: 0.5, rasterAllowance: 1 }
    }
    function disjointSiblingText(sibling: Element) {
      if (pseudo || input || target.parentElement !== sibling.parentElement || range.getClientRects().length < 2) return false
      const targetInk = plainTextInk(target), siblingInk = plainTextInk(sibling)
      if (!targetInk || !siblingInk || targetInk.fragments.some(a => siblingInk.fragments.some(b =>
        a.box.left < b.box.right && a.box.right > b.box.left && a.box.top < b.box.bottom && a.box.bottom > b.box.top))) return false
      excludedPaint.push({ node: sibling.tagName, reason: 'outside verified CDP text ink fragments', targetInk, siblingInk })
      return true
    }

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
        if (node === target && generatedTarget) {
          for (const child of node.childNodes) {
            if (child.nodeType === Node.COMMENT_NODE || (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim())) continue
            if (child.nodeType !== Node.TEXT_NODE) fail('generated target host has unsupported children')
            const hostRange = document.createRange(); hostRange.selectNode(child)
            if (Array.from(hostRange.getClientRects()).some(box => overlapsText(box))) fail('generated text overlaps its host text')
          }
        }
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
              if (Array.from(range.getClientRects()).some(box => overlapsText(clipped(box, sibling))) && !disjointSiblingText(sibling)) fail(`unmodeled overlapping text ${sibling.tagName}`)
            }
            if (!painted) continue
            const isIndicator = sibling.getAttribute('data-slot') === 'indicator' && target.closest('[role="tab"]')
            const isArrival = sibling.hasAttribute('data-field-arrival-cue')
            // A stretched link can paint below a later positioned text branch.
            // Prove the complete CSS ordering/coverage contract; classes, ARIA
            // state and the SidebarNav component name confer no permission.
            const branchStyle = getComputedStyle(branch)
            const isAbsoluteUnderlay = sibling === siblingRoot
              && Array.from(sibling.childNodes).every(child => child.nodeType === Node.COMMENT_NODE
                || (child.nodeType === Node.TEXT_NODE && (child as Text).data.length === 0))
              && sibling instanceof HTMLAnchorElement && siblingStyle.position === 'absolute'
              && current.position === 'relative' && ['block', 'list-item', 'flow-root'].includes(current.display)
              && branchStyle.display !== 'contents' && branch.getClientRects().length === 1
              && siblingStyle.zIndex === 'auto' && branchStyle.position === 'relative' && branchStyle.zIndex === 'auto'
              && Number(siblingStyle.opacity) === 1 && Number(branchStyle.opacity) === 1
              && siblingStyle.isolation === 'auto' && branchStyle.isolation === 'auto'
              && siblingStyle.mixBlendMode === 'normal' && branchStyle.mixBlendMode === 'normal'
              && siblingStyle.contain === 'none' && branchStyle.contain === 'none'
              && siblingStyle.willChange === 'auto' && branchStyle.willChange === 'auto'
              && !transformed(sibling) && !transformed(branch)
              && siblingStyle.translate === 'none' && branchStyle.translate === 'none'
              && branchStyle.filter === 'none' && branchStyle.backdropFilter === 'none'
              && branchStyle.maskImage === 'none' && branchStyle.clipPath === 'none'
              && positionedContext(target, node)?.node === null
              && coversText(sibling, siblingStyle)
            if (!isIndicator && !isArrival && !isAbsoluteUnderlay) fail(`unmodeled overlapping sibling ${sibling.tagName}.${sibling.className}`)
            // Both accepted layers precede the positioned content in DOM paint
            // order. Reject a changed stacking contract instead of guessing.
            if (sibling !== siblingRoot || !(sibling.compareDocumentPosition(branch) & Node.DOCUMENT_POSITION_FOLLOWING)
              || siblingStyle.zIndex !== 'auto' || getComputedStyle(branch).zIndex !== 'auto'
              || getComputedStyle(branch).position === 'static') fail('unverified sibling stacking order')
            if (box.left > rect.left + 1 || box.right < rect.right - 1 || box.top > rect.top + 1 || box.bottom < rect.bottom - 1) fail('partial sibling coverage')
            background[3] *= Number(siblingStyle.opacity)
            underlays.push({ kind: isIndicator ? 'tabs-indicator' : isArrival ? 'arrival-cue' : 'absolute-link-underlay', background, raw: siblingStyle.backgroundColor, opacity: Number(siblingStyle.opacity), box: box.toJSON() })
          }
        }
        if (Number(current.opacity) !== 1) opaqueSurface = null
        else if (!opaqueSurface && color(current.backgroundColor)[3] === 1 && coversText(node, current)) opaqueSurface = node
        chain.push({ node: node.tagName + (node.id ? `#${node.id}` : ''), background: color(current.backgroundColor), rawBackground: current.backgroundColor, opacity: Number(current.opacity), underlays })
      }
      layers.push(...chain)
      return { text, textBounds: { raw: { left: rawTextRect.left, right: rawTextRect.right, top: rawTextRect.top, bottom: rawTextRect.bottom }, used: textRect, glyph: glyphBounds }, rawForeground: style.color, foreground, layers, excludedPaint, engine, rect: rect.toJSON(), pseudo, generatedText: generatedTarget, generatedConsistency: consistency, fontFamily: style.fontFamily, fontSize: style.fontSize, ownOpacity: own.opacity }
    }
    finally { probe.remove() }
  }, { pseudo, engine, generated, guard, plain })
  let snapshotConsistency: { cssOrFontEvents: number, snapshotsMatch: boolean } | null = null
  let paint: Awaited<ReturnType<typeof evaluate>>
  try { paint = await evaluate(null) }
  catch (error) {
    if (!(error instanceof Error) || !['unresolved: generated text requires CDP layout', 'unresolved: plain text ink requires CDP layout'].some(reason => error.message.includes(reason))) throw error
    // A second read only fills a missing proof. It does not retry an unsafe
    // paint or relax a rejection; missing/changed CDP evidence still fails.
    const proof = await generatedTextLayout(locator)
    try {
      paint = await evaluate(proof.generated, proof.guard, proof.plain)
      snapshotConsistency = await proof.verify()
    }
    finally { await proof.close() }
  }
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
  return { ...paint, snapshotConsistency, effectiveForeground: foreground, effectiveBackground: background, ratio: contrastRatio(foreground, background) }
}
