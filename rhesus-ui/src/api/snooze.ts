import { call, ApiError } from './client'

export interface SnoozedArticle {
  article_id: number
  title: string
  link: string
  expires_at: string
}

// snooze_articles is an optional plugin - if it's not installed (or not
// registered as a system plugin), its API methods are simply never
// registered and TT-RSS returns UNKNOWN_METHOD for any call to them.
export async function isSnoozeAvailable(): Promise<boolean> {
  try {
    await getSnoozedArticles()
    return true
  } catch (e) {
    if (e instanceof ApiError && e.code === 'UNKNOWN_METHOD') return false
    return true
  }
}

export async function snoozeArticle(articleId: number, until: Date): Promise<void> {
  await call('snoozeArticle', { article_id: articleId, until: until.toISOString() })
}

export async function unsnoozeArticle(articleId: number): Promise<void> {
  await call('unsnoozeArticle', { article_id: articleId })
}

export async function updateSnoozeTime(articleId: number, until: Date): Promise<void> {
  await call('updateSnoozeTime', { article_id: articleId, until: until.toISOString() })
}

export async function getSnoozedArticles(): Promise<SnoozedArticle[]> {
  return call<SnoozedArticle[]>('getSnoozedArticles')
}
