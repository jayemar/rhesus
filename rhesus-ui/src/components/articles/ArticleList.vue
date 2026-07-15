<template>
  <div class="article-list" ref="listEl" :style="pullVisualPx > 0 ? { transform: `translateY(${-pullVisualPx.toFixed(1)}px)` } : {}">
    <div v-if="props.showSearch && feedsStore.selection && !articlesStore.loading" class="search-bar">
      <Search :size="13" class="search-icon" />
      <input
        ref="searchInputEl"
        v-model="searchQuery"
        class="search-input"
        type="text"
        placeholder="Search articles..."
        autocomplete="off"
        autocapitalize="off"
        @keydown.esc="closeSearch"
      />
      <button class="search-clear" type="button" @click="closeSearch">
        <X :size="12" />
      </button>
    </div>
    <div v-if="articlesStore.loading" class="state-msg">Loading...</div>
    <div v-else-if="!feedsStore.selection" class="state-msg">Select a feed to read</div>
    <div v-else-if="articles.length === 0" class="state-msg">No articles</div>
    <template v-else>
      <div v-if="searchQuery && filteredArticles.length === 0" class="state-msg">No articles matching "{{ searchQuery }}"</div>
      <ArticleCard
        v-for="article in filteredArticles"
        :key="article.id"
        :article="article"
        :is-selected="selectedId === article.id"
        :force-highlight="(feedsStore.selection?.id === -1 || feedsStore.selection?.id === -6) && !feedsStore.selection?.isCategory"
        @select="toggleArticle(article.id)"
        @copied="(label) => emit('copied', label)"
      />
      <div v-if="articlesStore.loadingMore" class="state-msg state-msg--sm">Loading more...</div>
      <div v-else-if="!articlesStore.hasMore && articles.length > 0" class="state-msg state-msg--sm">
        End of feed
      </div>
      <div ref="sentinelEl" class="sentinel" />
    </template>
  </div>
  <Transition name="pull-fade">
    <div v-if="feedsStore.selection && !articlesStore.loading && pullUpDist > 0" class="pull-up-indicator" :class="{ ready: pullUpReady }">
      <ChevronUp :size="14" class="pull-icon" />
      <span>{{ pullActionLabel }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { ChevronUp, Search, X } from 'lucide-vue-next'
import { useFeedsStore } from '@/stores/feeds'
import { useArticlesStore } from '@/stores/articles'
import { useSettingsStore } from '@/stores/settings'
import type { UiSettings } from '@/types/api'
import ArticleCard from './ArticleCard.vue'

const props = defineProps<{ showSearch?: boolean }>()
const emit = defineEmits<{ copied: [label: string], 'close-search': [] }>()

const router = useRouter()
const feedsStore = useFeedsStore()
const articlesStore = useArticlesStore()
const settingsStore = useSettingsStore()
const { articles, selectedId } = storeToRefs(articlesStore)

const { settings } = storeToRefs(settingsStore)

const listEl = ref<HTMLElement | null>(null)
const sentinelEl = ref<HTMLElement | null>(null)
const searchInputEl = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')

const filteredArticles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return articles.value
  return articles.value.filter((a) =>
    a.title.toLowerCase().includes(q) || a.link.toLowerCase().includes(q)
  )
})

watch(() => props.showSearch, (show) => {
  if (!show) { searchQuery.value = ''; return }
  nextTick(() => searchInputEl.value?.focus())
})

watch(() => feedsStore.selection, () => { searchQuery.value = '' })

function closeSearch() {
  searchQuery.value = ''
  emit('close-search')
}

let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && articlesStore.hasMore && !articlesStore.loadingMore) {
        articlesStore.loadMore()
      }
    },
    { rootMargin: '400px' },
  )
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('wheel', onWheel, { passive: true })
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true })
})

watch(sentinelEl, (el, prevEl) => {
  if (prevEl) observer?.unobserve(prevEl)
  if (el) observer?.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
  if (wheelResetTimer) clearTimeout(wheelResetTimer)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('wheel', onWheel)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
})

// Scroll to top when the selected feed changes
watch(() => feedsStore.selection, () => {
  window.scrollTo(0, 0)
  lastScrollTop = 0
})

// Mark-on-scroll
let lastScrollTop = 0

const articleById = computed(() => new Map(articles.value.map((a) => [a.id, a])))

function onScroll() {
  if (!settings.value.mark_on_scroll) return
  const scrollY = window.scrollY
  const scrollingDown = scrollY > lastScrollTop
  lastScrollTop = scrollY
  if (!scrollingDown) return

  const cutoff = 100
  const map = articleById.value
  const toMark: number[] = []
  for (const cardEl of document.querySelectorAll('[data-id]')) {
    const rect = cardEl.getBoundingClientRect()
    if (rect.bottom >= cutoff) break
    const id = parseInt((cardEl as HTMLElement).dataset['id']!, 10)
    const article = map.get(id)
    if (article?.unread && id !== selectedId.value) {
      toMark.push(id)
    }
  }
  if (toMark.length > 0) articlesStore.markReadBatch(toMark)
}

function toggleArticle(id: number) {
  articlesStore.select(selectedId.value === id ? null : id)
}

// Pull-up-to-action: wheel overscroll on desktop, touch swipe on mobile
const pullUpDist = ref(0)
// Visual offset for the list transform. Kept separate from pullUpDist (the
// normalized 0-1 progress used for the ready threshold/label) so touch drags
// can track the finger 1:1 instead of a small fixed nudge.
const pullVisualPx = ref(0)
const PULL_WHEEL = 300
const PULL_TOUCH = window.innerHeight * 0.2

const pullUpReady = computed(() => pullUpDist.value >= 1)
const pullActionLabel = computed(() =>
  pullUpReady.value ? 'Release to mark all read' : 'Pull up to mark all read'
)

function isAtBottom(): boolean {
  return document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 8
}

// Where to send the user when a pull-to-refresh finds no new articles.
const EMPTY_REFRESH_TARGETS: Record<
  Exclude<UiSettings['empty_refresh_target'], 'none'>,
  { id: number; viewMode?: string }
> = {
  starred: { id: -1 },
  unread: { id: -4, viewMode: 'unread' },
  all_articles: { id: -4 },
  published: { id: -2 },
  recently_read: { id: -6 },
}

// Matches the option labels in SettingsPanel.vue's "empty_refresh_target" select.
const EMPTY_REFRESH_TARGET_LABELS: Record<Exclude<UiSettings['empty_refresh_target'], 'none'>, string> = {
  starred: 'Starred articles',
  unread: 'Unread articles',
  all_articles: 'All articles',
  published: 'Published articles',
  recently_read: 'Recently read',
}

function goToEmptyRefreshFallback() {
  const target = settings.value.empty_refresh_target
  if (target === 'none') return
  const dest = EMPTY_REFRESH_TARGETS[target]
  const sel = feedsStore.selection
  if (sel && !sel.isCategory && sel.id === dest.id && (sel.viewMode ?? undefined) === dest.viewMode) return
  router.replace({ name: 'feed', params: { id: String(dest.id) }, query: dest.viewMode ? { viewMode: dest.viewMode } : {} })
  emit('copied', `No new articles. Showing ${EMPTY_REFRESH_TARGET_LABELS[target]}.`)
}

async function executePullAction() {
  pullUpDist.value = 0
  pullVisualPx.value = 0
  const sel = feedsStore.selection
  if (!sel || articlesStore.loading) return
  await articlesStore.markAllRead()
  const added = await articlesStore.appendNew()
  await feedsStore.loadTree()
  if (added === 0) goToEmptyRefreshFallback()
}

let wheelAccum = 0
let wheelResetTimer: ReturnType<typeof setTimeout> | null = null

function onWheel(e: WheelEvent) {
  if (!feedsStore.selection || !isAtBottom() || e.deltaY <= 0) {
    if (wheelAccum > 0 || pullUpDist.value > 0) {
      wheelAccum = 0
      pullUpDist.value = 0
      pullVisualPx.value = 0
    }
    return
  }
  const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY
  wheelAccum += delta
  pullUpDist.value = Math.min(wheelAccum / PULL_WHEEL, 1)
  pullVisualPx.value = pullUpDist.value * 20
  if (wheelResetTimer) clearTimeout(wheelResetTimer)
  wheelResetTimer = setTimeout(() => {
    wheelAccum = 0
    pullUpDist.value = 0
    pullVisualPx.value = 0
  }, 600)
  if (pullUpDist.value >= 1) {
    if (wheelResetTimer) clearTimeout(wheelResetTimer)
    wheelResetTimer = null
    wheelAccum = 0
    executePullAction()
  }
}

let touchStartY = 0
let touchAtBottom = false

function onTouchStart(e: TouchEvent) {
  touchAtBottom = isAtBottom()
  touchStartY = e.touches[0]?.clientY ?? 0
}

function onTouchMove(e: TouchEvent) {
  if (!touchAtBottom || !feedsStore.selection) return
  const dy = touchStartY - (e.touches[0]?.clientY ?? touchStartY)
  pullUpDist.value = dy > 0 ? Math.min(dy / PULL_TOUCH, 1) : 0
  // Track the finger 1:1 (capped at the threshold distance) instead of a
  // fixed small nudge, so the list visually follows the drag.
  pullVisualPx.value = dy > 0 ? Math.min(dy, PULL_TOUCH) : 0
}

function onTouchEnd() {
  if (feedsStore.selection && pullUpDist.value >= 1) {
    executePullAction()
  } else {
    pullUpDist.value = 0
    pullVisualPx.value = 0
  }
  touchAtBottom = false
}
</script>

<style scoped>
.article-list {
  min-height: calc(100dvh - var(--topbar-height));
  background: var(--color-bg);
  transition: transform 0.15s ease-out;
}

.search-bar {
  position: sticky;
  top: var(--topbar-height);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.search-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  flex-shrink: 0;
  padding: 2px;
  border-radius: 2px;
  transition: color var(--transition-fast);
}

.search-clear:hover {
  color: var(--color-text-primary);
}

.state-msg {
  padding: 48px 16px;
  text-align: center;
  color: var(--color-text-muted);
}

.state-msg--sm {
  padding: 16px;
  font-size: var(--font-size-sm);
}

.sentinel {
  height: 1px;
}

.pull-up-indicator {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  background: linear-gradient(to bottom, transparent, var(--color-bg) 40%);
  pointer-events: none;
  transition: color var(--transition-fast);
}

.pull-up-indicator.ready {
  color: var(--color-accent);
}

.pull-icon {
  transition: transform 0.15s;
}

.pull-up-indicator.ready .pull-icon {
  transform: translateY(-4px);
}

.pull-fade-enter-active,
.pull-fade-leave-active {
  transition: opacity 0.15s;
}

.pull-fade-enter-from,
.pull-fade-leave-to {
  opacity: 0;
}
</style>
