import type { Locator } from 'playwright-core'
import { composite, contrastRatio } from '../../scripts/lib/text-contrast.mjs'

export async function measure(locator: Locator, pseudo: '::placeholder' | null = null) {
  const paint = await locator.evaluate((element, pseudo) => {
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
    const textRect = input ? {
      left: rect.left + parseFloat(host.borderLeftWidth) + parseFloat(host.paddingLeft),
      right: rect.right - parseFloat(host.borderRightWidth) - parseFloat(host.paddingRight),
      top: rect.top + parseFloat(host.borderTopWidth) + parseFloat(host.paddingTop),
      bottom: rect.bottom - parseFloat(host.borderBottomWidth) - parseFloat(host.paddingBottom),
    } : range.getBoundingClientRect()
    const text = pseudo ? (target as HTMLInputElement).placeholder : ((target as HTMLInputElement).value || target.textContent?.trim())
    const fail = (reason: string): never => { throw new Error(`unresolved: ${reason}`) }
    if (!text || !rect.width || !rect.height || getComputedStyle(target).visibility !== 'visible') fail('empty or hidden target')
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
    function supported(node: Element, computed: CSSStyleDeclaration) {
      if (computed.backgroundImage !== 'none' || computed.filter !== 'none' || computed.backdropFilter !== 'none'
        || computed.mixBlendMode !== 'normal' || computed.maskImage !== 'none') fail(`unsupported paint on ${node.tagName}`)
      if (computed.boxShadow.includes('inset')) {
        const colors: string[] = []
        const shadows = computed.boxShadow.replace(/(?:rgba?|color|oklab|oklch|lab|lch)\([^)]*\)/g, value => {
          colors.push(value); return `COLOR${colors.length - 1}`
        }).split(',')
        for (const shadow of shadows.filter(s => s.includes('inset'))) {
          const match = /COLOR(\d+)/.exec(shadow)
          if (!match) fail('unsupported inset shadow color')
          if (color(colors[Number(match![1])]!)[3] === 0) continue
          const lengths = shadow.replace(/COLOR\d+|inset/g, '').trim().split(/\s+/)
          if (lengths.length !== 4 || lengths.some(v => !/^-?[\d.]+px$/.test(v))) fail('unsupported inset shadow geometry')
          const [x, y, blur, spread] = lengths.map(parseFloat)
          const box = node.getBoundingClientRect()
          const clearance = Math.min(textRect.left - box.left, box.right - textRect.right, textRect.top - box.top, box.bottom - textRect.bottom)
          if (x !== 0 || y !== 0 || blur !== 0 || spread! < 0 || spread! > clearance) fail('inset shadow may overlap text')
        }
      }
    }
    function supportedPseudos(node: Element, allowItem = false) {
      const paints: any[] = []
      for (const pseudoName of ['::before', '::after']) {
        const ps = getComputedStyle(node, pseudoName)
        const background = color(ps.backgroundColor)
        if (ps.content === 'none' || ps.content === 'normal' || (background[3] === 0 && ps.backgroundImage === 'none' && ps.boxShadow === 'none' && ps.filter === 'none')) continue
        const current = getComputedStyle(node)
        if (!allowItem || pseudoName !== '::before' || node.getAttribute('data-slot') !== 'item'
          || !['option', 'menuitem'].includes(node.getAttribute('role') || '')
          || ps.position !== 'absolute' || ps.zIndex !== '-1' || current.position !== 'relative'
          || current.zIndex !== 'auto' || color(current.backgroundColor)[3] !== 0
          || ps.backgroundImage !== 'none' || ps.boxShadow !== 'none' || ps.filter !== 'none') fail(`unmodeled ${pseudoName}`)
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
      box.left < textRect.right && box.right > textRect.left && box.top < textRect.bottom && box.bottom > textRect.top

    // Only use a bounded, provable part of CSS painting order. A positioned
    // stacking context is atomic: descendants cannot escape its stack level.
    // DOM order alone says nothing about a sibling with a higher z-index.
    function positionedContext(leaf: Element, ancestor: Element) {
      const path: Element[] = []
      for (let node: Element | null = leaf; node && node !== ancestor; node = node.parentElement) path.unshift(node)
      for (const node of path) {
        const css = getComputedStyle(node)
        if (css.display === 'contents') return null // no box, hence no positioned context to compare
        const positioned = css.position !== 'static'
        if (positioned && (css.zIndex !== 'auto' || css.position === 'fixed' || css.position === 'sticky')) {
          const level = css.zIndex === 'auto' ? 0 : Number(css.zIndex)
          return Number.isInteger(level) ? { node, level } : null
        }
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
      if (css.display === 'none' || Number(css.opacity) === 0) return
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
            if (!box.width || !box.height || siblingStyle.visibility !== 'visible' || Number(siblingStyle.opacity) === 0) continue
            if (!overlapsText(box)) continue
            if (behindOpaqueBranch(sibling, node)) continue
            supported(sibling, siblingStyle)
            supportedPseudos(sibling)
            const background = color(siblingStyle.backgroundColor)
            const painted = background[3] > 0 || siblingStyle.backgroundImage !== 'none'
            // A transparent element can still paint text or replaced content.
            // Such overlap has no modeled composition and must not pass silently.
            if (sibling instanceof SVGElement || /^(IMG|VIDEO|CANVAS|IFRAME)$/.test(sibling.tagName)) fail(`unmodeled overlapping content ${sibling.tagName}`)
            for (const child of sibling.childNodes) {
              if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue
              const range = document.createRange()
              range.selectNode(child)
              if (Array.from(range.getClientRects()).some(overlapsText)) fail(`unmodeled overlapping text ${sibling.tagName}`)
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
      return { text, rawForeground: style.color, foreground, layers, excludedPaint, rect: rect.toJSON(), pseudo, fontFamily: style.fontFamily, fontSize: style.fontSize, ownOpacity: own.opacity }
    }
    finally { probe.remove() }
  }, pseudo)
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
