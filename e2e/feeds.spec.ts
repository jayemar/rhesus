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
  await expect(page).toHaveURL(/#\/(feed|category)\//)
})

test('URL updates when feed is selected', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })

  const feedItem = page.locator('.feed-item').first()
  await feedItem.click()

  await expect(page).toHaveURL(/#\/(feed|category)\/[-\d]+/)
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

test('clicking feed name in article card navigates to that feed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })

  await page.locator('.feed-item').first().click()
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  const card = page.locator('.card').first()
  await expect(card).toBeVisible({ timeout: 10000 })

  const feedNameEl = card.locator('.feed-name')
  const feedName = await feedNameEl.innerText()
  await feedNameEl.click()

  await expect(page).toHaveURL(/#\/feed\/-?\d+/)
  await expect(page.locator('.reader-overlay')).not.toBeVisible()
  await expect(page.locator('.topbar-title')).toContainText(feedName)
})

test('clicking topbar title opens the feed website homepage in a new tab', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.locator('.feed-tree')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 })

  // Every article belongs to a real (non-virtual) feed, so clicking its feed-name
  // is a reliable way to land on a real single-feed view regardless of tree nesting.
  await page.locator('.card').first().locator('.feed-name').click()
  await expect(page).toHaveURL(/#\/feed\/\d+/)
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })

  const titleEl = page.locator('.topbar-title')
  await expect(titleEl).toHaveClass(/topbar-title-link/, { timeout: 10000 })

  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    titleEl.click(),
  ])
  await newPage.waitForLoadState('domcontentloaded')
  expect(newPage.url()).not.toBe('about:blank')
  expect(newPage.url()).not.toContain('centre:3001')
  // Must be the site homepage (site_url), not the RSS/Atom feed XML (feed_url).
  expect(newPage.url()).not.toMatch(/\.(xml|rss)(\?|$)/)
  await newPage.close()
})

test('topbar title is not a link when viewing All Articles (virtual feed)', async ({ page }) => {
  await page.goto('/#/feed/-4')
  await expect(page.locator('.article-list')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.topbar-title')).not.toHaveClass(/topbar-title-link/)
})
