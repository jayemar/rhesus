import { call } from './client'
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
  params: { title?: string; feed_url?: string; cat_id?: number; update_interval?: number },
): Promise<void> {
  await call('editFeed', { feed_id: feedId, ...params })
}

export async function importOpml(content: string): Promise<void> {
  await call('importOpml', { content })
}

export async function resolveSubscribeUrl(url: string): Promise<{ url: string; discovered: boolean }> {
  return call<{ url: string; discovered: boolean }>('resolveSubscribeUrl', { url })
}

export async function refreshFeed(feedId: number): Promise<void> {
  await call('updateFeed', { feed_id: feedId })
}
