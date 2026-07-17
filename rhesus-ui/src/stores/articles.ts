import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getHeadlines, getArticle, updateArticle, ArticleField, ArticleMode } from '@/api/articles'
import { useSettingsStore } from '@/stores/settings'
import type { ApiArticle } from '@/types/api'

export const useArticlesStore = defineStore('articles', () => {
  const articles = ref<ApiArticle[]>([])
  const selectedId = ref<number | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = ref(true)
  const currentFeedId = ref<number | null>(null)
  const currentIsCategory = ref(false)
  const readCountDelta = ref(0)
  const starredCountDelta = ref(0)

  const PAGE_SIZE = 200
  const currentViewMode = ref<string>('all_articles')
  const currentSearch = ref('')

  const settingsStore = useSettingsStore()

  const sortOrder = computed<'newest' | 'oldest'>(() =>
    !currentIsCategory.value && currentFeedId.value === -4 && currentViewMode.value === 'unread'
      ? 'oldest'
      : 'newest'
  )

  async function load(feedId: number, isCategory: boolean, viewMode = 'all_articles', search = '') {
    currentFeedId.value = feedId
    currentIsCategory.value = isCategory
    currentViewMode.value = viewMode
    currentSearch.value = search
    selectedId.value = null
    loading.value = true
    hasMore.value = true
    readCountDelta.value = 0
    articles.value = []
    try {
      const results = await getHeadlines({
        feedId, isCategory, limit: PAGE_SIZE, skip: 0, sortOrder: sortOrder.value, viewMode,
        dateSort: settingsStore.settings.date_sort, search,
      })
      articles.value = results
      hasMore.value = results.length === PAGE_SIZE
    } catch (err) {
      console.error('load failed', feedId, err)
      hasMore.value = false
    } finally {
      loading.value = false
    }
    if (viewMode === 'unread' && hasMore.value) {
      void loadAllPages(feedId, isCategory, viewMode)
    }
  }

  async function loadAllPages(feedId: number, isCategory: boolean, viewMode: string) {
    const search = currentSearch.value
    while (hasMore.value) {
      if (
        currentFeedId.value !== feedId ||
        currentIsCategory.value !== isCategory ||
        currentViewMode.value !== viewMode ||
        currentSearch.value !== search
      ) return
      await loadMore()
    }
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value || currentFeedId.value === null) return
    loadingMore.value = true
    try {
      const results = await getHeadlines({
        feedId: currentFeedId.value,
        isCategory: currentIsCategory.value,
        limit: PAGE_SIZE,
        skip: articles.value.length,
        sortOrder: sortOrder.value,
        viewMode: currentViewMode.value,
        dateSort: settingsStore.settings.date_sort,
        search: currentSearch.value,
      })
      articles.value.push(...results)
      hasMore.value = results.length === PAGE_SIZE
    } finally {
      loadingMore.value = false
    }
  }

  async function fetchContent(id: number) {
    const full = await getArticle(id)
    const idx = articles.value.findIndex((a) => a.id === id)
    if (idx !== -1) {
      articles.value[idx] = { ...articles.value[idx]!, content: full.content }
    }
  }

  function markRead(id: number, read: boolean) {
    const article = articles.value.find((a) => a.id === id)
    if (article) {
      if (read && article.unread) readCountDelta.value++
      else if (!read && !article.unread) readCountDelta.value--
      article.unread = !read
    }
    updateArticle([id], ArticleField.Unread, read ? ArticleMode.False : ArticleMode.True)
      .catch((err) => console.error('markRead failed', id, err))
  }

  function markReadBatch(ids: number[]) {
    for (const id of ids) {
      const article = articles.value.find((a) => a.id === id)
      if (article && article.unread) {
        article.unread = false
        readCountDelta.value++
      }
    }
    updateArticle(ids, ArticleField.Unread, ArticleMode.False)
      .catch((err) => console.error('markReadBatch failed', ids, err))
  }

  function toggleStar(id: number) {
    const article = articles.value.find((a) => a.id === id)
    if (article) {
      article.marked = !article.marked
      starredCountDelta.value += article.marked ? 1 : -1
      updateArticle([id], ArticleField.Starred, article.marked ? ArticleMode.True : ArticleMode.False)
    }
  }

  function setNote(id: number, note: string) {
    const article = articles.value.find((a) => a.id === id)
    if (article) article.note = note
  }

  function setLabels(id: number, labels: [number, string, string, string][]) {
    const article = articles.value.find((a) => a.id === id)
    if (article) article.labels = labels
  }

  async function markAllRead() {
    const ids = articles.value.filter((a) => a.unread).map((a) => a.id)
    if (ids.length === 0) return
    readCountDelta.value += ids.length
    articles.value.forEach((a) => { if (a.unread) a.unread = false })
    try {
      await updateArticle(ids, ArticleField.Unread, ArticleMode.False)
    } catch (err) {
      console.error('markAllRead failed', err)
    }
  }

  async function appendNew(): Promise<number> {
    if (!articles.value.length || currentFeedId.value === null) return 0
    const sinceId = articles.value.reduce((max, a) => Math.max(max, a.id), 0)
    loadingMore.value = true
    try {
      const results = await getHeadlines({
        feedId: currentFeedId.value,
        isCategory: currentIsCategory.value,
        limit: PAGE_SIZE,
        skip: 0,
        sortOrder: sortOrder.value,
        viewMode: currentViewMode.value,
        dateSort: settingsStore.settings.date_sort,
        sinceId,
      })
      if (results.length === 0) return 0
      const existingIds = new Set(articles.value.map((a) => a.id))
      const newOnes = results.filter((a) => !existingIds.has(a.id))
      articles.value.push(...newOnes)
      return newOnes.length
    } catch (err) {
      console.error('appendNew failed', err)
      return 0
    } finally {
      loadingMore.value = false
    }
  }

  function select(id: number | null) {
    selectedId.value = id
    if (id !== null) {
      const article = articles.value.find((a) => a.id === id)
      if (article?.unread) markRead(id, true)
      if (!article?.content) fetchContent(id)
    }
  }

  return {
    articles, selectedId, loading, loadingMore, hasMore, currentViewMode, sortOrder, readCountDelta, starredCountDelta,
    load, loadMore, fetchContent, markRead, markReadBatch, toggleStar, markAllRead, appendNew, select, setNote, setLabels,
  }
})
