<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Top bar -->
    <header class="topbar">
      <button class="icon-btn" title="Toggle sidebar" @pointerdown="onIconBtnPointerDown" @click="toggleSidebar"><Menu :size="16" /></button>
      <span
        class="topbar-title"
        :class="{ 'topbar-title-link': canOpenFeedUrl }"
        :title="canOpenFeedUrl ? 'Open feed URL' : undefined"
        @click="openFeedUrl"
      >
        {{ feedsStore.selection?.title ?? 'Rhesus' }}
        <span v-if="feedsStore.selection && unreadCount > 0" class="topbar-unread">({{ unreadCount }})</span>
      </span>
      <div class="topbar-actions">
        <button
          v-if="feedsStore.selection"
          class="icon-btn"
          :class="{ active: showArticleSearch }"
          title="Search articles"
          @pointerdown="onIconBtnPointerDown"
          @click="showArticleSearch = !showArticleSearch"
        ><Search :size="16" /></button>
        <button
          v-if="feedsStore.selection"
          class="icon-btn"
          title="Mark all as read"
          @pointerdown="onIconBtnPointerDown"
          @click="confirmMarkAll = true"
        ><CheckCheck :size="16" /></button>
        <button class="icon-btn" title="Refresh" @pointerdown="onIconBtnPointerDown" @click="refresh"><RefreshCw :size="16" /></button>
        <button class="icon-btn" :title="themeLabel" @pointerdown="onIconBtnPointerDown" @click="toggleTheme">
          <Sun v-if="effectiveTheme === 'dark'" :size="16" />
          <Moon v-else :size="16" />
        </button>
        <button class="icon-btn" :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'" @pointerdown="onIconBtnPointerDown" @click="toggleFullscreen">
          <Minimize2 v-if="isFullscreen" :size="16" />
          <Maximize2 v-else :size="16" />
        </button>
        <button class="icon-btn" title="Settings" @pointerdown="onIconBtnPointerDown" @click="toggleSettings"><Settings :size="16" /></button>
      </div>
    </header>

    <!-- Sidebar -->
    <aside class="sidebar">
      <a class="sidebar-brand" href="/" target="_blank" rel="noopener noreferrer" title="Open Rhesus in new tab">
        <img src="/favicon.svg" class="brand-icon" alt="" />
        <span class="brand-text">
          <span class="brand-name">Rhesus</span>
          <span class="brand-meta">v{{ appVersion }} &middot; {{ buildDate }}</span>
        </span>
      </a>
      <FeedTree @navigate="settings.sidebar_collapsed = true; showFeedEditor = false; showFilterManager = false" />
      <div class="sidebar-manage">
        <button
          class="sidebar-footer-btn"
          :class="{ active: showFeedEditor }"
          title="Manage feeds"
          @click="toggleFeedEditor"
        >
          <Rss :size="14" />
          <span>Manage feeds</span>
        </button>
        <button
          class="sidebar-footer-btn"
          :class="{ active: showFilterManager }"
          title="Manage filters"
          @click="toggleFilterManager"
        >
          <Filter :size="14" />
          <span>Manage filters</span>
        </button>
      </div>
      <div class="sidebar-footer">
        <button class="sidebar-footer-btn sidebar-footer-btn--signout" title="Sign out" @click="confirmLogout = true">
          <LogOut :size="14" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <ArticleList :show-search="showArticleSearch" @copied="showCopyToast" @close-search="showArticleSearch = false" />
      <Transition name="overlay">
        <div
          v-if="showSettings"
          class="settings-overlay"
          tabindex="-1"
          @vue:mounted="focusOverlay"
          @keydown.esc="showSettings = false"
        >
          <button class="settings-close" title="Close" @click="showSettings = false"><X :size="14" /></button>
          <SettingsPanel />
        </div>
      </Transition>
      <Transition name="overlay">
        <div
          v-if="showFeedEditor"
          class="settings-overlay"
          tabindex="-1"
          @vue:mounted="focusOverlay"
          @keydown.esc="showFeedEditor = false"
        >
          <button class="settings-close" title="Close" @click="showFeedEditor = false"><X :size="14" /></button>
          <FeedEditor />
        </div>
      </Transition>
      <Transition name="overlay">
        <div
          v-if="showFilterManager"
          class="settings-overlay"
          tabindex="-1"
          @vue:mounted="focusOverlay"
          @keydown.esc="showFilterManager = false"
        >
          <button class="settings-close" title="Close" @click="showFilterManager = false"><X :size="14" /></button>
          <FilterManager :initial-filter="filterManagerInitialFilter" />
        </div>
      </Transition>

      <Transition name="overlay">
        <div v-if="selectedArticle" ref="readerOverlayEl" class="reader-overlay" @keydown.esc="closeReader">
          <div class="reader-overlay-backdrop" @click="closeReader" />
          <div class="reader-overlay-panel">
            <div class="reader-progress-bar" :style="{ transform: `scaleX(${readerScrollProgress})` }" />
            <button class="reader-close" title="Close" @click="closeReader"><X :size="14" /></button>
            <div ref="readerScrollEl" class="reader-scroll" @scroll="onReaderScroll">
              <h1
                class="reader-title"
                @click="openTitleLink"
                @contextmenu.prevent
                @pointerdown="onTitlePointerDown"
                @pointerup="onTitlePointerUp"
                @pointermove="onTitlePointerMove"
                @pointercancel="onTitlePointerCancel"
              >{{ selectedArticle.title }}</h1>
              <div class="reader-meta">
                <span class="reader-meta-feed" @click="goToFeed(selectedArticle.feed_id)">{{ selectedArticle.feed_title }}</span>
                <span v-if="readerLinkDomain" class="reader-meta-domain" @click="openLinkDomain">{{ readerLinkDomain }}</span>
                <span
                  v-if="readerAuthor"
                  class="reader-meta-author"
                  @click="searchAuthor(readerAuthor, readerLinkDomain ?? selectedArticle.feed_title)"
                >{{ readerAuthor }}</span>
                <span>{{ formatArticleDate(readerDate) }}</span>
              </div>
              <ArticleReader :article="selectedArticle" :scrolled="showScrollTop" @close="closeReader" @copied="showCopyToast" @scroll-to-top="scrollToTop" @create-filter-from-tags="onCreateFilterFromTags" @full-content-meta="onFullContentMeta" />
            </div>
          </div>
        </div>
      </Transition>
    </main>

    <!-- Copy toast -->
    <Transition name="toast">
      <div v-if="copyToast" class="copy-toast">{{ copyToast }}</div>
    </Transition>

    <!-- Mark all confirmation -->
    <ConfirmDialog
      v-if="confirmMarkAll"
      message="Mark all articles in this feed as read?"
      @confirm="markAll"
      @cancel="confirmMarkAll = false"
    />

    <!-- Sign out confirmation -->
    <ConfirmDialog
      v-if="confirmLogout"
      message="Sign out of Rhesus?"
      @confirm="logout"
      @cancel="confirmLogout = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { VNode } from 'vue'
import { Menu, CheckCheck, RefreshCw, Sun, Moon, Settings, X, Rss, LogOut, Maximize2, Minimize2, Search, Filter } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useFeedsStore } from '@/stores/feeds'
import { useArticlesStore } from '@/stores/articles'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import FeedTree from '@/components/feeds/FeedTree.vue'
import FeedEditor from '@/components/feeds/FeedEditor.vue'
import FilterManager from '@/components/filters/FilterManager.vue'
import ArticleList from '@/components/articles/ArticleList.vue'
import ArticleReader from '@/components/articles/ArticleReader.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { browserShowsNativeToast } from '@/utils/clipboard'
import { externalLinkDomain, originOf } from '@/utils/url'
import { blankRule, escapeRegExp } from '@/utils/filterDefaults'
import type { ApiFeedTreeItem, ApiFilter, UiSettings } from '@/types/api'

const appVersion = __APP_VERSION__
const buildDate = __BUILD_DATE__

const route = useRoute()
const router = useRouter()
const feedsStore = useFeedsStore()
const articlesStore = useArticlesStore()
const settingsStore = useSettingsStore()
const { settings, loaded: settingsLoaded } = storeToRefs(settingsStore)
const { articles, selectedId } = storeToRefs(articlesStore)
const { selection, tree } = storeToRefs(feedsStore)

function findInTree(items: typeof tree.value, bareId: number): (typeof tree.value)[0] | undefined {
  for (const item of items) {
    if (item.bare_id === bareId) return item
    if (item.items) {
      const found = findInTree(item.items, bareId)
      if (found) return found
    }
  }
  return undefined
}

const baseServerUnread = ref(0)

// readCountDelta exists purely to reflect mark-read actions instantly, ahead
// of the next tree refresh. Once a fresh tree fetch gives us a real server
// count for the selected feed, that count already reflects every read that's
// been synced so far - so the delta's job is done and it must be reset here.
// Without this, a stale delta from e.g. marking a big batch read (pull-to-
// refresh's mark-all-then-fetch-new) keeps subtracting from the NEXT fresh
// count too, which can drive it to 0 and hide the badge even when genuinely
// new unread articles just arrived.
watchEffect(() => {
  const sel = selection.value
  if (!sel) { baseServerUnread.value = 0; return }
  // Starred is a total-count feed (see feedsStore.starredCount), not an
  // unread-count one like every other feed - the tree only ever carries
  // unread-only counts from the server (see FeedTree.vue's withStarredCount
  // for why), so this can't be read off `node.unread` the normal way.
  if (sel.id === -1 && !sel.isCategory) {
    baseServerUnread.value = feedsStore.starredCount
    return
  }
  const node = findInTree(tree.value, sel.id)
  if (node) {
    baseServerUnread.value = node.unread
    articlesStore.readCountDelta = 0
  }
})

const unreadCount = computed(() => {
  const sel = selection.value
  if (sel?.id === -1 && !sel.isCategory) {
    return Math.max(0, baseServerUnread.value + articlesStore.starredCountDelta)
  }
  return Math.max(0, baseServerUnread.value - articlesStore.readCountDelta)
})

const authStore = useAuthStore()

const confirmMarkAll = ref(false)
const confirmLogout = ref(false)
const showSettings = ref(false)
const showFeedEditor = ref(false)
const showFilterManager = ref(false)
const filterManagerInitialFilter = ref<Partial<ApiFilter> | null>(null)
const showArticleSearch = ref(false)
const copyToast = ref<string | null>(null)
const historyPushed = ref(false)
const sidebarCollapsed = computed(() => settings.value.sidebar_collapsed)
const suppressNextSidebarCollapse = ref(true)

const readerScrollEl = ref<HTMLElement | null>(null)
const readerOverlayEl = ref<HTMLElement | null>(null)
const readerScrollProgress = ref(0)
const showScrollTop = ref(false)

let readerTouchY = 0

function onReaderTouchStart(e: TouchEvent) {
  readerTouchY = e.touches[0]!.clientY
}

function onReaderTouchMove(e: TouchEvent) {
  const scrollEl = readerScrollEl.value
  if (!scrollEl || !scrollEl.contains(e.target as Node)) {
    e.preventDefault()
    return
  }
  const dy = e.touches[0]!.clientY - readerTouchY
  const atTop = scrollEl.scrollTop <= 0
  const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1
  if ((dy > 0 && atTop) || (dy < 0 && atBottom) || (atTop && atBottom)) {
    e.preventDefault()
  }
}

function onReaderScroll() {
  const el = readerScrollEl.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  readerScrollProgress.value = max > 0 ? el.scrollTop / max : 0
  showScrollTop.value = el.scrollTop > 300
}

function scrollToTop() {
  readerScrollEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function formatArticleDate(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(ts * 1000))
}

const selectedArticle = computed(() =>
  selectedId.value !== null ? articles.value.find((a) => a.id === selectedId.value) ?? null : null,
)

// Fallback author/publish-date pulled from the full article's JSON-LD, only
// ever set when the feed itself didn't provide one - see ArticleReader.vue's
// toggleFullContent(). Cleared whenever ArticleReader re-emits (article
// change, or full content toggled back off).
const fullContentMeta = ref<{ author?: string, publishedAt?: number }>({})

function onFullContentMeta(meta: { author?: string, publishedAt?: number }) {
  fullContentMeta.value = meta
}

const readerAuthor = computed(() => selectedArticle.value?.author || fullContentMeta.value.author || '')
const readerDate = computed(() => fullContentMeta.value.publishedAt ?? selectedArticle.value?.updated ?? 0)

const readerLinkDomain = computed(() =>
  selectedArticle.value ? externalLinkDomain(selectedArticle.value.link, selectedArticle.value.site_url) : null,
)

function openLinkDomain() {
  const origin = originOf(selectedArticle.value?.link)
  if (origin) window.open(origin, '_blank', 'noopener,noreferrer')
}

const isFullscreen = ref(!!document.fullscreenElement)

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen()
  } else {
    await document.exitFullscreen()
  }
}

onMounted(() => {
  settingsStore.load()
  window.addEventListener('popstate', onPopState)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (pollTimer !== null) clearInterval(pollTimer)
  document.body.style.overflow = ''
})

function findTitle(items: ApiFeedTreeItem[], id: number, isCategory: boolean): string | null {
  for (const item of items) {
    if (isCategory && item.type === 'category' && item.bare_id === id) return item.name
    if (!isCategory && item.type !== 'category' && item.bare_id === id) return item.name
    if (item.items) {
      const found = findTitle(item.items, id, isCategory)
      if (found) return found
    }
  }
  return null
}

// Drive feed selection and article loading from the current route.
watch(
  [() => route.name, () => route.params.id, () => route.query.viewMode, () => tree.value.length > 0],
  ([routeName, idParam, viewMode, treeReady]) => {
    if (!treeReady || (routeName !== 'feed' && routeName !== 'category')) return
    const id = parseInt(idParam as string)
    const isCategory = routeName === 'category'
    const vm = (viewMode as string) || 'all_articles'
    const title =
      id === -4 && vm === 'unread' ? 'Unread articles'
      : findTitle(tree.value, id, isCategory) ?? (isCategory ? 'Category' : 'Feed')
    feedsStore.select({ id, isCategory, title, viewMode: vm === 'all_articles' ? undefined : vm })
    articlesStore.load(id, isCategory, vm)
  },
  { immediate: true },
)

// On startup with no feed in URL, auto-navigate to All Articles with sidebar open.
let startupDone = false
watch(
  [settingsLoaded, () => tree.value.length > 0],
  ([sReady, tReady]) => {
    if (startupDone || !sReady || !tReady || route.name !== 'home') return
    startupDone = true
    settings.value.sidebar_collapsed = false
    suppressNextSidebarCollapse.value = true
    router.replace({ name: 'feed', params: { id: '-4' } })
  },
)

// Lock document scroll while an overlay panel is open so the article list
// behind it cannot scroll through touch inertia or mis-fires.
watch([showSettings, showFeedEditor, showFilterManager, sidebarCollapsed], ([s, f, fm, collapsed]) => {
  document.body.style.overflow = (s || f || fm || !collapsed) ? 'hidden' : ''
})

// Clear the tag-derived prefill once the filter manager closes, so reopening
// it normally (e.g. via the sidebar button) starts at the blank list again.
watch(showFilterManager, (open) => {
  if (!open) filterManagerInitialFilter.value = null
})

// Periodic polling: restart the timer whenever the interval setting changes.
let pollTimer: ReturnType<typeof setInterval> | null = null
watch(
  () => settings.value.poll_interval,
  (minutes) => {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (minutes > 0) pollTimer = setInterval(refresh, minutes * 60 * 1000)
  },
)

watch(selection, (newSel) => {
  showArticleSearch.value = false
  if (suppressNextSidebarCollapse.value) {
    suppressNextSidebarCollapse.value = false
    return
  }
  if (newSel && !settings.value.sidebar_collapsed) settings.value.sidebar_collapsed = true
})

watch(selectedId, (newId, oldId) => {
  if (newId !== null && oldId === null) {
    history.pushState({ articleOverlay: true }, '')
    historyPushed.value = true
    window.scrollTo({ top: window.scrollY, behavior: 'instant' })
    nextTick().then(() => {
      const el = readerOverlayEl.value
      if (!el) return
      el.addEventListener('touchstart', onReaderTouchStart, { passive: true })
      el.addEventListener('touchmove', onReaderTouchMove, { passive: false })
    })
  }
})

function onPopState() {
  showScrollTop.value = false
  historyPushed.value = false
  articlesStore.select(null)
}

function focusOverlay(vnode: VNode) {
  (vnode.el as HTMLElement).focus()
}

function closeReader() {
  showScrollTop.value = false
  if (historyPushed.value) {
    historyPushed.value = false
    history.back()
  } else {
    articlesStore.select(null)
  }
}

function goToFeed(feedId: number) {
  historyPushed.value = false
  articlesStore.select(null)
  router.replace({ name: 'feed', params: { id: String(feedId) } })
}

// Browsers don't expose which search engine the user has set as default -
// that's a browser-internal setting with no web API, for the same privacy
// reasons a page can't read other browser settings - so this links to
// whichever engine is chosen in Settings, rather than "the" default.
const SEARCH_ENGINE_URLS: Record<UiSettings['search_engine'], string> = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
}

// Matches the marker af_enhance_content appends to author names sourced
// from twitter:creator/twitter:site rather than a real og:article:author
// byline (see TWITTER_AUTHOR_ICON in that plugin's init.php) - a handle
// like "@ripelabs" is often the publication's own account, not the
// individual writer, so search for "twitter" instead of the feed title.
const TWITTER_AUTHOR_MARKER = ' 🐦'

function searchAuthor(name: string, feedTitle?: string) {
  const isTwitterAuthor = name.endsWith(TWITTER_AUTHOR_MARKER)
  const cleanName = isTwitterAuthor ? name.slice(0, -TWITTER_AUTHOR_MARKER.length) : name
  const secondTerm = isTwitterAuthor ? 'twitter' : feedTitle
  const query = secondTerm ? `${cleanName} ${secondTerm}` : cleanName
  const base = SEARCH_ENGINE_URLS[settingsStore.settings.search_engine]
  window.open(`${base}${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer')
}

function selectionSiteUrl(): string | undefined {
  const sel = feedsStore.selection
  if (!sel || sel.isCategory || sel.id <= 0) return undefined
  return articles.value.find((a) => a.feed_id === sel.id)?.site_url
}

const canOpenFeedUrl = computed(() => !!selectionSiteUrl())

function openFeedUrl() {
  const url = selectionSiteUrl()
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

const effectiveTheme = computed(() => {
  if (settings.value.theme !== 'system') return settings.value.theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
})

const themeLabel = computed(() =>
  effectiveTheme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
)

function toggleSidebar() {
  settings.value.sidebar_collapsed = !settings.value.sidebar_collapsed
}

function toggleTheme() {
  settings.value.theme = effectiveTheme.value === 'dark' ? 'light' : 'dark'
}

async function markAll() {
  confirmMarkAll.value = false
  const sel = feedsStore.selection
  if (sel) await articlesStore.markAllRead()
}

async function logout() {
  confirmLogout.value = false
  await authStore.logout()
  router.push('/login')
}

function toggleSettings() {
  showFeedEditor.value = false
  showSettings.value = !showSettings.value
}

function toggleFeedEditor() {
  showSettings.value = false
  showFilterManager.value = false
  showFeedEditor.value = !showFeedEditor.value
  if (showFeedEditor.value) settings.value.sidebar_collapsed = true
}

function toggleFilterManager() {
  showSettings.value = false
  showFeedEditor.value = false
  showFilterManager.value = !showFilterManager.value
  if (showFilterManager.value) settings.value.sidebar_collapsed = true
}

function onCreateFilterFromTags(tags: string[]) {
  filterManagerInitialFilter.value = {
    title: tags.join(', '),
    rules: tags.map(tag => ({ ...blankRule(), filter_type: 7, reg_exp: `^${escapeRegExp(tag)}$` })),
  }
  showSettings.value = false
  showFeedEditor.value = false
  showFilterManager.value = true
  settings.value.sidebar_collapsed = true
}

let longPressTimer: ReturnType<typeof setTimeout> | null = null
let titleLongPressExecuted = false
let pendingCopyEl: HTMLTextAreaElement | null = null
let pendingCopyLabel = ''
let titlePointerStartX = 0
let titlePointerStartY = 0

function buildCopyText(): { text: string; label: string } {
  const article = selectedArticle.value
  if (!article) return { text: '', label: '' }
  const action = settings.value.long_press_title
  if (action === 'copy_text') {
    const div = document.createElement('div')
    div.innerHTML = article.content ?? ''
    return { text: div.textContent ?? '', label: 'Text copied' }
  }
  if (action === 'copy_link') return { text: article.link ?? '', label: 'Link copied' }
  if (action === 'copy_markdown') return { text: `[${article.title}](${article.link})`, label: 'Markdown link copied' }
  return { text: '', label: '' }
}

function onTitlePointerDown(e: PointerEvent) {
  titleLongPressExecuted = false
  pendingCopyEl = null
  pendingCopyLabel = ''
  titlePointerStartX = e.clientX
  titlePointerStartY = e.clientY
  if (settings.value.long_press_title === 'none') return

  // Build the copy text and pre-focus a textarea now, while we're inside a
  // user-gesture handler. execCommand('copy') requires either a synchronous
  // user gesture or a pre-existing selection — holding focus on a textarea
  // during the 600 ms timer gives us that without changing the fire-at-600ms UX.
  const { text, label } = buildCopyText()
  if (text) {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;'
    document.body.appendChild(el)
    el.focus()
    el.select()
    pendingCopyEl = el
    pendingCopyLabel = label
  }

  longPressTimer = setTimeout(() => {
    longPressTimer = null
    executeTitleLongPress()
  }, 600)
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function cleanupPendingCopy() {
  if (pendingCopyEl) {
    document.body.removeChild(pendingCopyEl)
    pendingCopyEl = null
  }
}

function onTitlePointerUp() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
    cleanupPendingCopy()
  }
}

function onTitlePointerCancel() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  cleanupPendingCopy()
}

function onTitlePointerMove(e: PointerEvent) {
  if (longPressTimer === null) return
  const dx = e.clientX - titlePointerStartX
  const dy = e.clientY - titlePointerStartY
  if (Math.sqrt(dx * dx + dy * dy) > 10) onTitlePointerCancel()
}

function openTitleLink() {
  if (titleLongPressExecuted) {
    titleLongPressExecuted = false
    return
  }
  const link = selectedArticle.value?.link
  if (link) window.open(link, '_blank', 'noopener,noreferrer')
}

function executeTitleLongPress() {
  titleLongPressExecuted = true
  const el = pendingCopyEl
  const label = pendingCopyLabel
  pendingCopyEl = null
  pendingCopyLabel = ''

  if (el) {
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    if (ok) {
      navigator.vibrate?.(50)
      if (!browserShowsNativeToast) showCopyToast(label)
      return
    }
  }

  const { text } = buildCopyText()
  if (!text) return
  void navigator.clipboard?.writeText(text).then(() => {
    navigator.vibrate?.(50)
    if (!browserShowsNativeToast) showCopyToast(label)
  })
}

function showCopyToast(label: string) {
  copyToast.value = label
  setTimeout(() => { copyToast.value = null }, 2000)
}


function onIconBtnPointerDown(e: PointerEvent) {
  const btn = e.currentTarget as HTMLElement
  btn.classList.add('pressed')
  const cleanup = () => {
    btn.classList.remove('pressed')
    btn.removeEventListener('pointerup', cleanup)
    btn.removeEventListener('pointercancel', cleanup)
    btn.removeEventListener('pointerleave', cleanup)
  }
  btn.addEventListener('pointerup', cleanup)
  btn.addEventListener('pointercancel', cleanup)
  btn.addEventListener('pointerleave', cleanup)
}

async function refresh() {
  const sel = feedsStore.selection
  if (sel) await articlesStore.load(sel.id, sel.isCategory, sel.viewMode)
  await feedsStore.loadTree()
}
</script>

<style scoped>
.app-shell {
  min-height: 100dvh;
}

.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  z-index: 10;
}

.topbar-title {
  flex: 1;
  font-size: var(--font-size-lg);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-title-link {
  cursor: pointer;
}

.topbar-title-link:hover {
  text-decoration: underline;
}

.topbar-unread {
  font-size: var(--font-size-sm);
  font-weight: 400;
  margin-left: 4px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 16px;
  color: var(--color-text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast);
  text-decoration: none;
}

.icon-btn.pressed {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}


.sidebar {
  position: fixed;
  top: var(--topbar-height);
  left: 0;
  bottom: 0;
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-normal);
  z-index: 9;
}

.sidebar-collapsed .sidebar {
  transform: translateX(-100%);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
  text-align: left;
  flex-shrink: 0;
  white-space: nowrap;
  transition: background var(--transition-fast);
}

.sidebar-brand:hover {
  background: var(--color-surface-raised);
}

.brand-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.brand-name {
  font-size: var(--font-size-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.brand-meta {
  font-size: var(--font-size-xs, 11px);
  font-weight: 400;
  color: var(--color-text-muted);
  letter-spacing: 0;
  white-space: nowrap;
}

.sidebar-manage {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
}

.sidebar-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
}

.sidebar-footer-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: left;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.sidebar-footer-btn:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.sidebar-footer-btn.active {
  color: var(--color-accent);
}

.sidebar-footer-btn--signout {
  color: var(--color-danger);
}

.sidebar-footer-btn--signout:hover {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
}

.main-content {
  margin-top: var(--topbar-height);
  margin-left: var(--sidebar-width);
  transition: margin-left var(--transition-normal);
  position: relative;
}

.sidebar-collapsed .main-content {
  margin-left: 0;
}

.content-overlay {
  position: fixed;
  top: var(--topbar-height);
  left: var(--sidebar-width);
  right: 0;
  bottom: 0;
  z-index: 10;
  background: var(--color-surface);
  overflow-y: auto;
  overscroll-behavior: contain;
  transition: left var(--transition-normal);
}

.sidebar-collapsed .content-overlay {
  left: 0;
}

.settings-overlay {
  position: fixed;
  top: var(--topbar-height);
  left: var(--sidebar-width);
  right: 0;
  bottom: 0;
  z-index: 20;
  background: var(--color-bg);
  overflow: hidden;
  outline: none;
  transition: left var(--transition-normal);
}

.sidebar-collapsed .settings-overlay {
  left: 0;
}

.settings-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;
  color: var(--color-text-secondary);
  z-index: 1;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.settings-close:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.reader-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 100dvh;
  z-index: 20;
  display: flex;
}

.reader-overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.reader-overlay-panel {
  position: relative;
  width: 100%;
  height: 100%;
  background: #1e1c1a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.reader-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-accent);
  transform-origin: left;
  z-index: 2;
  pointer-events: none;
}

.reader-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;
  color: var(--color-text-secondary);
  z-index: 1;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.reader-close:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.reader-scroll {
  --reader-h-pad: clamp(24px, 8vw, 80px);
  overflow-y: auto;
  height: 100%;
  padding: 24px var(--reader-h-pad);
  overscroll-behavior: contain;
}

.reader-title {
  font-size: 2em;
  font-weight: 700;
  line-height: var(--line-height-tight);
  margin-bottom: 10px;
  padding-right: 40px;
  user-select: none;
  cursor: pointer;
}

.reader-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
  margin-bottom: 20px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.reader-meta-feed {
  cursor: pointer;
}

.reader-meta-feed:hover {
  color: var(--color-text-primary);
  text-decoration: underline;
}

.reader-meta-domain {
  cursor: pointer;
}

.reader-meta-domain:hover {
  color: var(--color-text-primary);
  text-decoration: underline;
}

.reader-meta-author {
  cursor: pointer;
}

.reader-meta-author:hover {
  color: var(--color-text-primary);
  text-decoration: underline;
}

.reader-meta span + span::before {
  content: ' \B7 ';
  padding: 0 4px;
}


.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.copy-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-text-primary);
  color: var(--color-bg);
  font-size: var(--font-size-sm);
  padding: 8px 16px;
  border-radius: 20px;
  z-index: 100;
  pointer-events: none;
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity var(--transition-normal);
}

.overlay-enter-active .reader-overlay-panel,
.overlay-leave-active .reader-overlay-panel {
  transition: transform var(--transition-normal);
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.overlay-enter-from .reader-overlay-panel,
.overlay-leave-to .reader-overlay-panel {
  transform: translateX(100%);
}

@media (max-width: 600px) {
  .sidebar {
    width: 100%;
  }

  .main-content {
    margin-left: 0;
  }

  .content-overlay {
    left: 0;
  }

  .settings-overlay {
    left: 0;
  }

  .app-shell:not(.sidebar-collapsed) .topbar-title,
  .app-shell:not(.sidebar-collapsed) .topbar-actions,
  .app-shell:not(.sidebar-collapsed) .main-content {
    display: none;
  }
}
</style>

<style>
[data-theme='light'] .reader-overlay-panel {
  background: var(--color-surface);
}

html[data-input='mouse'] .icon-btn:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}
</style>
