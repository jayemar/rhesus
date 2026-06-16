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
