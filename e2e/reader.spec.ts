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
