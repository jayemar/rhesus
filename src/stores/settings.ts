import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getUiSettings, setUiSettings } from '@/api/settings'
import { DEFAULT_SETTINGS, type UiSettings } from '@/types/api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UiSettings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)

  const FONT_FAMILY_MAP: Record<string, string> = {
    system: "system-ui, -apple-system, sans-serif",
    inter: "'Inter', sans-serif",
    nunito: "'Nunito', sans-serif",
    merriweather: "'Merriweather', serif",
    lora: "'Lora', serif",
  }

  async function load() {
    try {
      settings.value = { ...DEFAULT_SETTINGS, ...(await getUiSettings()) }
    } catch {
      settings.value = { ...DEFAULT_SETTINGS }
    }
    loaded.value = true
    applyTheme(settings.value.theme)
    applyFont(settings.value.font_size, settings.value.font_family)
  }

  async function save() {
    await setUiSettings(settings.value)
    applyTheme(settings.value.theme)
    applyFont(settings.value.font_size, settings.value.font_family)
  }

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

  function applyTheme(theme: 'dark' | 'light' | 'system') {
    const resolved = theme === 'system' ? (systemDark.matches ? 'dark' : 'light') : theme
    document.documentElement.setAttribute('data-theme', resolved)
  }

  systemDark.addEventListener('change', () => {
    if (settings.value.theme === 'system') applyTheme('system')
  })

  function applyFont(size: number, family: string) {
    const root = document.documentElement
    root.style.setProperty('--font-size-base', `${size}px`)
    root.style.setProperty('--font-size-sm', `${size - 2}px`)
    root.style.setProperty('--font-size-lg', `${size + 2}px`)
    root.style.setProperty('--font-size-xl', `${size + 4}px`)
    root.style.setProperty('--font-body', FONT_FAMILY_MAP[family] ?? "system-ui, -apple-system, sans-serif")
  }

  watch(
    () => settings.value.theme,
    (t) => applyTheme(t),
  )

  watch(
    () => [settings.value.font_size, settings.value.font_family] as const,
    ([size, family]) => applyFont(size, family),
  )

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  watch(
    settings,
    () => {
      if (!loaded.value) return
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => setUiSettings(settings.value), 500)
    },
    { deep: true },
  )

  return { settings, loaded, load, save }
})
