import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })
  await page.locator('.feed-item').first().click()
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 })
})

test('clicking an article opens the reader', async ({ page }) => {
  await page.locator('.card').first().click()
  await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 10000 })
})

test('reader shows article title', async ({ page }) => {
  const titleText = await page.locator('.card').first().locator('.card-title').innerText()

  await page.locator('.card').first().click()

  await expect(page.locator('.reader-title')).toContainText(titleText, { timeout: 10000 })
})

test('reader can be closed', async ({ page }) => {
  await page.locator('.card').first().click()
  await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 10000 })

  await page.locator('.reader-close').click()
  await expect(page.locator('.reader-overlay')).not.toBeVisible()
})

test('share button opens the share popup', async ({ page }) => {
  await page.locator('.card').first().click()
  await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 10000 })

  await page.locator('[title="Share"]').click()
  await expect(page.locator('.share-popup')).toBeVisible()
})

test('share popup closes on backdrop click', async ({ page }) => {
  await page.locator('.card').first().click()
  await page.locator('[title="Share"]').click()
  await expect(page.locator('.share-popup')).toBeVisible()

  await page.locator('.share-backdrop').click()
  await expect(page.locator('.share-popup')).not.toBeVisible()
})

test('label icon remains active after article is closed and reopened', async ({ page }) => {
  await page.locator('.card').first().click()
  await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 10000 })

  const tagBtn = page.locator('[title="Labels"]')

  // Open label menu and wait for labels to load
  await tagBtn.click()
  await expect(page.locator('.tag-popup')).toBeVisible()
  await expect(page.locator('.tag-status')).not.toBeVisible({ timeout: 5000 })

  // If no labels exist, create a temporary one
  const testLabelName = '__pw_test_label__'
  let createdLabel = false
  if (await page.locator('.tag-option').count() === 0) {
    await page.locator('.tag-new-input').fill(testLabelName)
    await page.locator('.tag-new-btn').click()
    await expect(page.locator('.tag-option').filter({ hasText: testLabelName })).toBeVisible({ timeout: 5000 })
    createdLabel = true
  }

  // Assign the first label if it is not already checked
  const firstLabel = page.locator('.tag-option').first()
  const wasChecked = await firstLabel.locator('.tag-check').isVisible()
  if (!wasChecked) {
    await firstLabel.click()
    await expect(firstLabel.locator('.tag-check')).toBeVisible({ timeout: 3000 })
  }

  // Verify label icon is active before close
  await expect(tagBtn).toHaveClass(/active/)

  // Close the tag popup via backdrop (dispatch JS click to bypass popup z-index interception)
  await page.evaluate(() => (document.querySelector('.share-backdrop') as HTMLElement)?.click())
  await expect(page.locator('.tag-popup')).not.toBeVisible()
  await page.locator('.reader-close').click()
  await expect(page.locator('.reader-overlay')).not.toBeVisible()
  await page.locator('.card').first().click()
  await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 10000 })

  // Label icon must still be active after reopen (regression check)
  await expect(page.locator('[title="Labels"]')).toHaveClass(/active/)

  // Cleanup: uncheck the label if we assigned it, then delete it if we created it
  if (!wasChecked || createdLabel) {
    await page.locator('[title="Labels"]').click()
    await expect(page.locator('.tag-popup')).toBeVisible()
    await expect(page.locator('.tag-status')).not.toBeVisible({ timeout: 5000 })
    const labelToUncheck = createdLabel
      ? page.locator('.tag-option').filter({ hasText: testLabelName })
      : page.locator('.tag-option').first()
    await labelToUncheck.click()
  }
})

test('clicking feed name in reader byline navigates to that feed and closes the reader', async ({ page }) => {
  await page.locator('.card').first().click()
  await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 10000 })

  const feedNameEl = page.locator('.reader-meta-feed')
  await expect(feedNameEl).toBeVisible()
  const feedName = await feedNameEl.innerText()
  await feedNameEl.click()

  await expect(page.locator('.reader-overlay')).not.toBeVisible({ timeout: 5000 })
  await expect(page).toHaveURL(/#\/feed\/-?\d+/)
  await expect(page.locator('.topbar-title')).toContainText(feedName)
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })

  // Back button should not reopen the just-closed reader
  await page.goBack()
  await page.waitForTimeout(500)
  await expect(page.locator('.reader-overlay')).not.toBeVisible()
})

test('note editor save button has dark text in dark mode', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  })

  await page.locator('.card').first().click()
  await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 10000 })

  await page.locator('.note-btn').click()
  await expect(page.locator('.reader-note')).toBeVisible()

  await expect(page.locator('.reader-note-save')).toHaveCSS('color', 'rgb(26, 26, 26)')
})

test('opening the note editor does not scroll the reader while scrolled into the article', async ({ page }) => {
  // .reader-scroll is its own overflow-y:auto container (not window) - find
  // an article with enough content to actually be scrollable within it.
  const scrollEl = page.locator('.reader-scroll')
  let scrollBefore = 0

  for (let i = 0; i < 10; i++) {
    await page.locator('.card').nth(i).click()
    await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 10000 })

    await scrollEl.evaluate((el) => { el.scrollTop = 600 })
    await page.waitForTimeout(150)
    scrollBefore = await scrollEl.evaluate((el) => el.scrollTop)

    if (scrollBefore > 100) break
    await page.locator('.reader-close').click()
  }

  expect(scrollBefore).toBeGreaterThan(100)

  // Deliberately a raw JS .click(), not Playwright's locator.click() -
  // Playwright's click performs its own actionability/scroll-into-view
  // check before dispatching, which gets confused by .reader-toolbar being
  // position:fixed but a DOM descendant of .reader-scroll (fixed elements
  // are visually unaffected by their scrolling ancestor, but Playwright's
  // "is this in view" logic doesn't account for that) - it scrolls
  // .reader-scroll to the toolbar's untransformed document position
  // (the top, since it's ArticleReader.vue's root's first child) as a pure
  // test-tooling artifact that never happens for a real user's click.
  // Confirmed directly: Playwright's own .click() reset this to 0 even with
  // no focus() call anywhere in toggleNote() at all; a raw .click() didn't.
  const noteBtn = page.locator('footer.reader-toolbar .note-btn')
  await noteBtn.evaluate((el) => (el as HTMLElement).click())
  await expect(page.locator('.reader-note')).toBeVisible()

  // Give any scroll animation time to actually happen before checking.
  await page.waitForTimeout(600)

  // Inserting the note editor above the current scroll position legitimately
  // shifts scrollTop by roughly its own height (the browser's scroll
  // anchoring keeping the same content visually in view) - that's expected,
  // not the bug. The bug was scrollTop collapsing back toward the top.
  const scrollAfter = await scrollEl.evaluate((el) => el.scrollTop)
  expect(scrollAfter).toBeGreaterThan(scrollBefore - 50)
})
