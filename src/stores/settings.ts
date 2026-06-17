import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getUiSettings, setUiSettings } from '@/api/settings'
import { DEFAULT_SETTINGS, type UiSettings } from '@/types/api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UiSettings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)

  const FONT_FAMILY_MAP: Record<string, string> = {
    system: "system-ui, -apple-system, sans-serif",
    helvetica: "'Helvetica Neue', Arial, Helvetica, sans-serif",
    georgia: "Georgia, 'Times New Roman', serif",
    verdana: "Verdana, Geneva, sans-serif",
    palatino: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif",
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

  function applyTheme(theme: 'dark' | 'light') {
    document.documentElement.setAttribute('data-theme', theme)
  }

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
