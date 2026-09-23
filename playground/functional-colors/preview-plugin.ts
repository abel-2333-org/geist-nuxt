import { candidateCSS } from './candidates.mjs'
// Registered by the isolated build only, never in the normal gallery.
export default defineNuxtPlugin(() => {
  const route = useRoute()
  useHead(() => {
    const requested = String(route.query.candidate || 'baseline')
    const mode = ['recommended', 'amber-solid'].includes(requested) ? requested : 'baseline'
    return { htmlAttrs: { 'data-functional-preview': mode }, style: [{ key: 'functional-preview', innerHTML: candidateCSS(mode) }] }
  })
})
