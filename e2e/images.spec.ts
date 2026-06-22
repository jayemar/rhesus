import { test, expect } from '@playwright/test'

test('reader shows hero image for BBC article with cached enclosure', async ({ page }) => {
  // BBC Mundo feed (feed_id 423 for playwrite user)
  await page.goto('/#/feed/423')
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 })

  // Find the Ormuz article by title text
  const card = page.locator('.card').filter({ hasText: 'Ormuz' }).first()
  await expect(card).toBeVisible({ timeout: 10000 })
  await card.click()

  await expect(page.locator('.reader-overlay')).toBeVisible({ timeout: 10000 })

  // Hero image must be present in the DOM
  const hero = page.locator('.reader-hero')
  await expect(hero).toBeVisible({ timeout: 10000 })

  // Hero image must have actually loaded (naturalWidth > 0)
  await page.waitForFunction(() => {
    const img = document.querySelector('.reader-hero') as HTMLImageElement | null
    return img !== null && img.complete && img.naturalWidth > 0
  }, { timeout: 10000 })
})

test('card thumbnail is visible for BBC article with cached enclosure', async ({ page }) => {
  await page.goto('/#/feed/423')
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 })

  const card = page.locator('.card').filter({ hasText: 'Ormuz' }).first()
  await expect(card).toBeVisible({ timeout: 10000 })

  // Card thumbnail image must be present and loaded
  const thumb = card.locator('.card-thumb img')
  await expect(thumb).toBeVisible({ timeout: 10000 })

  await page.waitForFunction(() => {
    const img = document.querySelector('.card-thumb img') as HTMLImageElement | null
    return img !== null && img.complete && img.naturalWidth > 0
  }, { timeout: 10000 })
})
