<template>
  <div class="article-list" ref="listEl">
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
      />
      <div v-if="articlesStore.loadingMore" class="state-msg state-msg--sm">Loading more...</div>
      <div v-else-if="!articlesStore.hasMore && articles.length > 0" class="state-msg state-msg--sm">
        End of feed
      </div>
      <div ref="sentinelEl" class="sentinel" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useFeedsStore } from '@/stores/feeds'
import { useArticlesStore } from '@/stores/articles'
import { useSettingsStore } from '@/stores/settings'
import ArticleCard from './ArticleCard.vue'

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
    { root: listEl.value, rootMargin: '400px' },
  )
})

watch(sentinelEl, (el, prevEl) => {
  if (prevEl) observer?.unobserve(prevEl)
  if (el) observer?.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
  if (listEl.value) listEl.value.removeEventListener('scroll', onScroll)
})

// Mark-on-scroll
let lastScrollTop = 0

const articleById = computed(() => new Map(articles.value.map((a) => [a.id, a])))

function onScroll(e: Event) {
  if (!settings.value.mark_on_scroll) return
  const el = e.target as HTMLElement
  const scrollingDown = el.scrollTop > lastScrollTop
  lastScrollTop = el.scrollTop
  if (!scrollingDown) return

  const containerRect = el.getBoundingClientRect()
  const cutoff = containerRect.top + 100
  const map = articleById.value
  const toMark: number[] = []
  for (const cardEl of el.querySelectorAll('[data-id]')) {
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

watch(listEl, (el, prev) => {
  if (prev) prev.removeEventListener('scroll', onScroll)
  if (el) el.addEventListener('scroll', onScroll, { passive: true })
})

function toggleArticle(id: number) {
  articlesStore.select(selectedId.value === id ? null : id)
}
</script>

<style scoped>
.article-list {
  overflow-y: auto;
  height: 100%;
  background: var(--color-bg);
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
</style>
