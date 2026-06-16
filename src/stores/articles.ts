import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getHeadlines, getArticle, updateArticle, catchupFeed, ArticleField, ArticleMode } from '@/api/articles'
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

  const PAGE_SIZE = 200
  const currentViewMode = ref<string>('all_articles')

  const settingsStore = useSettingsStore()

  const sortOrder = computed<'newest' | 'oldest'>(() =>
    !currentIsCategory.value && currentFeedId.value === -4 && currentViewMode.value === 'all_articles'
      ? 'newest'
      : 'oldest'
  )

  async function load(feedId: number, isCategory: boolean, viewMode = 'all_articles') {
    currentFeedId.value = feedId
    currentIsCategory.value = isCategory
    currentViewMode.value = viewMode
    selectedId.value = null
    loading.value = true
    hasMore.value = true
    articles.value = []
    try {
      const results = await getHeadlines({
        feedId, isCategory, limit: PAGE_SIZE, skip: 0, sortOrder: sortOrder.value, viewMode,
        dateSort: settingsStore.settings.date_sort,
      })
      articles.value = results
      hasMore.value = results.length === PAGE_SIZE
    } catch (err) {
      console.error('load failed', feedId, err)
      hasMore.value = false
    } finally {
      loading.value = false
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
    if (article) article.unread = !read
    updateArticle([id], ArticleField.Unread, read ? ArticleMode.False : ArticleMode.True)
      .catch((err) => console.error('markRead failed', id, err))
  }

  function markReadBatch(ids: number[]) {
    for (const id of ids) {
      const article = articles.value.find((a) => a.id === id)
      if (article) article.unread = false
    }
    updateArticle(ids, ArticleField.Unread, ArticleMode.False)
      .catch((err) => console.error('markReadBatch failed', ids, err))
  }

  function toggleStar(id: number) {
    const article = articles.value.find((a) => a.id === id)
    if (article) {
      article.marked = !article.marked
      updateArticle([id], ArticleField.Starred, article.marked ? ArticleMode.True : ArticleMode.False)
    }
  }

  async function markAllRead(feedId: number, isCategory: boolean) {
    await catchupFeed(feedId, isCategory)
    articles.value.forEach((a) => (a.unread = false))
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
    articles, selectedId, loading, loadingMore, hasMore, currentViewMode, sortOrder,
    load, loadMore, fetchContent, markRead, markReadBatch, toggleStar, markAllRead, select,
  }
})
