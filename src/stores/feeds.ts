import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getFeedTree, getStarredCount } from '@/api/feeds'
import type { ApiFeedTreeItem } from '@/types/api'
import { useArticlesStore } from './articles'

export interface FeedSelection {
  id: number
  isCategory: boolean
  title: string
  viewMode?: string
}

export const useFeedsStore = defineStore('feeds', () => {
  const tree = ref<ApiFeedTreeItem[]>([])
  const selection = ref<FeedSelection | null>(null)
  const loading = ref(false)
  const starredCount = ref(0)

  async function loadTree() {
    loading.value = true
    try {
      tree.value = await getFeedTree()
    } finally {
      loading.value = false
    }
    await loadStarredCount()
  }

  // starredCount is the authoritative server total; articlesStore's
  // starredCountDelta reflects star/unstar actions taken since the last
  // load, ahead of a fresh fetch. Once a fresh total arrives, that delta's
  // job is done and must be reset here - otherwise it keeps adjusting the
  // NEXT fresh total too (same class of bug as readCountDelta).
  async function loadStarredCount() {
    starredCount.value = await getStarredCount()
    useArticlesStore().starredCountDelta = 0
  }

  function select(item: FeedSelection) {
    selection.value = item
  }

  return { tree, selection, loading, starredCount, loadTree, loadStarredCount, select }
})
