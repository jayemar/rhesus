import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'fs'

// Load .env.playwright if present
try {
  const lines = readFileSync(new URL('.env.playwright', import.meta.url), 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && !(key in process.env)) process.env[key] = value
  }
} catch {
  // no .env.playwright - fall through to process.env
}

const baseURL = process.env['RHESUS_BASE_URL'] ?? 'http://localhost:3001'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
})
