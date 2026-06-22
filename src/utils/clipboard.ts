// Firefox for Android shows a system-level "Copied" notification for ALL clipboard
// writes (both execCommand and navigator.clipboard), so our own toast is redundant there.
const browserShowsNativeToast =
  /Firefox\/\d/.test(navigator.userAgent) && /Android/i.test(navigator.userAgent)

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
