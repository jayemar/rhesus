import { defineStore } from 'pinia'
import { computed, ref, watchEffect } from 'vue'
import { getFeedTree, getStarredCount, getLabelCounts, getAllArticlesCount, getCounters } from '@/api/feeds'
import type { ApiFeedTreeItem } from '@/types/api'
import { useArticlesStore } from './articles'

function findInTree(items: ApiFeedTreeItem[], bareId: number): ApiFeedTreeItem | undefined {
  for (const item of items) {
    if (item.bare_id === bareId) return item
    if (item.items) {
      const found = findInTree(item.items, bareId)
      if (found) return found
    }
  }
  return undefined
}

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
  const allArticlesCount = ref(0)
  // Real per-feed/per-category unread counts from getCounters() - see that
  // function's doc comment for why this can't just be read off getFeedTree's
  // own "unread" field for ordinary feeds/categories.
  const feedCounters = ref<Record<number, number>>({})
  const categoryCounters = ref<Record<number, number>>({})

  async function loadTree() {
    loading.value = true
    try {
      tree.value = await getFeedTree()
    } finally {
      loading.value = false
    }
    await Promise.all([loadStarredCount(), loadLabelCounts(), loadAllArticlesCount(), loadFeedCounters()])
  }

  async function loadFeedCounters() {
    const counters = await getCounters()
    feedCounters.value = counters.feeds
    categoryCounters.value = counters.categories
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

  async function loadAllArticlesCount() {
    allArticlesCount.value = await getAllArticlesCount()
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

  // The single source of truth for "how many unread articles does the
  // currently-selected feed/category have", shared by both the header
  // (AppShell.vue) and the sidebar row for that same selection
  // (FeedTree.vue) - they used to compute this independently (the header
  // applying articlesStore's optimistic readCountDelta/starredCountDelta,
  // the sidebar only ever showing the raw last-fetched server count) and
  // could visibly disagree for as long as it took the next loadTree() to
  // land. Centralizing it here means there's only one place this logic can
  // drift from the other.
  const baseServerUnread = ref(0)

  watchEffect(() => {
    const sel = selection.value
    const articlesStore = useArticlesStore()
    if (!sel) { baseServerUnread.value = 0; return }
    // Starred is a total-count feed (see starredCount below), not an
    // unread-count one like every other feed, so this can't come from the
    // regular counters lookup below.
    if (sel.id === -1 && !sel.isCategory) {
      baseServerUnread.value = starredCount.value
      return
    }
    // getFeedTree's own "unread" field is a real number only for the
    // hardcoded virtual feeds under "Special" - for every ordinary feed or
    // user category it's a bogus -1 sentinel (confirmed directly against a
    // live server response). feedCounters/categoryCounters (from the
    // dedicated getCounters() call) carry the real numbers TT-RSS's own web
    // client cross-references instead. Feed and category ids share the same
    // positive-integer namespace, so which map to check depends on
    // sel.isCategory.
    const real = sel.isCategory ? categoryCounters.value[sel.id] : feedCounters.value[sel.id]
    if (real !== undefined) {
      baseServerUnread.value = real
      articlesStore.readCountDelta = 0
      return
    }
    // Fallback for anything getCounters() hasn't caught up with yet (e.g. a
    // feed subscribed moments ago, before the next counters refresh).
    const node = findInTree(tree.value, sel.id)
    if (node && node.unread >= 0) {
      baseServerUnread.value = node.unread
      articlesStore.readCountDelta = 0
    }
  })

  const selectedUnreadCount = computed(() => {
    const articlesStore = useArticlesStore()
    const sel = selection.value
    if (sel?.id === -1 && !sel.isCategory) {
      return Math.max(0, baseServerUnread.value + articlesStore.starredCountDelta)
    }
    return Math.max(0, baseServerUnread.value - articlesStore.readCountDelta)
  })

  return {
    tree, selection, loading, starredCount, labelCounts, allArticlesCount, feedCounters, categoryCounters,
    selectedUnreadCount,
    loadTree, loadStarredCount, loadLabelCounts, loadAllArticlesCount, loadFeedCounters, adjustLabelCount, select,
  }
})
