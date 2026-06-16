import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getFeedTree } from '@/api/feeds'
import type { ApiFeedTreeItem } from '@/types/api'

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

  async function loadTree() {
    loading.value = true
    try {
      tree.value = await getFeedTree()
    } finally {
      loading.value = false
    }
  }

  function select(item: FeedSelection) {
    selection.value = item
  }

  return { tree, selection, loading, loadTree, select }
})
