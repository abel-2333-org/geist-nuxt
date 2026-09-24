import assert from 'node:assert/strict'

// Wait for normal finite animations, never disable production motion.
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    for (let pass = 0; pass < 10; pass++) {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const active = document.getAnimations().filter(animation =>
        animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime))
      if (!active.length) return
      await Promise.all(active.map(animation => animation.finished.catch(() => {})))
    }
    throw new Error('UI animations did not settle')
  })
}

export async function tabsEvidence(page) {
  await settle(page)
  const rows = await page.locator('[role="tablist"]').evaluateAll(lists => lists.filter(el => el.checkVisibility()).map(list => {
    const selected = list.querySelector('[role="tab"][aria-selected="true"]')
    const indicator = list.querySelector('[data-slot="indicator"]')
    const panel = selected && document.getElementById(selected.getAttribute('aria-controls'))
    const rect = el => { const r = el?.getBoundingClientRect(); return r && { x: r.x, y: r.y, width: r.width, height: r.height } }
    return { selected: selected?.textContent.trim(), selectedCount: list.querySelectorAll('[aria-selected="true"]').length,
      selectedRect: rect(selected), indicatorRect: rect(indicator), panelVisible: !!panel?.checkVisibility(),
      panelText: panel?.textContent.trim(), labelColor: selected && getComputedStyle(selected).color,
      indicatorColor: indicator && getComputedStyle(indicator).backgroundColor }
  }))
  assert.ok(rows.length, 'visible tabs are present')
  for (const row of rows) {
    assert.equal(row.selectedCount, 1)
    assert.ok(row.panelVisible, `${row.selected}: selected panel is visible`)
    assert.ok(row.indicatorRect, `${row.selected}: indicator exists`)
    for (const key of ['x', 'width']) assert.ok(Math.abs(row.selectedRect[key] - row.indicatorRect[key]) <= 1,
      `${row.selected}: settled indicator ${key} matches selected tab`)
  }
  return rows
}

export async function focusScreenshot(page, locator, options) {
  await settle(page)
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  assert.ok(box)
  const viewport = page.viewportSize()
  const padding = 12
  const x = Math.max(0, box.x - padding), y = Math.max(0, box.y - padding)
  await page.screenshot({ ...options, clip: { x, y, width: Math.min(viewport.width - x, box.width + padding * 2), height: Math.min(viewport.height - y, box.height + padding * 2) } })
}
