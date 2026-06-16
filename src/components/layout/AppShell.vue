<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Top bar -->
    <header class="topbar">
      <button class="icon-btn" title="Toggle sidebar" @click="toggleSidebar"><Menu :size="16" /></button>
      <span class="topbar-title">
        {{ feedsStore.selection?.title ?? 'Rhesus' }}
        <span v-if="feedsStore.selection && unreadCount > 0" class="topbar-unread">({{ unreadCount }})</span>
      </span>
      <div class="topbar-actions">
        <button
          v-if="feedsStore.selection"
          class="icon-btn"
          title="Mark all as read"
          @click="confirmMarkAll = true"
        ><CheckCheck :size="16" /></button>
        <button class="icon-btn" title="Refresh" @click="refresh"><RefreshCw :size="16" /></button>
        <button class="icon-btn" :title="themeLabel" @click="toggleTheme">
          <Sun v-if="settings.theme === 'dark'" :size="16" />
          <Moon v-else :size="16" />
        </button>
        <button class="icon-btn" title="Settings" @click="toggleSettings"><Settings :size="16" /></button>
      </div>
    </header>

    <!-- Sidebar -->
    <aside class="sidebar">
      <button class="sidebar-brand" title="All articles" @click="navigateHome">
        <img src="/favicon.svg" class="brand-icon" alt="" />
        <span class="brand-name">Rhesus</span>
      </button>
      <FeedTree />
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <template v-if="showSettings">
        <SettingsPanel />
      </template>
      <template v-else>
        <ArticleList />
      </template>

      <Transition name="overlay">
        <div v-if="selectedArticle" class="reader-overlay" @keydown.esc="closeReader">
          <div class="reader-overlay-backdrop" @click="closeReader" />
          <div class="reader-overlay-panel">
            <button class="reader-close" title="Close" @click="closeReader"><X :size="14" /></button>
            <div class="reader-scroll">
              <h1
                class="reader-title"
                :class="{ 'reader-title--pressable': settings.long_press_title !== 'none' }"
                @pointerdown="onTitlePointerDown"
                @pointerup="onTitlePointerUp"
                @pointermove="onTitlePointerCancel"
                @pointercancel="onTitlePointerCancel"
              >{{ selectedArticle.title }}</h1>
              <ArticleReader :article="selectedArticle" @close="closeReader" @copied="showCopyToast" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Menu, CheckCheck, RefreshCw, Sun, Moon, Settings, X } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { writeToClipboard } from '@/utils/clipboard'
import { useFeedsStore } from '@/stores/feeds'
import { useArticlesStore } from '@/stores/articles'
import { useSettingsStore } from '@/stores/settings'
import FeedTree from '@/components/feeds/FeedTree.vue'
import ArticleList from '@/components/articles/ArticleList.vue'
import ArticleReader from '@/components/articles/ArticleReader.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { ApiFeedTreeItem } from '@/types/api'

const route = useRoute()
const router = useRouter()
const feedsStore = useFeedsStore()
const articlesStore = useArticlesStore()
const settingsStore = useSettingsStore()
const { settings, loaded: settingsLoaded } = storeToRefs(settingsStore)
const { articles, selectedId } = storeToRefs(articlesStore)
const { selection, tree } = storeToRefs(feedsStore)

const unreadCount = computed(() => articles.value.filter((a) => a.unread).length)

const confirmMarkAll = ref(false)
const showSettings = ref(false)
const copyToast = ref<string | null>(null)
const historyPushed = ref(false)
const sidebarCollapsed = computed(() => settings.value.sidebar_collapsed)
const suppressNextSidebarCollapse = ref(true)

const selectedArticle = computed(() =>
  selectedId.value !== null ? articles.value.find((a) => a.id === selectedId.value) ?? null : null,
)

onMounted(() => {
  settingsStore.load()
  window.addEventListener('popstate', onPopState)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState)
  if (pollTimer !== null) clearInterval(pollTimer)
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
  }
})

function onPopState() {
  historyPushed.value = false
  articlesStore.select(null)
}

function closeReader() {
  if (historyPushed.value) {
    historyPushed.value = false
    history.back()
  } else {
    articlesStore.select(null)
  }
}

const themeLabel = computed(() =>
  settings.value.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
)

function toggleSidebar() {
  settings.value.sidebar_collapsed = !settings.value.sidebar_collapsed
}

function toggleTheme() {
  settings.value.theme = settings.value.theme === 'dark' ? 'light' : 'dark'
}

async function markAll() {
  confirmMarkAll.value = false
  const sel = feedsStore.selection
  if (sel) await articlesStore.markAllRead(sel.id, sel.isCategory)
}

function toggleSettings() {
  showSettings.value = !showSettings.value
}

let longPressTimer: ReturnType<typeof setTimeout> | null = null

function onTitlePointerDown(e: PointerEvent) {
  if (settings.value.long_press_title === 'none') return
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    executeTitleLongPress()
  }, 600)
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onTitlePointerUp() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onTitlePointerCancel() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

async function executeTitleLongPress() {
  const article = selectedArticle.value
  if (!article) return
  const action = settings.value.long_press_title
  let text = ''
  let label = ''
  if (action === 'copy_text') {
    const div = document.createElement('div')
    div.innerHTML = article.content ?? ''
    text = div.textContent ?? ''
    label = 'Text copied'
  } else if (action === 'copy_link') {
    text = article.link ?? ''
    label = 'Link copied'
  } else if (action === 'copy_markdown') {
    text = `[${article.title}](${article.link})`
    label = 'Markdown link copied'
  }
  if (!text) return
  try {
    await writeToClipboard(text)
    showCopyToast(label)
  } catch {
    showCopyToast('Copy failed')
  }
}

function showCopyToast(label: string) {
  copyToast.value = label
  setTimeout(() => { copyToast.value = null }, 2000)
}

function navigateHome() {
  settings.value.sidebar_collapsed = false
  suppressNextSidebarCollapse.value = true
  const alreadyHome = route.name === 'feed' && String(route.params.id) === '-4' && !route.query.viewMode
  if (alreadyHome) {
    articlesStore.load(-4, false)
  } else {
    router.replace({ name: 'feed', params: { id: '-4' } })
  }
}

async function refresh() {
  const sel = feedsStore.selection
  if (sel) await articlesStore.load(sel.id, sel.isCategory, sel.viewMode)
  await feedsStore.loadTree()
}
</script>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: var(--topbar-height) 1fr;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-areas:
    'topbar topbar'
    'sidebar main';
  height: 100%;
  transition: grid-template-columns var(--transition-normal);
}

.app-shell.sidebar-collapsed {
  grid-template-columns: 0 1fr;
}

.topbar {
  grid-area: topbar;
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

.topbar-unread {
  font-size: var(--font-size-sm);
  font-weight: 400;
  color: var(--color-text-muted);
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

.icon-btn:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.sidebar {
  grid-area: sidebar;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
  transition: width var(--transition-normal);
  display: flex;
  flex-direction: column;
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

.brand-name {
  font-size: var(--font-size-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.main-content {
  grid-area: main;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.reader-overlay {
  position: absolute;
  inset: 0;
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
  margin-left: auto;
  width: min(720px, 100%);
  height: 100%;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  overflow-y: auto;
  height: 100%;
  padding: 24px;
}

.reader-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  line-height: var(--line-height-tight);
  margin-bottom: 16px;
  padding-right: 40px;
  user-select: none;
}

.reader-title--pressable {
  cursor: pointer;
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
</style>
