import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('invalid credentials show an error', async ({ page }) => {
  const apiUrl = process.env['RHESUS_API_URL'] ?? 'http://localhost:3001/tt-rss/api/'

  await page.goto('/login')
  await page.getByPlaceholder('http://centre:3001/tt-rss/api/').fill(apiUrl)
  await page.getByRole('textbox', { name: /username/i }).fill('nobody')
  await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.locator('.error')).toBeVisible({ timeout: 10000 })
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated visit to / redirects to login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})
