import { call } from './client'
import type { UiSettings } from '@/types/api'

export async function getUiSettings(): Promise<UiSettings> {
  const res = await call<{ settings: UiSettings }>('getUiSettings')
  return res.settings
}

export async function setUiSettings(settings: UiSettings): Promise<void> {
  await call('setUiSettings', { settings: JSON.stringify(settings) })
}
