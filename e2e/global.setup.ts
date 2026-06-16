import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(import.meta.dirname, '.auth/user.json')

setup('authenticate', async ({ page }) => {
  const apiUrl = process.env['RHESUS_API_URL'] ?? 'http://localhost:3001/tt-rss/api/'
  const username = process.env['RHESUS_USERNAME']
  const password = process.env['RHESUS_PASSWORD']

  if (!username || !password) {
    throw new Error('RHESUS_USERNAME and RHESUS_PASSWORD must be set')
  }

  await page.goto('/login')

  await page.getByPlaceholder('http://centre:3001/tt-rss/api/').fill(apiUrl)
  await page.getByRole('textbox', { name: /username/i }).fill(username)
  await page.getByRole('textbox', { name: /password/i }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.locator('.topbar')).toBeVisible({ timeout: 10000 })

  await page.context().storageState({ path: authFile })
})
