import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getFeedTree, getStarredCount, getLabelCounts } from '@/api/feeds'
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
  const labelCounts = ref<Record<number, number>>({})

  async function loadTree() {
    loading.value = true
    try {
      tree.value = await getFeedTree()
    } finally {
      loading.value = false
    }
    await Promise.all([loadStarredCount(), loadLabelCounts()])
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

  async function loadLabelCounts() {
    labelCounts.value = await getLabelCounts()
  }

  // Applies an immediate local adjustment when a label is assigned/removed
  // from an article, so the sidebar count doesn't sit stale until the next
  // full loadTree() - mirrors why starredCountDelta exists, just applied
  // directly to the map since there's no separate "authoritative total" ref
  // to reconcile against here (the next loadLabelCounts() simply overwrites
  // this wholesale with fresh server data).
  function adjustLabelCount(labelId: number, delta: number) {
    const current = labelCounts.value[labelId] ?? 0
    labelCounts.value[labelId] = Math.max(0, current + delta)
  }

  function select(item: FeedSelection) {
    selection.value = item
  }

  return {
    tree, selection, loading, starredCount, labelCounts,
    loadTree, loadStarredCount, loadLabelCounts, adjustLabelCount, select,
  }
})
