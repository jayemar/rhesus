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
        class="tb-btn note-btn"
        :class="{ active: currentNote }"
        :title="currentNote ? 'Edit note' : 'Add note'"
        @click.stop="toggleNote"
      ><StickyNote :size="16" /></button>
      <button
        class="tb-btn"
        :class="{ active: showSearch }"
        title="Search in article"
        @click.stop="toggleSearch"
      ><Search :size="16" /></button>
      <button ref="shareBtn" class="tb-btn" title="Share" @click.stop="openShareMenu">
        <Share2 :size="16" />
      </button>
      <button
        class="tb-btn"
        :class="{ active: fullContent !== null }"
        :disabled="fetchingFull"
        :title="fullContent !== null ? 'Show feed content' : 'Fetch full article'"
        @click.stop="toggleFullContent"
      ><Newspaper :size="16" /></button>
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
    <div v-if="showNote" class="reader-note">
      <textarea
        ref="noteInput"
        v-model="noteText"
        class="reader-note-input"
        placeholder="Add a note..."
        @keydown.stop
        @click.stop
      />
      <div class="reader-note-actions">
        <button class="reader-note-save" :disabled="noteSaving" @click.stop="saveNote">Save</button>
        <button class="reader-note-cancel" @click.stop="cancelNote">Cancel</button>
      </div>
    </div>
    <img v-if="heroUrl" class="reader-hero" :src="heroUrl" :alt="heroAlt" @click="openLightbox(heroUrl!, heroAlt)" />
    <div v-if="!article.content" class="reader-loading">Loading article...</div>
    <div v-else ref="contentEl" class="reader-content" v-html="readerContent" @click="onContentClick" />
    <div v-if="article.content" class="reader-end">* * *</div>
    <div v-if="imageAttachments.length" class="reader-attachments">
      <figure v-for="att in imageAttachments" :key="att.id" class="reader-attachment">
        <img :src="att.content_url" :alt="att.title" @click="openLightbox(att.content_url, att.title)" />
        <figcaption v-if="att.title">{{ att.title }}</figcaption>
      </figure>
    </div>
    <Teleport to="body">
      <div
        v-if="lightboxSrc"
        ref="lightboxEl"
        class="lightbox"
        :style="{ cursor: isDragging ? 'grabbing' : imageScale > 1 ? 'grab' : 'zoom-out' }"
        @mousedown="onLightboxMouseDown"
        @click="onLightboxClick"
      >
        <img
          class="lightbox-img"
          :src="lightboxSrc"
          :alt="lightboxAlt"
          draggable="false"
          :style="{ transform: `translate(${panX}px, ${panY}px) scale(${imageScale})` }"
        />
        <p v-if="lightboxAlt" class="lightbox-caption">{{ lightboxAlt }}</p>
      </div>
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
        <button v-if="canNativeShare" class="share-option" @click="nativeShare">Share...</button>
        <button class="share-option" @click="copy('title')">Copy title</button>
        <button class="share-option" @click="copy('link')">Copy link</button>
        <button class="share-option" @click="copy('markdown')">Copy as markdown link</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { Mail, MailOpen, Star, Tag, Check, Plus, ExternalLink, Share2, Search, X, ChevronUp, ChevronDown, StickyNote, Newspaper } from 'lucide-vue-next'
import { useArticlesStore } from '@/stores/articles'
import { getLabels, setArticleLabel, createLabel, saveArticleNote, fetchFullContent } from '@/api/articles'
import { writeToClipboard } from '@/utils/clipboard'
import type { ApiArticle, ApiLabel } from '@/types/api'

const props = defineProps<{ article: ApiArticle }>()
const emit = defineEmits<{ close: [], copied: [label: string] }>()
const articlesStore = useArticlesStore()

const lightboxSrc = ref<string | null>(null)
const lightboxAlt = ref('')
const lightboxEl = ref<HTMLElement | null>(null)
const imageScale = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)

let pinchStartDist = 0
let pinchStartScale = 1
let hasDragged = false
let panStartX = 0
let panStartY = 0
let panOriginX = 0
let panOriginY = 0
let touchPanStartX = 0
let touchPanStartY = 0
let touchPanOriginX = 0
let touchPanOriginY = 0

function getPinchDist(e: TouchEvent): number {
  const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
  const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function onLightboxTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    e.preventDefault()
    pinchStartDist = getPinchDist(e)
    pinchStartScale = imageScale.value
  } else if (e.touches.length === 1) {
    touchPanStartX = e.touches[0]!.clientX
    touchPanStartY = e.touches[0]!.clientY
    touchPanOriginX = panX.value
    touchPanOriginY = panY.value
  }
}

function onLightboxTouchMove(e: TouchEvent) {
  if (e.touches.length === 2) {
    e.preventDefault()
    const dist = getPinchDist(e)
    imageScale.value = Math.min(5, Math.max(0.25, pinchStartScale * (dist / pinchStartDist)))
  } else if (e.touches.length === 1) {
    e.preventDefault()
    panX.value = touchPanOriginX + e.touches[0]!.clientX - touchPanStartX
    panY.value = touchPanOriginY + e.touches[0]!.clientY - touchPanStartY
  }
}

function onLightboxWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    imageScale.value = Math.min(5, Math.max(0.25, imageScale.value * factor))
  }
}

function attachLightboxZoomListeners() {
  const el = lightboxEl.value
  if (!el) return
  el.addEventListener('touchstart', onLightboxTouchStart, { passive: false })
  el.addEventListener('touchmove', onLightboxTouchMove, { passive: false })
  el.addEventListener('wheel', onLightboxWheel, { passive: false })
}

function onLightboxMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  isDragging.value = true
  hasDragged = false
  panStartX = e.clientX
  panStartY = e.clientY
  panOriginX = panX.value
  panOriginY = panY.value
  window.addEventListener('mousemove', onLightboxMouseMove)
  window.addEventListener('mouseup', onLightboxMouseUp)
}

function onLightboxMouseMove(e: MouseEvent) {
  const dx = e.clientX - panStartX
  const dy = e.clientY - panStartY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true
  panX.value = panOriginX + dx
  panY.value = panOriginY + dy
}

function onLightboxMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', onLightboxMouseMove)
  window.removeEventListener('mouseup', onLightboxMouseUp)
}

function onLightboxClick() {
  if (hasDragged) {
    hasDragged = false
    return
  }
  closeLightbox()
}

function detachLightboxZoomListeners() {
  const el = lightboxEl.value
  if (!el) return
  el.removeEventListener('touchstart', onLightboxTouchStart)
  el.removeEventListener('touchmove', onLightboxTouchMove)
  el.removeEventListener('wheel', onLightboxWheel)
  window.removeEventListener('mousemove', onLightboxMouseMove)
  window.removeEventListener('mouseup', onLightboxMouseUp)
}

async function openLightbox(src: string, alt: string) {
  imageScale.value = 1
  panX.value = 0
  panY.value = 0
  lightboxSrc.value = src
  lightboxAlt.value = alt
  history.pushState({ lightbox: true }, '')
  // Capture phase so stopImmediatePropagation() blocks AppShell's bubble-phase handler.
  window.addEventListener('popstate', onLightboxPopstate, { capture: true })
  document.addEventListener('keydown', onLightboxKey)
  await nextTick()
  attachLightboxZoomListeners()
}

function closeLightbox() {
  if (!lightboxSrc.value) return
  detachLightboxZoomListeners()
  window.removeEventListener('popstate', onLightboxPopstate, { capture: true })
  document.removeEventListener('keydown', onLightboxKey)
  lightboxSrc.value = null
  // Suppress the popstate that history.back() fires so AppShell doesn't close the reader.
  const suppress = (e: PopStateEvent) => { e.stopImmediatePropagation() }
  window.addEventListener('popstate', suppress, { capture: true, once: true })
  history.back()
}

function onLightboxPopstate(e: PopStateEvent) {
  e.stopImmediatePropagation()
  detachLightboxZoomListeners()
  window.removeEventListener('popstate', onLightboxPopstate, { capture: true })
  document.removeEventListener('keydown', onLightboxKey)
  lightboxSrc.value = null
}

function onLightboxKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeLightbox()
}

function onContentClick(e: MouseEvent) {
  const img = (e.target as HTMLElement).closest('img')
  if (img) openLightbox((img as HTMLImageElement).src, img.alt)
}

const showNote = ref(false)
const noteText = ref('')
const noteSaving = ref(false)
const noteInput = ref<HTMLTextAreaElement | null>(null)
const currentNote = ref(props.article.note ?? '')

watch(() => props.article.id, () => {
  showNote.value = false
  currentNote.value = props.article.note ?? ''
})

function toggleNote() {
  if (!showNote.value) {
    noteText.value = currentNote.value
    showNote.value = true
    nextTick(() => noteInput.value?.focus())
  } else {
    showNote.value = false
  }
}

async function saveNote() {
  noteSaving.value = true
  try {
    const note = noteText.value.trim()
    await saveArticleNote(props.article.id, note)
    articlesStore.setNote(props.article.id, note)
    currentNote.value = note
    showNote.value = false
  } finally {
    noteSaving.value = false
  }
}

function cancelNote() {
  showNote.value = false
}

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
  fullContent.value = null
  fetchingFull.value = false
  if (showSearch.value && searchQuery.value) {
    nextTick(() => doSearch())
  }
})

const showShareMenu = ref(false)
const shareBtn = ref<HTMLElement | null>(null)
const sharePopupStyle = ref<Record<string, string>>({})

const fullContent = ref<string | null>(null)
const fetchingFull = ref(false)

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

function syncLabelsToStore() {
  articlesStore.setLabels(
    props.article.id,
    labelList.value
      .filter((l) => l.checked)
      .map((l) => [l.id, l.caption, l.fg_color, l.bg_color] as [number, string, string, string]),
  )
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
    syncLabelsToStore()
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
    syncLabelsToStore()
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

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

async function nativeShare() {
  showShareMenu.value = false
  try {
    await navigator.share({
      title: props.article.title ?? undefined,
      url: props.article.link ?? undefined,
    })
  } catch {
    // user cancelled or share failed - no feedback needed
  }
}

async function toggleFullContent() {
  if (fullContent.value !== null) {
    fullContent.value = null
    return
  }
  fetchingFull.value = true
  try {
    const result = await fetchFullContent(props.article.id)
    fullContent.value = result.content
  } catch {
    emit('copied', 'Could not fetch full content')
  } finally {
    fetchingFull.value = false
  }
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
function parseHero(content: string): { src: string | null; alt: string; bodyHtml: string } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')
  const img = doc.querySelector('img[src]')
  if (!img) return { src: null, alt: '', bodyHtml: doc.body.innerHTML }

  const src = img.getAttribute('src') ?? ''
  if (!src || src.startsWith('data:')) return { src: null, alt: '', bodyHtml: doc.body.innerHTML }

  const alt = img.getAttribute('alt') ?? ''
  const figure = img.closest('figure')
  if (figure) figure.remove()
  else img.remove()

  return { src, alt, bodyHtml: doc.body.innerHTML }
}

// Strip any origin from TT-RSS-internal URLs so they resolve as relative paths
// through the frontend proxy, regardless of hostname (localhost, Tailscale, etc.)
const normalizedContent = computed(() =>
  (props.article.content ?? '').replace(/https?:\/\/[^/]+(\/tt-rss\/)/g, '$1')
)

const heroUrl = computed(() => {
  const content = normalizedContent.value
  if (!content) return props.article.flavor_image ?? null
  const { src } = parseHero(content)
  return src ?? props.article.flavor_image ?? null
})

const heroAlt = computed(() => {
  const content = normalizedContent.value
  if (!content) return ''
  return parseHero(content).alt
})

const readerContent = computed(() => {
  if (fullContent.value !== null) return fullContent.value
  const content = normalizedContent.value
  if (!content) return ''
  if (!heroUrl.value) return content
  return parseHero(content).bodyHtml
})

function toRelativeUrl(url: string): string {
  return url.replace(/^https?:\/\/[^/]+(\/tt-rss\/)/, '$1')
}

const imageAttachments = computed(() => {
  const atts = props.article.attachments ?? []
  if (!atts.length) return []
  const images = atts
    .filter((a) => a.content_type?.startsWith('image/'))
    .map((a) => ({ ...a, content_url: toRelativeUrl(a.content_url) }))
    .filter((a) => a.content_url !== heroUrl.value)
  if (!images.length) return []
  if (props.article.always_display_attachments) return images
  // Show enclosure images when content has no inline images (e.g. BBC-style
  // articles with text-only content and a thumbnail-only enclosure)
  if (!heroUrl.value) return images
  return []
})
</script>

<style scoped>
.reader {
  background: transparent;
}

.reader-loading {
  padding: 32px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.reader-hero {
  width: calc(100% + 2 * var(--reader-h-pad, 24px));
  margin-left: calc(-1 * var(--reader-h-pad, 24px));
  max-height: 420px;
  object-fit: cover;
  border-radius: 0;
  margin-bottom: 24px;
  display: block;
  cursor: zoom-in;
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
  cursor: zoom-in;
}

.reader-attachment figcaption {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: 6px;
}

.reader-content {
  font-size: var(--font-size-base);
  line-height: 1.75;
  color: var(--color-text-primary);
  max-width: 66ch;
  margin: 0 auto;
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
  cursor: zoom-in;
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
  border-left: 4px solid var(--color-accent);
  padding: 0.75em 1em;
  margin: 0 0 1.1em;
  background: rgba(128, 128, 128, 0.08);
  border-radius: 0 4px 4px 0;
  font-style: italic;
  color: var(--color-text-secondary);
}

.reader-end {
  text-align: center;
  color: var(--color-text-muted);
  letter-spacing: 0.5em;
  margin: 2em 0 1em;
  font-size: var(--font-size-sm);
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

.reader-note {
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.reader-note-input {
  width: 100%;
  min-height: 80px;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-body);
  resize: vertical;
  outline: none;
}

.reader-note-input:focus {
  border-color: var(--color-accent);
}

.reader-note-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  justify-content: flex-end;
}

.reader-note-save,
.reader-note-cancel {
  padding: 4px 14px;
  border-radius: 4px;
  font-size: var(--font-size-sm);
  cursor: pointer;
  border: none;
  font-family: var(--font-body);
}

.reader-note-save {
  background: var(--color-accent);
  color: #fff;
}

.reader-note-save:disabled {
  opacity: 0.6;
  cursor: default;
}

.reader-note-cancel {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.note-btn.active :deep(path), .note-btn.active :deep(rect) {
  fill: currentColor;
}

:global(.lightbox) {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  touch-action: none;
  overflow: hidden;
  user-select: none;
}

:global(.lightbox-img) {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 4px;
  transform-origin: center center;
}

:global(.lightbox-caption) {
  color: #fff;
  font-size: var(--font-size-sm);
  text-align: center;
  margin-top: 12px;
  max-width: 720px;
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

<style>
[data-theme='dark'] .reader-note-save {
  color: #1a1a1a;
}
</style>
