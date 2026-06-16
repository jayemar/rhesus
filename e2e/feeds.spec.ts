import { test, expect } from '@playwright/test'

test('app shell loads after login', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.topbar')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.sidebar')).toBeVisible()
})

test('sidebar shows feed tree', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })
})

test('clicking a feed loads articles', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })

  const feedItem = page.locator('.feed-item').first()
  await feedItem.click()

  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  await expect(page).toHaveURL(/\/(feed|category)\//)
})

test('URL updates when feed is selected', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })

  const feedItem = page.locator('.feed-item').first()
  await feedItem.click()

  await expect(page).toHaveURL(/\/(feed|category)\/[-\d]+/)
})

test('refreshing preserves selected feed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })

  const feedItem = page.locator('.feed-item').first()
  await feedItem.click()

  const urlBeforeRefresh = page.url()
  await page.reload()

  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  expect(page.url()).toBe(urlBeforeRefresh)
})
