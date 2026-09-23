import { readFile, writeFile } from 'node:fs/promises'
import { parseColor, composite, contrastRatio } from '../../../scripts/lib/text-contrast.mjs'
import { mapping, roles } from '../../../playground/functional-colors/candidates.mjs'
const css = await readFile(new URL('../../../foundation/assets/css/main.css', import.meta.url), 'utf8')
function ramp(role, shade) {
  const matches = [...css.matchAll(new RegExp(`--ui-color-${role}-${shade}: (#[a-f0-9]+);`, 'g'))]
  if (matches.length !== 1) throw new Error(`Nonunique/missing actual ramp: ${role}/${shade}`)
  return matches[0][1]
}
const backgrounds = { light: ['#ffffff','#fafafa','#f2f2f2','#ebebeb'], dark: ['#0a0a0a','#1a1a1a','#1f1f1f','#292929'] }
const rows = []
for (const theme of ['light','dark']) for (const role of roles) for (const [surface, hex] of backgrounds[theme].entries()) {
  for (const mode of ['baseline','recommended']) {
    const color = parseColor(mode === 'baseline' ? ramp(role, theme === 'light' ? 500 : 400) : mapping[theme][role])
    const bg = parseColor(hex)
    for (const alpha of [0, .1]) {
      const effectiveBackground = composite([...color.slice(0,3), alpha], bg)
      for (const textAlpha of [1, .9, .75]) {
        const effectiveForeground = composite([...color.slice(0,3), textAlpha], effectiveBackground)
        const ratio = contrastRatio(effectiveForeground, effectiveBackground)
        rows.push({ mode, theme, role, surface: ['default','muted','elevated','accented'][surface], alpha, textAlpha, effectiveForeground, effectiveBackground, ratio, status: ratio >=4.5 ? 'pass':'fail' })
      }
    }
  }
}
const warning = ['#e99b18','#7b4207'].flatMap(fill => ['#ffffff','#171717'].map(text => ({fill,text,ratio:contrastRatio(parseColor(fill),parseColor(text))})))
await writeFile(new URL('./static-pairs.json', import.meta.url), JSON.stringify({ classification: 'Pure sRGB pairing calculations, not browser/paint/state evidence. Alpha combinations are diagnostic, not a claim that every component uses every combination.', sourceSHA: '19a107527d1226585611f4547619320b430fab2a', rows, warning },null,2)+'\n')
console.log({pairs:rows.length,warning})
