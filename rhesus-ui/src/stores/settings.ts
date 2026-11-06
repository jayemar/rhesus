import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getUiSettings, setUiSettings } from '@/api/settings'
import { ApiError } from '@/api/client'
import { isSnoozeAvailable } from '@/api/snooze'
import { isSelfDestructAvailable } from '@/api/selfDestruct'
import { DEFAULT_SETTINGS, type UiSettings } from '@/types/api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UiSettings>({ ...DEFAULT_SETTINGS })
  const username = ref<string>('')
  const loaded = ref(false)
  const snoozeAvailable = ref(false)
  const selfDestructAvailable = ref(false)

  const FONT_FAMILY_MAP: Record<string, string> = {
    system: "system-ui, -apple-system, sans-serif",
    inter: "'Inter', sans-serif",
    nunito: "'Nunito', sans-serif",
    merriweather: "'Merriweather', serif",
    lora: "'Lora', serif",
  }

  let retryTimer: ReturnType<typeof setTimeout> | null = null

  async function load(attempt = 0) {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    try {
      const res = await getUiSettings()
      settings.value = { ...DEFAULT_SETTINGS, ...res.settings }
      username.value = res.user_name
      loaded.value = true
    } catch (e) {
      // Keep running on whatever's in memory (defaults on first load) so the
      // app stays usable, but leave `loaded` false: the auto-save watcher
      // sends the whole settings object, so arming it here would write these
      // defaults over the user's real stored settings on the first change.
      // NOT_LOGGED_IN sends the user to the login page instead, and AppShell
      // calls load() again when it remounts after they sign back in.
      if (!(e instanceof ApiError && e.code === 'NOT_LOGGED_IN')) {
        retryTimer = setTimeout(() => load(attempt + 1), Math.min(30_000, 1000 * 2 ** attempt))
      }
    }
    applyTheme(settings.value.theme)
    applyFont(settings.value.font_size, settings.value.font_family)
  }

  async function checkSnoozeAvailable() {
    snoozeAvailable.value = await isSnoozeAvailable()
  }

  async function checkSelfDestructAvailable() {
    selfDestructAvailable.value = await isSelfDestructAvailable()
  }

  async function save() {
    // Same reasoning as load()'s catch: never persist settings that weren't
    // loaded from the server first.
    if (!loaded.value) return
    await setUiSettings(settings.value)
    applyTheme(settings.value.theme)
    applyFont(settings.value.font_size, settings.value.font_family)
  }

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

  // Keep in sync with --color-bg in src/styles/variables.css.
  const THEME_COLORS = { dark: '#1a1a1a', light: '#f5f5f5' } as const

  function applyTheme(theme: 'dark' | 'light' | 'system') {
    const resolved = theme === 'system' ? (systemDark.matches ? 'dark' : 'light') : theme
    document.documentElement.setAttribute('data-theme', resolved)
    // index.html ships a static dark theme-color as the pre-JS fallback -
    // without this, Firefox/Android keep tinting the toolbar dark even
    // after the app resolves to light, since nothing else ever touches it.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
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

  return {
    settings,
    username,
    loaded,
    snoozeAvailable,
    selfDestructAvailable,
    load,
    save,
    checkSnoozeAvailable,
    checkSelfDestructAvailable,
  }
})
