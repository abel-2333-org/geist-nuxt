import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { UAlert, UButton } from '#components'

const roles = ['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const

// These are theme composition guards. Actual computed colors, geometry and
// contrast are verified separately by the real-browser functional matrix.
describe('functional theme composition', () => {
  for (const color of roles) {
    it(`${color} solid preserves upstream text, focus and disabled rules`, async () => {
      const button = await mountSuspended(UButton, { props: { color, label: 'Action' } })
      const classes = button.classes()
      expect(classes).toContain('text-inverted')
      expect(classes).toContain('transition-none')
      expect(classes).not.toContain('transition-colors')
      expect(classes).toContain(`bg-${color}`)
      expect(classes).toContain(`disabled:bg-${color}`)
      expect(classes).toContain(`aria-disabled:bg-${color}`)
      expect(classes.some(value => /^dark:(hover|active|disabled|aria-disabled):bg-/.test(value))).toBe(false)
      expect(classes).toContain('focus-visible:outline-3')
      expect(classes).toContain(`outline-${color}/25`)
      expect(classes).not.toContain(`hover:bg-${color}/75`)
      expect(classes).not.toContain(`active:bg-${color}/75`)
      expect(classes).toContain(`hover:bg-[color-mix(in_srgb,var(--ui-${color})_90%,var(--geist-button-state-mix))]`)
      expect(classes).toContain(`active:bg-[color-mix(in_srgb,var(--ui-${color})_80%,var(--geist-button-state-mix))]`)
    })

    it(`${color} link retains full text color and adds decoration`, async () => {
      const button = await mountSuspended(UButton, { props: { color, variant: 'link', label: 'Read' } })
      expect(button.classes()).toEqual(expect.arrayContaining([
        `text-${color}`, `hover:text-${color}`, `active:text-${color}`,
        'hover:underline', 'active:underline', 'focus-visible:outline-3',
      ]))
      expect(button.classes()).not.toContain(`hover:text-${color}/75`)
      expect(button.classes()).not.toContain(`active:text-${color}/75`)
    })

    it(`${color} alert removes only description opacity across variants`, async () => {
      for (const variant of ['solid', 'outline', 'soft', 'subtle'] as const) {
        const alert = await mountSuspended(UAlert, { props: { color, variant, title: 'Status', description: 'Details' } })
        const description = alert.get('[data-slot="description"]')
        expect(description.classes()).toContain('opacity-100')
        expect(description.classes()).not.toContain('opacity-90')
        expect(description.classes()).toContain('text-sm')
        expect(alert.get('[data-slot="title"]').classes()).toContain('font-medium')
        alert.unmount()
      }
    })
  }

  it('leaves neutral and other button variants on the upstream theme', async () => {
    const button = await mountSuspended(UButton, { props: { color: 'neutral', label: 'Action' } })
    expect(button.classes()).toContain('hover:bg-inverted/90')
    const link = await mountSuspended(UButton, { props: { color: 'neutral', variant: 'link', label: 'Read' } })
    expect(link.classes()).not.toContain('hover:underline')
    const soft = await mountSuspended(UButton, { props: { color: 'warning', variant: 'soft', label: 'Action' } })
    expect(soft.classes()).toContain('hover:bg-warning/15')
    const alert = await mountSuspended(UAlert, { props: { color: 'neutral', description: 'Details' } })
    expect(alert.get('[data-slot="description"]').classes()).toContain('opacity-90')
  })

  it('continues to honor instance overrides after the foundation theme', async () => {
    const button = await mountSuspended(UButton, {
      props: { color: 'primary', label: 'Action', ui: { base: 'hover:bg-error' } },
    })
    expect(button.classes()).toContain('hover:bg-error')
    expect(button.classes().filter(value => value.startsWith('hover:bg-'))).toEqual(['hover:bg-error'])
    expect(button.classes().some(value => value.startsWith('dark:hover:bg-'))).toBe(false)
    const alert = await mountSuspended(UAlert, {
      props: { color: 'warning', description: 'Details', ui: { description: 'opacity-80' } },
    })
    expect(alert.get('[data-slot="description"]').classes()).toContain('opacity-80')
    expect(alert.get('[data-slot="description"]').classes()).not.toContain('opacity-100')
  })
})
