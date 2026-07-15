import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.topbar')).toBeVisible({ timeout: 10000 })
})

async function openSettings(page: import('@playwright/test').Page) {
  await page.locator('[title="Settings"]').click()
  await expect(page.locator('.settings-panel')).toBeVisible({ timeout: 5000 })
}

test('settings panel opens and closes', async ({ page }) => {
  await openSettings(page)
  await page.locator('[title="Settings"]').click()
  await expect(page.locator('.settings-panel')).not.toBeVisible()
})

test('font select shows all options', async ({ page }) => {
  await openSettings(page)

  // Both the Theme and Font selects have an option[value="system"], so filter by
  // the row's exact label text instead to avoid an ambiguous match.
  const fontSelect = page
    .locator('.select-row')
    .filter({ has: page.locator('span', { hasText: /^Font$/ }) })
    .locator('select')
  await expect(fontSelect).toBeVisible()

  const options = fontSelect.locator('option')
  await expect(options).toHaveCount(5)
  await expect(options.nth(0)).toContainText('System UI')
  await expect(options.nth(1)).toContainText('Inter')
  await expect(options.nth(2)).toContainText('Nunito')
  await expect(options.nth(3)).toContainText('Merriweather')
  await expect(options.nth(4)).toContainText('Lora')
})

test('selecting a font applies the font to the body', async ({ page }) => {
  await openSettings(page)

  // Both the Theme and Font selects have an option[value="system"], so filter by
  // the row's exact label text instead to avoid an ambiguous match.
  const fontSelect = page
    .locator('.select-row')
    .filter({ has: page.locator('span', { hasText: /^Font$/ }) })
    .locator('select')
  await fontSelect.selectOption('lora')

  // The font is applied reactively via a watcher, which can lag one tick behind
  // the selectOption resolving, so poll rather than reading the style immediately.
  await page.waitForFunction(
    () => window.getComputedStyle(document.body).fontFamily.toLowerCase().includes('lora'),
    { timeout: 5000 },
  )
})
