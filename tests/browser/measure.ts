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
    let opaqueBranch = false
    try {
      for (let node: Element | null = target; node; branch = node, node = node.parentElement) {
        const current = getComputedStyle(node)
        supported(node, current)
        if (current.display === 'none') fail('display:none ancestor')
        const underlays = supportedPseudos(node, true)
        if (branch) for (const sibling of node.children) {
          if (sibling === branch || sibling === probe) continue
          const siblingStyle = getComputedStyle(sibling)
          const box = sibling.getBoundingClientRect()
          if (!box.width || !box.height || siblingStyle.visibility !== 'visible' || Number(siblingStyle.opacity) === 0) continue
          const overlap = box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top
          if (!overlap) continue
          supported(sibling, siblingStyle)
          supportedPseudos(sibling)
          const background = color(siblingStyle.backgroundColor)
          const painted = background[3] > 0 || siblingStyle.backgroundImage !== 'none'
          if (!painted) continue
          if (opaqueBranch && (sibling.compareDocumentPosition(branch) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
          const isIndicator = sibling.getAttribute('data-slot') === 'indicator' && target.closest('[role="tab"]')
          const isArrival = sibling.hasAttribute('data-field-arrival-cue')
          if (!isIndicator && !isArrival) fail(`unmodeled overlapping sibling ${sibling.tagName}.${sibling.className}`)
          // Both accepted layers precede the positioned content in DOM paint
          // order. Reject a changed stacking contract instead of guessing.
          if (!(sibling.compareDocumentPosition(branch) & Node.DOCUMENT_POSITION_FOLLOWING)
            || siblingStyle.zIndex !== 'auto' || getComputedStyle(branch).zIndex !== 'auto'
            || getComputedStyle(branch).position === 'static') fail('unverified sibling stacking order')
          if (box.left > rect.left + 1 || box.right < rect.right - 1 || box.top > rect.top + 1 || box.bottom < rect.bottom - 1) fail('partial sibling coverage')
          background[3] *= Number(siblingStyle.opacity)
          underlays.push({ kind: isIndicator ? 'tabs-indicator' : 'arrival-cue', background, raw: siblingStyle.backgroundColor, opacity: Number(siblingStyle.opacity), box: box.toJSON() })
        }
        opaqueBranch = (opaqueBranch || color(current.backgroundColor)[3] === 1) && Number(current.opacity) === 1
        chain.push({ node: node.tagName + (node.id ? `#${node.id}` : ''), background: color(current.backgroundColor), rawBackground: current.backgroundColor, opacity: Number(current.opacity), underlays })
      }
      layers.push(...chain)
      return { text, rawForeground: style.color, foreground, layers, rect: rect.toJSON(), pseudo, fontFamily: style.fontFamily, fontSize: style.fontSize, ownOpacity: own.opacity }
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
