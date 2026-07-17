import { call, getSid, ApiError } from './client'
import type { ApiFeedTreeItem, ApiFeed, ApiCategory } from '@/types/api'

export async function getFeedTree(): Promise<ApiFeedTreeItem[]> {
  const res = await call<{ categories: { identifier: string; label: string; items: ApiFeedTreeItem[] } }>(
    'getFeedTree',
    { include_empty: false },
  )
  return res.categories.items ?? []
}

export async function getAllFeeds(): Promise<ApiFeed[]> {
  return call<ApiFeed[]>('getFeeds', { cat_id: -3, unread_only: false, include_nested: false })
}

export async function getStarredCount(): Promise<number> {
  const res = await call<{ count: number }>('getStarredCount')
  return res.count
}

export async function getLabelCounts(): Promise<Record<number, number>> {
  const res = await call<{ counts: Record<number, number> }>('getLabelCounts')
  return res.counts
}

export async function getAllArticlesCount(): Promise<number> {
  const res = await call<{ count: number }>('getAllArticlesCount')
  return res.count
}

export async function getAllCategories(): Promise<ApiCategory[]> {
  return call<ApiCategory[]>('getCategories', { include_empty: true })
}

export async function deleteFeed(feedId: number): Promise<void> {
  await call('unsubscribeFeed', { feed_id: feedId })
}

export interface SubscribeResult {
  code: number
  feed_id?: number
  message?: string
  feeds?: Record<string, string>
}

export async function addFeed(feedUrl: string, categoryId: number): Promise<SubscribeResult> {
  const res = await call<{ status: SubscribeResult }>('subscribeToFeed', { feed_url: feedUrl, category_id: categoryId })
  return res.status
}

export async function editFeed(
  feedId: number,
  params: { title?: string; feed_url?: string; cat_id?: number; update_interval?: number; note?: string },
): Promise<void> {
  await call('editFeed', { feed_id: feedId, ...params })
}

export async function getFeedNotes(): Promise<Record<number, string>> {
  const res = await call<{ notes: Record<number, string> }>('getFeedNotes')
  return res.notes ?? {}
}

// Uses a standalone endpoint rather than the JSON API's call() helper: the
// sid-token API only accepts JSON bodies, but a file upload needs
// multipart/form-data. See rhesus_settings/upload_icon.php for why this is
// its own script rather than a plugin API method.
export async function uploadFeedIcon(feedId: number, file: File): Promise<void> {
  const sid = getSid()
  const fd = new FormData()
  if (sid) fd.append('sid', sid)
  fd.append('feed_id', String(feedId))
  fd.append('icon_file', file)

  const res = await fetch('/tt-rss/plugins.local/rhesus_settings/upload_icon.php', {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) {
    throw new ApiError('HTTP_ERROR', `HTTP ${res.status}`)
  }
  const json = await res.json()
  if (json.status !== 0) {
    throw new ApiError(json.content?.error ?? 'UNKNOWN_ERROR', json.content?.detected_type)
  }
}

export async function removeFeedIcon(feedId: number): Promise<void> {
  await call('removeFeedIcon', { feed_id: feedId })
}

// Alternative to uploadFeedIcon() for when you have a link to an icon
// rather than a local file - the server fetches the URL itself (see
// rhesus_settings's fetchIconFromUrl(), including why this can't just be a
// browser-side fetch() of the URL: most icon hosts don't send CORS headers
// permitting cross-origin reads).
export async function fetchIconFromUrl(feedId: number, url: string): Promise<void> {
  await call('fetchIconFromUrl', { feed_id: feedId, url })
}

export async function importOpml(content: string): Promise<void> {
  await call('importOpml', { content })
}

export async function resolveSubscribeUrl(url: string): Promise<{ url: string; discovered: boolean }> {
  return call<{ url: string; discovered: boolean }>('resolveSubscribeUrl', { url })
}

export interface FeedPreviewItem {
  title: string
  link: string
  date: number | null
  description: string
}

export interface FeedPreview {
  title: string
  link: string
  items: FeedPreviewItem[]
}

export async function previewFeed(url: string): Promise<FeedPreview> {
  return call<FeedPreview>('previewFeed', { url })
}

export async function refreshFeed(feedId: number): Promise<void> {
  await call('updateFeed', { feed_id: feedId })
}

// Logs a subscribe event to the feed_subscription_log plugin, reusing
// whatever note was already entered in the Add Feed flow - see
// feed_subscription_log/init.php's logFeedSubscribed().
export async function logFeedSubscribed(feedId: number, note?: string): Promise<void> {
  await call('logFeedSubscribed', { feed_id: feedId, note: note ?? '' })
}

// Stashes an unsubscribe reason/note so feed_subscription_log's
// hook_unsubscribe_feed() can pick it up when the subsequent unsubscribeFeed
// call triggers it - see feed_subscription_log/init.php's logUnsubscribeReason().
export async function logUnsubscribeReason(feedId: number, reason?: string, note?: string): Promise<void> {
  await call('logUnsubscribeReason', { feed_id: feedId, reason: reason ?? '', note: note ?? '' })
}
