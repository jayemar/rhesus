import { ref } from 'vue'
import { addFeed, editFeed, resolveSubscribeUrl, previewFeed, logFeedSubscribed } from '@/api/feeds'
import type { FeedPreview } from '@/api/feeds'
import { ApiError } from '@/api/client'
import { useFeedsStore } from '@/stores/feeds'

// Shared add-feed flow (URL -> resolve -> preview -> confirm with category/note
// -> subscribe), used both by the Feeds management page's inline form and the
// header's quick "Add feed" dialog, so both stay behaviorally identical rather
// than drifting apart as two independent copies of the same non-trivial logic.
export function useAddFeed(onSubscribed?: () => void | Promise<void>) {
  const feedsStore = useFeedsStore()

  const newFeedUrl = ref('')
  const adding = ref(false)
  const addError = ref<string | null>(null)
  const addSuccess = ref<string | null>(null)
  const feedChoices = ref<Record<string, string> | null>(null)

  const previewUrl = ref<string | null>(null)
  const previewLoading = ref(false)
  const previewError = ref<string | null>(null)
  const previewData = ref<FeedPreview | null>(null)

  function clearForm() {
    newFeedUrl.value = ''
    feedChoices.value = null
    addError.value = null
    addSuccess.value = null
  }

  async function subscribeToUrl(feedUrl: string, catId = 0, note = '') {
    adding.value = true
    addError.value = null
    addSuccess.value = null
    feedChoices.value = null
    try {
      const result = await addFeed(feedUrl, catId)
      if (result.code === 0) {
        addError.value = 'Already subscribed to that feed.'
      } else if (result.code === 1) {
        const trimmedNote = note.trim()
        if (result.feed_id) {
          if (trimmedNote) await editFeed(result.feed_id, { note: trimmedNote })
          await logFeedSubscribed(result.feed_id, trimmedNote)
        }
        newFeedUrl.value = ''
        addSuccess.value = `Feed added successfully: ${feedUrl}`
        setTimeout(() => { addSuccess.value = null }, 4000)
        await feedsStore.loadTree()
        await onSubscribed?.()
      } else if (result.code === 2) {
        addError.value = result.message ? `Invalid URL: ${result.message}` : 'Invalid URL.'
      } else if (result.code === 3) {
        addError.value = 'No feed found at that URL.'
      } else if (result.code === 4) {
        feedChoices.value = result.feeds ?? null
        if (!feedChoices.value) addError.value = 'Multiple feeds found - please use a direct feed URL.'
      } else if (result.code === 5) {
        addError.value = result.message ? `Could not fetch feed: ${result.message}` : 'Could not fetch feed.'
      } else if (result.code === 6) {
        addError.value = result.message ? `Feed could not be parsed: ${result.message}` : 'Feed content could not be parsed.'
      } else {
        addError.value = result.message ? `Error (code ${result.code}): ${result.message}` : `Error (code ${result.code}).`
      }
    } finally {
      adding.value = false
    }
  }

  async function startPreview(url: string) {
    previewUrl.value = url
    previewLoading.value = true
    previewError.value = null
    previewData.value = null
    try {
      previewData.value = await previewFeed(url)
    } catch (e) {
      if (e instanceof ApiError) {
        const messages: Record<string, string> = {
          'FETCH_FAILED':   'Could not fetch this feed.',
          'PARSE_FAILED':   'This does not look like a valid RSS/Atom feed.',
          'INVALID_URL':    'Invalid URL (must be http/https on a standard port, and not a private address).',
          'MISSING_URL':    'No URL provided.',
          'NOT_LOGGED_IN':  'Not logged in - please refresh and try again.',
          'API_DISABLED':   'API access is not enabled for this account.',
        }
        previewError.value = messages[e.code] ?? `Failed to preview feed: ${e.code}`
      } else {
        previewError.value = e instanceof Error ? e.message : 'Failed to preview feed.'
      }
    } finally {
      previewLoading.value = false
    }
  }

  function cancelPreview() {
    previewUrl.value = null
    previewData.value = null
    previewError.value = null
  }

  async function confirmAddFeed(catId: number, note: string) {
    const url = previewUrl.value
    cancelPreview()
    if (url) await subscribeToUrl(url, catId, note)
  }

  async function selectFeedChoice(url: string) {
    await startPreview(url)
  }

  async function submitAddFeed() {
    const raw = newFeedUrl.value.trim()
    if (!raw || adding.value) return
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    adding.value = true
    addError.value = null
    feedChoices.value = null
    try {
      const resolved = await resolveSubscribeUrl(url)
      await startPreview(resolved.url)
    } catch (e) {
      if (e instanceof ApiError) {
        const messages: Record<string, string> = {
          'UNKNOWN_FEED':       'No feed found at that URL.',
          'INVALID_URL':        'Invalid URL (must be http/https on a standard port, and not a private address).',
          'MISSING_URL':        'No URL provided.',
          'NOT_LOGGED_IN':      'Not logged in - please refresh and try again.',
          'API_DISABLED':       'API access is not enabled for this account.',
          'LOGIN_ERROR':        'Authentication failed.',
          'INCORRECT_USAGE':    'Unexpected error - this may be a bug in Rhesus.',
          'UNKNOWN_METHOD':     'Server configuration error: feed resolution unavailable (rhesus_settings plugin may not be active).',
          'E_OPERATION_FAILED': 'Operation failed on the server.',
          'E_NOT_FOUND':        'Resource not found.',
          'HTTP_ERROR':         'Network error contacting the server.',
        }
        const friendly = messages[e.code]
        addError.value = friendly ?? `Failed to add feed: ${e.code}`
      } else {
        addError.value = e instanceof Error ? `Failed to add feed: ${e.message}` : 'Failed to add feed.'
      }
    } finally {
      adding.value = false
    }
  }

  return {
    newFeedUrl, adding, addError, addSuccess, feedChoices,
    previewUrl, previewLoading, previewError, previewData,
    clearForm, submitAddFeed, confirmAddFeed, selectFeedChoice, cancelPreview,
  }
}
