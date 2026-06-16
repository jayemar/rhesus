import { call } from './client'
import type { ApiFeedTreeItem } from '@/types/api'

export async function getFeedTree(): Promise<ApiFeedTreeItem[]> {
  const res = await call<{ categories: { identifier: string; label: string; items: ApiFeedTreeItem[] } }>(
    'getFeedTree',
    { include_empty: false },
  )
  return res.categories.items ?? []
}
