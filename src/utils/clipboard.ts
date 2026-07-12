// Android 13+ shows a system-level "Copied to clipboard" notification for ANY
// app/browser's clipboard write (both execCommand and navigator.clipboard) -
// it's an OS feature, not a Firefox quirk (the original fix here only tested
// Firefox and missed that Chrome hits the same OS toast), so our own toast is
// redundant on any Android 13+ browser.
function androidOsVersion(): number | null {
  const match = /Android (\d+)/.exec(navigator.userAgent)
  return match ? Number(match[1]) : null
}

export const browserShowsNativeToast = (androidOsVersion() ?? 0) >= 13

// Returns true if the copy was silent (caller should show its own notification).
// Returns false if the browser will show its own clipboard notification.
export async function writeToClipboard(text: string): Promise<boolean> {
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;'
  document.body.appendChild(el)
  el.focus()
  el.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(el)
  if (ok) return !browserShowsNativeToast
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return false
  }
  throw new Error('copy not supported')
}
