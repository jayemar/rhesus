import { call } from './client'
import type { ApiArticle } from '@/types/api'

export interface GetHeadlinesOptions {
  feedId: number
  isCategory?: boolean
  limit?: number
  skip?: number
  sortOrder?: 'newest' | 'oldest'
  viewMode?: string
  dateSort?: 'retrieval' | 'publication'
}

export async function getHeadlines(opts: GetHeadlinesOptions): Promise<ApiArticle[]> {
  return call<ApiArticle[]>('getHeadlines', {
    feed_id: opts.feedId,
    is_cat: opts.isCategory ?? false,
    limit: opts.limit ?? 20,
    skip: opts.skip ?? 0,
    order_by: opts.feedId === -1
      ? 'last_marked_asc'
      : opts.dateSort === 'publication'
        ? (opts.sortOrder === 'oldest' ? 'date_reverse' : 'feed_dates')
        : (opts.sortOrder === 'oldest' ? 'date_entered_asc' : 'date_entered_desc'),
    show_excerpt: true,
    excerpt_length: 250,
    show_content: true,
    include_attachments: true,
    view_mode: opts.viewMode ?? 'all_articles',
    sanitize: false,
  })
}

export async function getArticle(id: number): Promise<ApiArticle> {
  const articles = await call<ApiArticle[]>('getArticle', { article_id: id })
  if (!articles[0]) throw new Error('Article not found')
  return articles[0]
}

export enum ArticleField {
  Starred = 0,
  Published = 1,
  Unread = 2,
  Note = 3,
}

export enum ArticleMode {
  False = 0,
  True = 1,
  Toggle = 2,
}

export async function updateArticle(
  ids: number[],
  field: ArticleField,
  mode: ArticleMode,
): Promise<void> {
  await call('updateArticle', {
    article_ids: ids.join(','),
    field,
    mode,
  })
}

export async function catchupFeed(feedId: number, isCategory: boolean): Promise<void> {
  await call('catchupFeed', { feed_id: feedId, is_cat: isCategory })
}
