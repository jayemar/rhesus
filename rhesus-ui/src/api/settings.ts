import { call } from './client'
import type { UiSettings } from '@/types/api'

export async function getUiSettings(): Promise<{ settings: UiSettings; user_name: string }> {
  return call<{ settings: UiSettings; user_name: string }>('getUiSettings')
}

export async function setUiSettings(settings: UiSettings): Promise<void> {
  await call('setUiSettings', { settings: JSON.stringify(settings) })
}
