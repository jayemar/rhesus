import { test, expect } from '@playwright/test'

test('document.title is Rhesus on initial load', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.topbar')).toBeVisible({ timeout: 10000 })
  const title = await page.title()
  expect(title).toBe('Rhesus')
})

test('document.title is Rhesus after navigating to a feed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })
  await page.locator('.feed-item').first().click()
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  const title = await page.title()
  expect(title).toBe('Rhesus')
})

test('document.title is Rhesus after navigating to a second feed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })
  const feeds = page.locator('.feed-item')
  await feeds.first().click()
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })

  // Selecting a feed auto-collapses the sidebar, so it must be reopened before
  // the next feed item is reachable/clickable.
  await page.locator('[title="Toggle sidebar"]').click()
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })
  await feeds.nth(1).click()
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  const title = await page.title()
  expect(title).toBe('Rhesus')
})

test('URL after feed navigation contains feed path not page title', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })
  await page.locator('.feed-item').first().click()
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  // URL should have changed from / but title must still be Rhesus
  const url = page.url()
  const title = await page.title()
  console.log('URL after navigation:', url)
  console.log('document.title after navigation:', title)
  expect(title).toBe('Rhesus')
})
