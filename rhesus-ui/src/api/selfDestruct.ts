import { call, ApiError } from './client'

export interface SelfDestructedArticle {
  article_id: number
  title: string
  link: string
  expires_at: string
}

// self_destruct_articles is an optional plugin - if it's not installed (or
// not registered as a system plugin), its API methods are simply never
// registered and TT-RSS returns UNKNOWN_METHOD for any call to them.
export async function isSelfDestructAvailable(): Promise<boolean> {
  try {
    await getSelfDestructArticles()
    return true
  } catch (e) {
    if (e instanceof ApiError && e.code === 'UNKNOWN_METHOD') return false
    return true
  }
}

export async function selfDestructArticle(articleId: number, until: Date): Promise<void> {
  await call('selfDestructArticle', { article_id: articleId, until: until.toISOString() })
}

export async function cancelSelfDestruct(articleId: number): Promise<void> {
  await call('cancelSelfDestruct', { article_id: articleId })
}

export async function destroySelfDestructNow(articleId: number): Promise<void> {
  await call('destroySelfDestructNow', { article_id: articleId })
}

export async function updateSelfDestructTime(articleId: number, until: Date): Promise<void> {
  await call('updateSelfDestructTime', { article_id: articleId, until: until.toISOString() })
}

export async function getSelfDestructArticles(): Promise<SelfDestructedArticle[]> {
  return call<SelfDestructedArticle[]>('getSelfDestructArticles')
}
