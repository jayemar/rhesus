<template>
  <div class="article-list" ref="listEl" :style="pullUpDist > 0 ? { transform: `translateY(${-(pullUpDist * 20).toFixed(1)}px)` } : {}">
    <div v-if="articlesStore.loading" class="state-msg">Loading...</div>
    <div v-else-if="!feedsStore.selection" class="state-msg">Select a feed to read</div>
    <div v-else-if="articles.length === 0" class="state-msg">No articles</div>
    <template v-else>
      <ArticleCard
        v-for="article in articles"
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
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ChevronUp } from 'lucide-vue-next'
import { useFeedsStore } from '@/stores/feeds'
import { useArticlesStore } from '@/stores/articles'
import { useSettingsStore } from '@/stores/settings'
import ArticleCard from './ArticleCard.vue'

const emit = defineEmits<{ copied: [label: string] }>()

const feedsStore = useFeedsStore()
const articlesStore = useArticlesStore()
const settingsStore = useSettingsStore()
const { articles, selectedId } = storeToRefs(articlesStore)

const { settings } = storeToRefs(settingsStore)

const listEl = ref<HTMLElement | null>(null)
const sentinelEl = ref<HTMLElement | null>(null)

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
      article.unread = false
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
const PULL_WHEEL = 300
const PULL_TOUCH = window.innerHeight * 0.2

const pullUpReady = computed(() => pullUpDist.value >= 1)
const pullActionLabel = computed(() =>
  pullUpReady.value ? 'Release to mark all read' : 'Pull up to mark all read'
)

function isAtBottom(): boolean {
  return document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 8
}

async function executePullAction() {
  pullUpDist.value = 0
  const sel = feedsStore.selection
  if (!sel || articlesStore.loading) return
  await articlesStore.markAllRead()
  await articlesStore.appendNew()
  await feedsStore.loadTree()
}

let wheelAccum = 0
let wheelResetTimer: ReturnType<typeof setTimeout> | null = null

function onWheel(e: WheelEvent) {
  if (!feedsStore.selection || !isAtBottom() || e.deltaY <= 0) {
    if (wheelAccum > 0 || pullUpDist.value > 0) {
      wheelAccum = 0
      pullUpDist.value = 0
    }
    return
  }
  const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY
  wheelAccum += delta
  pullUpDist.value = Math.min(wheelAccum / PULL_WHEEL, 1)
  if (wheelResetTimer) clearTimeout(wheelResetTimer)
  wheelResetTimer = setTimeout(() => {
    wheelAccum = 0
    pullUpDist.value = 0
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
}

function onTouchEnd() {
  if (feedsStore.selection && pullUpDist.value >= 1) {
    executePullAction()
  } else {
    pullUpDist.value = 0
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
