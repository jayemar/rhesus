<template>
  <div class="reader">
    <footer class="reader-toolbar">
      <button
        class="tb-btn"
        :title="article.unread ? 'Mark as read' : 'Mark as unread'"
        @click.stop="onToggleRead"
      >
        <Mail v-if="article.unread" :size="16" />
        <MailOpen v-else :size="16" />
      </button>
      <button
        class="tb-btn"
        :class="{ active: article.marked }"
        title="Toggle star"
        @click.stop="articlesStore.toggleStar(article.id)"
      ><Star :size="16" /></button>
      <button ref="tagBtn" class="tb-btn" :class="{ active: articleHasLabels }" title="Labels" @click.stop="openTagMenu">
        <Tag :size="16" />
      </button>
      <button
        class="tb-btn"
        :class="{ active: showSearch }"
        title="Search in article"
        @click.stop="toggleSearch"
      ><Search :size="16" /></button>
      <button ref="shareBtn" class="tb-btn" title="Share" @click.stop="openShareMenu">
        <Share2 :size="16" />
      </button>
      <a
        class="tb-btn"
        :href="article.link"
        target="_blank"
        rel="noopener noreferrer"
        title="Open original"
        @click.stop
      ><ExternalLink :size="16" /></a>
    </footer>
    <div v-if="showSearch" class="reader-search">
      <input
        ref="searchInput"
        v-model="searchQuery"
        class="reader-search-input"
        placeholder="Search..."
        @input="doSearch"
        @keydown.enter.prevent="nextMatch"
        @keydown.shift.enter.prevent="prevMatch"
        @keydown.esc="closeSearch"
        @keydown.stop
        @click.stop
      />
      <span v-if="matchCount > 0" class="reader-search-count">{{ currentMatchIndex + 1 }} / {{ matchCount }}</span>
      <span v-else-if="searchQuery" class="reader-search-count reader-search-none">No results</span>
      <button class="tb-btn" :disabled="matchCount === 0" title="Previous match" @click.stop="prevMatch">
        <ChevronUp :size="14" />
      </button>
      <button class="tb-btn" :disabled="matchCount === 0" title="Next match" @click.stop="nextMatch">
        <ChevronDown :size="14" />
      </button>
      <button class="tb-btn" title="Close search" @click.stop="closeSearch"><X :size="14" /></button>
    </div>
    <img v-if="heroUrl" class="reader-hero" :src="heroUrl" alt="" />
    <div v-if="!article.content" class="reader-loading">Loading article...</div>
    <div v-else ref="contentEl" class="reader-content" v-html="readerContent" />
    <div v-if="imageAttachments.length" class="reader-attachments">
      <figure v-for="att in imageAttachments" :key="att.id" class="reader-attachment">
        <img :src="att.content_url" :alt="att.title" />
        <figcaption v-if="att.title">{{ att.title }}</figcaption>
      </figure>
    </div>
    <Teleport to="body">
      <div v-if="showTagMenu" class="share-backdrop" @click="showTagMenu = false" />
      <div
        v-if="showTagMenu"
        class="tag-popup"
        :style="tagPopupStyle"
        @click.stop
      >
        <div v-if="loadingLabels" class="tag-status">Loading...</div>
        <button
          v-for="label in labelList"
          :key="label.id"
          class="tag-option"
          @click="toggleLabel(label)"
        >
          <span class="tag-dot" :style="{ background: label.bg_color || 'var(--color-text-muted)' }" />
          <span class="tag-name">{{ label.caption }}</span>
          <Check v-if="label.checked" :size="13" class="tag-check" />
        </button>
        <div class="tag-new">
          <input
            v-model="newLabelName"
            class="tag-new-input"
            placeholder="New label..."
            maxlength="64"
            @keydown.enter.prevent="addLabel"
            @keydown.stop
            @click.stop
          />
          <button
            class="tag-new-btn"
            :disabled="!newLabelName.trim() || creatingLabel"
            @click.stop="addLabel"
          >
            <Plus :size="14" />
          </button>
        </div>
      </div>
      <div v-if="showShareMenu" class="share-backdrop" @click="showShareMenu = false" />
      <div
        v-if="showShareMenu"
        class="share-popup"
        :style="sharePopupStyle"
        @click.stop
      >
        <button class="share-option" @click="copy('title')">Copy title</button>
        <button class="share-option" @click="copy('link')">Copy link</button>
        <button class="share-option" @click="copy('markdown')">Copy as markdown link</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { Mail, MailOpen, Star, Tag, Check, Plus, ExternalLink, Share2, Search, X, ChevronUp, ChevronDown } from 'lucide-vue-next'
import { useArticlesStore } from '@/stores/articles'
import { getLabels, setArticleLabel, createLabel } from '@/api/articles'
import { writeToClipboard } from '@/utils/clipboard'
import type { ApiArticle, ApiLabel } from '@/types/api'

const props = defineProps<{ article: ApiArticle }>()
const emit = defineEmits<{ close: [], copied: [label: string] }>()
const articlesStore = useArticlesStore()

const showSearch = ref(false)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)
const matchCount = ref(0)
const currentMatchIndex = ref(0)
let highlights: HTMLElement[] = []

function toggleSearch() {
  showSearch.value = !showSearch.value
  if (showSearch.value) {
    nextTick(() => searchInput.value?.focus())
  } else {
    closeSearch()
  }
}

function closeSearch() {
  showSearch.value = false
  clearHighlights()
  searchQuery.value = ''
  matchCount.value = 0
  currentMatchIndex.value = 0
}

function clearHighlights() {
  if (!contentEl.value) return
  contentEl.value.querySelectorAll('mark.sh').forEach((m) => {
    const parent = m.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent ?? ''), m)
      parent.normalize()
    }
  })
  highlights = []
}

function doSearch() {
  if (!contentEl.value) return
  clearHighlights()
  const q = searchQuery.value.trim()
  if (!q) {
    matchCount.value = 0
    return
  }

  const walker = document.createTreeWalker(contentEl.value, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) textNodes.push(n as Text)

  const lowerQ = q.toLowerCase()
  const found: HTMLElement[] = []

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ''
    const lower = text.toLowerCase()
    const parts: Array<string | HTMLElement> = []
    let last = 0
    let pos = 0
    let idx: number

    while ((idx = lower.indexOf(lowerQ, pos)) !== -1) {
      if (idx > last) parts.push(text.slice(last, idx))
      const mark = document.createElement('mark')
      mark.className = 'sh'
      mark.textContent = text.slice(idx, idx + q.length)
      parts.push(mark)
      found.push(mark)
      last = idx + q.length
      pos = last
    }

    if (parts.length > 0) {
      if (last < text.length) parts.push(text.slice(last))
      const frag = document.createDocumentFragment()
      for (const p of parts) {
        frag.appendChild(typeof p === 'string' ? document.createTextNode(p) : p)
      }
      textNode.parentNode!.replaceChild(frag, textNode)
    }
  }

  highlights = found
  matchCount.value = found.length
  currentMatchIndex.value = found.length > 0 ? 0 : -1
  if (found.length > 0) scrollToMatch(0)
}

function scrollToMatch(idx: number) {
  highlights.forEach((m, i) => m.classList.toggle('sh-active', i === idx))
  highlights[idx]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function nextMatch() {
  if (!matchCount.value) return
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matchCount.value
  scrollToMatch(currentMatchIndex.value)
}

function prevMatch() {
  if (!matchCount.value) return
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchCount.value) % matchCount.value
  scrollToMatch(currentMatchIndex.value)
}

watch(() => props.article.id, () => {
  highlights = []
  if (showSearch.value && searchQuery.value) {
    nextTick(() => doSearch())
  }
})

const showShareMenu = ref(false)
const shareBtn = ref<HTMLElement | null>(null)
const sharePopupStyle = ref<Record<string, string>>({})

const showTagMenu = ref(false)
const tagBtn = ref<HTMLElement | null>(null)
const tagPopupStyle = ref<Record<string, string>>({})
const labelList = ref<ApiLabel[]>([])
const loadingLabels = ref(false)
const labelsLoaded = ref(false)
const newLabelName = ref('')
const creatingLabel = ref(false)

const articleHasLabels = computed(() => {
  if (labelsLoaded.value) return labelList.value.some((l) => l.checked)
  return (props.article.labels?.length ?? 0) > 0
})

async function openTagMenu() {
  showShareMenu.value = false
  if (showTagMenu.value) {
    showTagMenu.value = false
    return
  }
  if (tagBtn.value) {
    const rect = tagBtn.value.getBoundingClientRect()
    const popupWidth = 220
    let left = rect.left + rect.width / 2 - popupWidth / 2
    left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8))
    tagPopupStyle.value = {
      top: `${rect.bottom + 8}px`,
      left: `${left}px`,
      width: `${popupWidth}px`,
    }
  }
  showTagMenu.value = true
  loadingLabels.value = true
  labelsLoaded.value = false
  try {
    labelList.value = await getLabels(props.article.id)
    labelsLoaded.value = true
  } finally {
    loadingLabels.value = false
  }
}

async function addLabel() {
  const caption = newLabelName.value.trim()
  if (!caption || creatingLabel.value) return
  creatingLabel.value = true
  try {
    const result = await createLabel(caption)
    await setArticleLabel(props.article.id, result.id, true)
    const existing = labelList.value.find((l) => l.id === result.id)
    if (existing) {
      existing.checked = true
    } else {
      labelList.value.push({ id: result.id, caption: result.caption, fg_color: '', bg_color: '', checked: true })
    }
    newLabelName.value = ''
  } finally {
    creatingLabel.value = false
  }
}

async function toggleLabel(label: ApiLabel) {
  const next = !label.checked
  label.checked = next
  try {
    await setArticleLabel(props.article.id, label.id, next)
  } catch {
    label.checked = !next
  }
}

function openShareMenu() {
  showTagMenu.value = false
  if (shareBtn.value) {
    const rect = shareBtn.value.getBoundingClientRect()
    const popupWidth = 200
    let left = rect.left + rect.width / 2 - popupWidth / 2
    left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8))
    sharePopupStyle.value = {
      top: `${rect.bottom + 8}px`,
      left: `${left}px`,
      width: `${popupWidth}px`,
    }
  }
  showShareMenu.value = !showShareMenu.value
}

function onToggleRead() {
  const markingUnread = !props.article.unread
  articlesStore.markRead(props.article.id, props.article.unread)
  if (markingUnread) emit('close')
}

async function copy(type: 'title' | 'link' | 'markdown') {
  showShareMenu.value = false
  let text = ''
  let label = ''
  if (type === 'title') {
    text = props.article.title ?? ''
    label = 'Title copied'
  } else if (type === 'link') {
    text = props.article.link ?? ''
    label = 'Link copied'
  } else {
    text = `[${props.article.title}](${props.article.link})`
    label = 'Markdown link copied'
  }
  try {
    await writeToClipboard(text)
    emit('copied', label)
  } catch {
    emit('copied', 'Copy failed')
  }
}

// Use the browser's own DOMParser to find the first content image and extract it
// as a hero, removing it from the body to avoid showing it twice. The content URL
// is used rather than flavor_image because TT-RSS rewrites content URLs to its
// local image cache while flavor_image retains the original external URL.
function parseHero(content: string): { src: string | null; bodyHtml: string } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')
  const img = doc.querySelector('img[src]')
  if (!img) return { src: null, bodyHtml: doc.body.innerHTML }

  const src = img.getAttribute('src') ?? ''
  if (!src || src.startsWith('data:')) return { src: null, bodyHtml: doc.body.innerHTML }

  const figure = img.closest('figure')
  if (figure) figure.remove()
  else img.remove()

  return { src, bodyHtml: doc.body.innerHTML }
}

const heroUrl = computed(() => {
  const content = (props.article.content ?? '').replace(/https?:\/\/localhost(:\d+)?/g, '')
  if (!content) return props.article.flavor_image ?? null
  const { src } = parseHero(content)
  return src ?? props.article.flavor_image ?? null
})

const readerContent = computed(() => {
  const content = (props.article.content ?? '').replace(/https?:\/\/localhost(:\d+)?/g, '')
  if (!content) return ''
  if (!heroUrl.value) return content
  return parseHero(content).bodyHtml
})

const imageAttachments = computed(() => {
  const atts = props.article.attachments ?? []
  if (!atts.length) return []
  const images = atts.filter(
    (a) => a.content_type?.startsWith('image/') && a.content_url !== heroUrl.value
  )
  if (!images.length) return []
  if (props.article.always_display_attachments) return images
  if (!props.article.content) return images
  return []
})
</script>

<style scoped>
.reader {
  background: var(--color-surface);
}

.reader-loading {
  padding: 32px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.reader-hero {
  width: 100%;
  max-height: 380px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 20px;
  display: block;
}

.reader-attachments {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reader-attachment img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
}

.reader-attachment figcaption {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: 6px;
}

.reader-content {
  font-size: var(--font-size-sm);
  line-height: 1.75;
  color: var(--color-text-primary);
  max-width: 720px;
}

.reader-content :deep(p) {
  margin: 0 0 1.1em;
}

.reader-content :deep(h1),
.reader-content :deep(h2),
.reader-content :deep(h3),
.reader-content :deep(h4) {
  font-weight: 700;
  line-height: var(--line-height-tight);
  margin: 1.5em 0 0.5em;
}

.reader-content :deep(h1) { font-size: 1.35em; }
.reader-content :deep(h2) { font-size: 1.2em; }
.reader-content :deep(h3) { font-size: 1.05em; }

.reader-content :deep(ul),
.reader-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0 0 1.1em;
}

.reader-content :deep(li) {
  margin-bottom: 0.4em;
}

.reader-content :deep(figure) {
  margin: 1.5em 0;
}

.reader-content :deep(figcaption) {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: 6px;
}

.reader-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  display: block;
}

.reader-content :deep(a) {
  color: var(--color-accent);
}

.reader-content :deep(pre) {
  overflow-x: auto;
  background: var(--color-bg);
  padding: 12px;
  border-radius: 4px;
  font-size: var(--font-size-sm);
  margin: 0 0 1.1em;
}

.reader-content :deep(blockquote) {
  border-left: 3px solid var(--color-border);
  padding-left: 1em;
  margin: 0 0 1.1em;
  color: var(--color-text-secondary);
}

.reader-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.tb-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 16px;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.tb-btn:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.tb-btn:focus:not(:focus-visible) {
  outline: none;
  background: transparent;
}

.tb-btn.active {
  color: var(--color-starred);
}

.tb-btn.active :deep(path), .tb-btn.active :deep(polygon) {
  fill: currentColor;
}

:global(.tag-popup) {
  position: fixed;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  z-index: 200;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  max-height: 320px;
  overflow-y: auto;
}

:global(.tag-status) {
  padding: 12px 16px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

:global(.tag-option) {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  transition: background var(--transition-fast);
}

:global(.tag-option:hover) {
  background: var(--color-surface);
}

:global(.tag-dot) {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

:global(.tag-name) {
  flex: 1;
}

:global(.tag-check) {
  color: var(--color-accent);
  flex-shrink: 0;
}

:global(.tag-new) {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-top: 1px solid var(--color-border);
}

:global(.tag-new-input) {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  padding: 4px 6px;
}

:global(.tag-new-input::placeholder) {
  color: var(--color-text-muted);
}

:global(.tag-new-btn) {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--color-accent);
  flex-shrink: 0;
  transition: background var(--transition-fast);
}

:global(.tag-new-btn:hover:not(:disabled)) {
  background: var(--color-surface);
}

:global(.tag-new-btn:disabled) {
  color: var(--color-text-muted);
  cursor: default;
}

:global(.share-popup) {
  position: fixed;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  z-index: 200;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

:global(.share-option) {
  display: block;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  transition: background var(--transition-fast);
  white-space: nowrap;
}

:global(.share-option:hover) {
  background: var(--color-surface);
}

:global(.share-backdrop) {
  position: fixed;
  inset: 0;
  z-index: 199;
}

.reader-search {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.reader-search-input {
  flex: 1;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 5px 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
  min-width: 0;
}

.reader-search-input:focus {
  border-color: var(--color-accent);
}

.reader-search-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
  padding: 0 4px;
}

.reader-search-none {
  color: var(--color-danger);
}

.reader-content :deep(mark.sh) {
  background: rgba(255, 213, 0, 0.3);
  color: inherit;
  border-radius: 2px;
}

.reader-content :deep(mark.sh-active) {
  background: rgba(255, 160, 0, 0.6);
}
</style>
