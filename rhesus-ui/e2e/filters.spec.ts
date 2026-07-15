import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.topbar')).toBeVisible({ timeout: 10000 })
})

async function openFilterManager(page: import('@playwright/test').Page) {
  await page.locator('[title="Manage filters"]').click()
  await expect(page.locator('.filter-manager')).toBeVisible({ timeout: 5000 })
}

async function closeFilterManager(page: import('@playwright/test').Page) {
  await page.locator('[title="Close"]').click()
  await expect(page.locator('.filter-manager')).not.toBeVisible({ timeout: 5000 })
}

async function createFilter(
  page: import('@playwright/test').Page,
  opts: {
    title?: string
    ruleRegex?: string
    ruleType?: string
  } = {},
) {
  const title = opts.title ?? 'Test filter'
  const ruleRegex = opts.ruleRegex ?? 'test-pattern'
  const ruleType = opts.ruleType ?? 'Title'

  await page.getByRole('button', { name: 'New filter' }).click()
  await expect(page.locator('.filter-editor')).toBeVisible({ timeout: 5000 })

  await page.locator('.filter-editor input[type="text"]').first().fill(title)

  const ruleTypeSelect = page.locator('.rule-row .field-select').first()
  await ruleTypeSelect.selectOption({ label: ruleType })

  await page.locator('.rule-input').first().fill(ruleRegex)

  await page.locator('.btn-save').click()
}

// Filter titles are not unique in TT-RSS, so match on the exact row text to avoid
// ambiguous locators when multiple filters share a title prefix (e.g. an "edited"
// variant of a title created earlier in the same test).
function filterRowByTitle(page: import('@playwright/test').Page, title: string) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return page.locator('.filter-row').filter({ has: page.locator('.filter-title', { hasText: new RegExp(`^${escaped}$`) }) })
}

// CRUD tests run against a real, persistent account rather than a fresh database,
// so any filter they create must be deleted again or it pollutes subsequent runs.
async function deleteFilterByTitle(page: import('@playwright/test').Page, title: string) {
  const row = filterRowByTitle(page, title)
  await row.locator('[title="Delete"]').click()
  await expect(page.locator('.dialog')).toBeVisible({ timeout: 3000 })
  await page.locator('.btn-confirm').click()
  await expect(filterRowByTitle(page, title)).toHaveCount(0, { timeout: 5000 })
}

// --- Open / close ---

test('filter manager opens fullscreen', async ({ page }) => {
  await openFilterManager(page)
  const overlay = page.locator('.settings-overlay').filter({ has: page.locator('.filter-manager') })
  await expect(overlay).toBeVisible()
})

test('filter manager closes via X button', async ({ page }) => {
  await openFilterManager(page)
  await closeFilterManager(page)
})

test('filter manager closes via Manage filters toggle', async ({ page }) => {
  await openFilterManager(page)
  await page.locator('[title="Manage filters"]').click()
  await expect(page.locator('.filter-manager')).not.toBeVisible({ timeout: 5000 })
})

test('filter manager closes via Esc key', async ({ page }) => {
  await openFilterManager(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('.filter-manager')).not.toBeVisible({ timeout: 5000 })
})

// --- List view ---

test('filter manager shows heading', async ({ page }) => {
  await openFilterManager(page)
  await expect(page.locator('.filter-manager h2')).toHaveText('Filters')
})

test('filter manager shows New filter button', async ({ page }) => {
  await openFilterManager(page)
  await expect(page.getByRole('button', { name: 'New filter' })).toBeVisible()
})

// --- Filter editor navigation ---

test('New filter button opens the filter editor', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()
  await expect(page.locator('.filter-editor')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.editor-title')).toHaveText('New filter')
})

test('Cancel returns to filter list', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()
  await expect(page.locator('.filter-editor')).toBeVisible()
  await page.locator('.btn-cancel').click()
  await expect(page.locator('.filter-manager')).toBeVisible()
  await expect(page.locator('.filter-editor')).not.toBeVisible()
})

test('Back button returns to filter list', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()
  await page.locator('.back-btn').click()
  await expect(page.locator('.filter-editor')).not.toBeVisible()
  await expect(page.locator('.filter-manager')).toBeVisible()
})

// --- Validation ---

test('saving without a rule shows error', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()

  // Remove the default blank rule
  await page.locator('.rule-row .remove-btn').click()

  await page.locator('.btn-save').click()
  await expect(page.locator('.field-error')).toContainText(/rule/i)
  await expect(page.locator('.filter-editor')).toBeVisible()
})

test('saving without an action shows error', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()

  await page.locator('.rule-input').first().fill('something')

  // Remove the default blank action
  await page.locator('.action-row .remove-btn').click()

  await page.locator('.btn-save').click()
  await expect(page.locator('.field-error')).toContainText(/action/i)
  await expect(page.locator('.filter-editor')).toBeVisible()
})

// --- CRUD ---

test('creates a filter and it appears in the list', async ({ page }) => {
  await openFilterManager(page)
  await createFilter(page, { title: 'Playwright create test' })

  await expect(page.locator('.filter-manager')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.filter-list')).toBeVisible()
  await expect(filterRowByTitle(page, 'Playwright create test')).toBeVisible()

  await deleteFilterByTitle(page, 'Playwright create test')
})

test('created filter defaults to enabled', async ({ page }) => {
  await openFilterManager(page)
  await createFilter(page, { title: 'Playwright enabled test' })

  const row = filterRowByTitle(page, 'Playwright enabled test')
  const checkbox = row.locator('input[type="checkbox"]')
  await expect(checkbox).toBeChecked()

  await deleteFilterByTitle(page, 'Playwright enabled test')
})

test('toggling enabled updates the checkbox', async ({ page }) => {
  await openFilterManager(page)
  await createFilter(page, { title: 'Playwright toggle test' })

  const row = filterRowByTitle(page, 'Playwright toggle test')
  const checkbox = row.locator('input[type="checkbox"]')

  await expect(checkbox).toBeChecked()
  await checkbox.click()
  await expect(checkbox).not.toBeChecked()

  // Reload to confirm persistence
  await page.reload()
  await openFilterManager(page)
  const reloadedRow = filterRowByTitle(page, 'Playwright toggle test')
  await expect(reloadedRow.locator('input[type="checkbox"]')).not.toBeChecked()

  await deleteFilterByTitle(page, 'Playwright toggle test')
})

test('editing a filter updates it in the list', async ({ page }) => {
  await openFilterManager(page)
  await createFilter(page, { title: 'Playwright edit test' })

  const row = filterRowByTitle(page, 'Playwright edit test')
  await row.locator('[title="Edit"]').click()
  await expect(page.locator('.filter-editor')).toBeVisible()
  await expect(page.locator('.editor-title')).toHaveText('Edit filter')

  const titleInput = page.locator('.filter-editor input[type="text"]').first()
  await titleInput.fill('Playwright edit test -- updated')
  await page.locator('.btn-save').click()

  await expect(page.locator('.filter-manager')).toBeVisible({ timeout: 5000 })
  await expect(filterRowByTitle(page, 'Playwright edit test -- updated')).toBeVisible()
  await expect(filterRowByTitle(page, 'Playwright edit test')).toHaveCount(0)

  await deleteFilterByTitle(page, 'Playwright edit test -- updated')
})

test('deleting a filter removes it from the list', async ({ page }) => {
  await openFilterManager(page)
  await createFilter(page, { title: 'Playwright delete test' })

  const row = filterRowByTitle(page, 'Playwright delete test')
  await row.locator('[title="Delete"]').click()

  // Confirm dialog
  await expect(page.locator('.dialog')).toBeVisible({ timeout: 3000 })
  await page.locator('.btn-confirm').click()

  await expect(filterRowByTitle(page, 'Playwright delete test')).toHaveCount(0, { timeout: 5000 })
})

test('cancelling delete leaves filter in the list', async ({ page }) => {
  await openFilterManager(page)
  await createFilter(page, { title: 'Playwright cancel delete test' })

  const row = filterRowByTitle(page, 'Playwright cancel delete test')
  await row.locator('[title="Delete"]').click()

  await page.locator('.btn-cancel').click()
  await expect(filterRowByTitle(page, 'Playwright cancel delete test')).toBeVisible()

  await deleteFilterByTitle(page, 'Playwright cancel delete test')
})

// --- Rule options ---

test('filter editor shows all rule type options', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()

  const ruleTypeSelect = page.locator('.rule-row .field-select').first()
  const options = ruleTypeSelect.locator('option')
  // hasText does substring matching, so 'Title' and 'Content' must be matched exactly
  // to avoid also matching the 'Title or Content' option.
  await expect(options.filter({ hasText: /^Title$/ })).toHaveCount(1)
  await expect(options.filter({ hasText: /^Content$/ })).toHaveCount(1)
  await expect(options.filter({ hasText: /^Title or Content$/ })).toHaveCount(1)
  await expect(options.filter({ hasText: /^Link$/ })).toHaveCount(1)
  await expect(options.filter({ hasText: /^Author$/ })).toHaveCount(1)
  await expect(options.filter({ hasText: /^Tags$/ })).toHaveCount(1)
})

test('add rule button appends another rule row', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()

  await expect(page.locator('.rule-row')).toHaveCount(1)
  await page.getByRole('button', { name: '+ Add rule' }).click()
  await expect(page.locator('.rule-row')).toHaveCount(2)
})

test('remove rule button removes that rule row', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()
  await page.getByRole('button', { name: '+ Add rule' }).click()
  await expect(page.locator('.rule-row')).toHaveCount(2)

  await page.locator('.rule-row').first().locator('.remove-btn').click()
  await expect(page.locator('.rule-row')).toHaveCount(1)
})

// --- Action options ---

test('filter editor shows all action type options', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()

  const actionSelect = page.locator('.action-row .field-select').first()
  const options = actionSelect.locator('option')
  await expect(options.filter({ hasText: 'Mark as read' })).toHaveCount(1)
  await expect(options.filter({ hasText: 'Delete article' })).toHaveCount(1)
  await expect(options.filter({ hasText: 'Mark as starred' })).toHaveCount(1)
  await expect(options.filter({ hasText: 'Assign label' })).toHaveCount(1)
  await expect(options.filter({ hasText: 'Modify score' })).toHaveCount(1)
  await expect(options.filter({ hasText: 'Stop processing' })).toHaveCount(1)
})

test('add action button appends another action row', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()

  await expect(page.locator('.action-row')).toHaveCount(1)
  await page.getByRole('button', { name: '+ Add action' }).click()
  await expect(page.locator('.action-row')).toHaveCount(2)
})

test('score action shows number input', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()

  const actionSelect = page.locator('.action-row .field-select').first()
  await actionSelect.selectOption({ label: 'Modify score' })

  await expect(page.locator('.action-param[type="number"]')).toBeVisible()
})

test('assign label action shows label select', async ({ page }) => {
  await openFilterManager(page)
  await page.getByRole('button', { name: 'New filter' }).click()

  const actionSelect = page.locator('.action-row .field-select').first()
  await actionSelect.selectOption({ label: 'Assign label' })

  await expect(page.locator('.action-param.field-select')).toBeVisible()
})
