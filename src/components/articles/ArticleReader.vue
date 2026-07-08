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
      <button class="tb-btn" :class="{ active: articleHasLabels }" title="Labels" @click.stop="openTagMenu">
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
      <button class="tb-btn" title="Share" @click.stop="openShareMenu">
        <Share2 :size="16" />
      </button>
      <button
        class="tb-btn"
        :class="{ active: fullContent !== null }"
        :disabled="fetchingFull"
        :title="fullContent !== null ? 'Show feed content' : 'Fetch full article'"
        @click.stop="toggleFullContent"
      ><Newspaper :size="16" /></button>
      <button class="tb-btn" title="More options" @click.stop="openMoreMenu">
        <MoreVertical :size="16" />
      </button>
    </footer>
    <Teleport defer to=".reader-overlay-panel">
      <Transition name="fade">
        <div v-if="scrolled" class="floating-toolbar">
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
          <button
            class="tb-btn"
            :class="{ active: articleHasLabels }"
            title="Labels"
            @click.stop="openTagMenu"
          ><Tag :size="16" /></button>
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
          <button
            class="tb-btn"
            title="Share"
            @click.stop="openShareMenu"
          ><Share2 :size="16" /></button>
          <button
            class="tb-btn"
            :class="{ active: fullContent !== null }"
            :disabled="fetchingFull"
            :title="fullContent !== null ? 'Show feed content' : 'Fetch full article'"
            @click.stop="toggleFullContent"
          ><Newspaper :size="16" /></button>
          <button
            class="tb-btn"
            title="More options"
            @click.stop="openMoreMenu"
          ><MoreVertical :size="16" /></button>
          <div class="floating-toolbar-divider" />
          <button class="tb-btn" title="Back to top" @click.stop="emit('scroll-to-top')">
            <ChevronUp :size="16" />
          </button>
        </div>
      </Transition>
    </Teleport>
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
    <img v-if="heroUrl" class="reader-hero" :style="heroCaption ? {} : { marginBottom: '20px' }" :src="heroUrl" :alt="heroAlt" @click="openLightbox(heroUrl!, heroAlt)" />
    <p v-if="heroCaption" class="reader-hero-caption">{{ heroCaption }}</p>
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
      <div v-if="showMoreMenu" class="share-backdrop" @click="showMoreMenu = false" />
      <div
        v-if="showMoreMenu"
        class="share-popup"
        :style="morePopupStyle"
        @click.stop
      >
        <button
          class="share-option share-option--font"
          :style="{ fontFamily: currentFont.fontFamily }"
          @click="openMoreFontDropdown"
        >
          Font: {{ currentFont.label }}
          <ChevronRight :size="13" class="share-option-chevron" />
        </button>
        <button class="share-option" @click="openMoreCatDropdown">
          Category: {{ userCategories.find(c => c.id === currentCatId)?.title ?? 'Uncategorized' }}
          <ChevronRight :size="13" class="share-option-chevron" />
        </button>
        <button class="share-option" @click="promptUnsubscribe">Unsubscribe from feed</button>
      </div>
      <div v-if="moreCatOpen" class="font-backdrop" @click="moreCatOpen = false" />
      <div v-if="moreCatOpen" class="font-dropdown" :style="moreCatDropdownStyle" @click.stop>
        <button
          v-for="cat in userCategories"
          :key="cat.id"
          class="font-option"
          :class="{ active: cat.id === currentCatId }"
          @click="selectCategory(cat.id)"
        >{{ cat.title }}</button>
      </div>
      <div v-if="moreFontOpen" class="font-backdrop" @click="moreFontOpen = false" />
      <div v-if="moreFontOpen" class="font-dropdown" :style="moreFontDropdownStyle" @click.stop>
        <button
          v-for="opt in fontOptions"
          :key="opt.value"
          class="font-option"
          :class="{ active: settingsStore.settings.font_family === opt.value }"
          :style="{ fontFamily: opt.fontFamily }"
          @click="selectReaderFont(opt.value)"
        >{{ opt.label }}</button>
      </div>
      <ConfirmDialog
        v-if="feedToUnsubscribe"
        :message="`Unsubscribe from &quot;${feedToUnsubscribe.title}&quot;?`"
        @confirm="doUnsubscribe"
        @cancel="feedToUnsubscribe = null"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import DOMPurify from 'dompurify'
import { Readability } from '@mozilla/readability'
import { Mail, MailOpen, Star, Tag, Check, Plus, MoreVertical, Share2, Search, X, ChevronUp, ChevronDown, StickyNote, Newspaper, ChevronRight } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useArticlesStore } from '@/stores/articles'
import { useFeedsStore } from '@/stores/feeds'
import { useSettingsStore } from '@/stores/settings'
import { getLabels, setArticleLabel, createLabel, saveArticleNote, fetchFullContent } from '@/api/articles'
import { deleteFeed, editFeed } from '@/api/feeds'
import { writeToClipboard } from '@/utils/clipboard'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { ApiArticle, ApiLabel } from '@/types/api'

const props = defineProps<{ article: ApiArticle, scrolled?: boolean }>()
const emit = defineEmits<{ close: [], copied: [label: string], 'scroll-to-top': [] }>()
const articlesStore = useArticlesStore()
const feedsStore = useFeedsStore()
const settingsStore = useSettingsStore()

const fontOptions = [
  { value: 'system', label: 'System UI', fontFamily: 'system-ui, -apple-system, sans-serif' },
  { value: 'inter', label: 'Inter', fontFamily: "'Inter', sans-serif" },
  { value: 'nunito', label: 'Nunito', fontFamily: "'Nunito', sans-serif" },
  { value: 'merriweather', label: 'Merriweather', fontFamily: "'Merriweather', serif" },
  { value: 'lora', label: 'Lora', fontFamily: "'Lora', serif" },
]

// Anchors a fixed-position popup next to the button that opened it, flipping
// to open upward when the button sits in the lower half of the viewport (e.g.
// the floating toolbar near the bottom of the screen) so the popup doesn't
// run off-screen.
function anchorPopupStyle(rect: DOMRect, width: number): Record<string, string> {
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  if (spaceBelow < spaceAbove) {
    return { bottom: `${window.innerHeight - rect.top + 8}px`, left: `${left}px`, width: `${width}px` }
  }
  return { top: `${rect.bottom + 8}px`, left: `${left}px`, width: `${width}px` }
}

const moreFontOpen = ref(false)
const moreFontDropdownStyle = ref<Record<string, string>>({})

const currentFont = computed(() =>
  fontOptions.find(o => o.value === settingsStore.settings.font_family) ?? fontOptions[0]!
)

function openMoreFontDropdown() {
  showMoreMenu.value = false
  if (moreBtn.value) {
    moreFontDropdownStyle.value = anchorPopupStyle(moreBtn.value.getBoundingClientRect(), 180)
  }
  moreFontOpen.value = true
}

function selectReaderFont(value: string) {
  settingsStore.settings.font_family = value as typeof settingsStore.settings.font_family
  moreFontOpen.value = false
}

const moreCatOpen = ref(false)
const moreCatDropdownStyle = ref<Record<string, string>>({})

const userCategories = computed(() => {
  const cats: { id: number; title: string }[] = [{ id: 0, title: 'Uncategorized' }]
  for (const item of feedsStore.tree) {
    if (item.type === 'category' && item.bare_id > 0) {
      cats.push({ id: item.bare_id, title: item.name })
    }
  }
  return cats
})

function findFeedCatId(items: typeof feedsStore.tree, feedId: number): number | undefined {
  for (const item of items) {
    if (item.type === 'category' && item.bare_id >= 0) {
      if (item.items?.some(f => f.bare_id === feedId)) return item.bare_id
      if (item.items) {
        const found = findFeedCatId(item.items, feedId)
        if (found !== undefined) return found
      }
    }
  }
  return undefined
}

const currentCatId = computed(() =>
  findFeedCatId(feedsStore.tree, props.article.feed_id) ?? 0
)

function openMoreCatDropdown() {
  showMoreMenu.value = false
  if (moreBtn.value) {
    moreCatDropdownStyle.value = anchorPopupStyle(moreBtn.value.getBoundingClientRect(), 200)
  }
  moreCatOpen.value = true
}

async function selectCategory(catId: number) {
  moreCatOpen.value = false
  await editFeed(props.article.feed_id, { cat_id: catId })
  feedsStore.loadTree()
}

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
  if (img) {
    const caption = (img as HTMLImageElement).alt
      || stripHtml(img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ?? '')
      || ''
    openLightbox((img as HTMLImageElement).src, caption)
    return
  }
  const a = (e.target as HTMLElement).closest('a')
  if (a?.href) {
    e.preventDefault()
    window.open(a.href, '_blank', 'noopener,noreferrer')
  }
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

const showMoreMenu = ref(false)
const moreBtn = ref<HTMLElement | null>(null)
const morePopupStyle = ref<Record<string, string>>({})
const feedToUnsubscribe = ref<{ id: number; title: string } | null>(null)

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

async function openTagMenu(event: MouseEvent) {
  showShareMenu.value = false
  if (showTagMenu.value) {
    showTagMenu.value = false
    return
  }
  tagBtn.value = event.currentTarget as HTMLElement
  if (tagBtn.value) {
    tagPopupStyle.value = anchorPopupStyle(tagBtn.value.getBoundingClientRect(), 220)
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

function openShareMenu(event: MouseEvent) {
  showTagMenu.value = false
  shareBtn.value = event.currentTarget as HTMLElement
  if (shareBtn.value) {
    sharePopupStyle.value = anchorPopupStyle(shareBtn.value.getBoundingClientRect(), 200)
  }
  showShareMenu.value = !showShareMenu.value
}

function openMoreMenu(event: MouseEvent) {
  showShareMenu.value = false
  if (showMoreMenu.value) { showMoreMenu.value = false; return }
  moreBtn.value = event.currentTarget as HTMLElement
  if (moreBtn.value) {
    morePopupStyle.value = anchorPopupStyle(moreBtn.value.getBoundingClientRect(), 200)
  }
  showMoreMenu.value = true
}

function promptUnsubscribe() {
  showMoreMenu.value = false
  feedToUnsubscribe.value = { id: props.article.feed_id, title: props.article.feed_title ?? 'this feed' }
}

async function doUnsubscribe() {
  const feed = feedToUnsubscribe.value
  feedToUnsubscribe.value = null
  if (!feed) return
  await deleteFeed(feed.id)
  feedsStore.loadTree()
  emit('close')
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
    const doc = new DOMParser().parseFromString(result.content, 'text/html')
    doc.documentElement.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
    const base = doc.createElement('base')
    base.setAttribute('href', result.url)
    doc.head.appendChild(base)
    // Remove site-specific UI control elements hidden by the original page's CSS/JS
    doc.querySelectorAll('b[class], span[class]').forEach(el => el.remove())

    // Normalize image+caption div pairs to semantic <figure>/<figcaption> so
    // that sites like NPR (which don't use <figure>) get caption styling.
    doc.querySelectorAll('img:not(figure img)').forEach(img => {
      const picture = img.closest('picture')
      const imageNode = picture ?? img
      const imageWrapper = imageNode.parentElement
      if (!imageWrapper) return
      const captionSibling = imageWrapper.nextElementSibling
      if (!captionSibling) return
      const captionEl = captionSibling.querySelector('[class*="caption"] p, [aria-label*="caption"] p')
      if (!captionEl) return
      const text = captionEl.textContent?.trim()
      if (!text) return
      const grandParent = imageWrapper.parentElement
      if (!grandParent) return
      const figure = doc.createElement('figure')
      const figcaption = doc.createElement('figcaption')
      figcaption.textContent = text
      figure.appendChild(imageNode.cloneNode(true))
      figure.appendChild(figcaption)
      grandParent.insertBefore(figure, imageWrapper)
      imageWrapper.remove()
      captionSibling.remove()
    })

    const article = new Readability(doc).parse()
    fullContent.value = article?.content ?? result.content
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
    const silent = await writeToClipboard(text)
    if (silent) emit('copied', label)
  } catch {
    emit('copied', 'Copy failed')
  }
}

// Takes the first URL from a srcset string. Handles both ", " (comma+space) and
// ",\n" (comma+newline) entry separators, while preserving URLs that contain internal
// commas (e.g. Cloudinary transformation URLs like w_700,h_700,c_fit/...).
// The lookahead requires whitespace then a non-whitespace char after the comma, which
// matches real entry boundaries but not internal commas (no whitespace follows them).
function firstSrcsetUrl(srcset: string): string | null {
  if (!srcset) return null
  const first = srcset.split(/,(?=\s+\S)/)[0]?.trim()
  if (!first) return null
  return first.replace(/\s+\d+(\.\d+)?[wx]$/, '').trim() || null
}

// Strip HTML tags from a string to get plain text.
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

// Detect small icon/share-button images by declared size: both width and height
// present and <= 50px. Some themes/plugins (e.g. "Social Media Feather") inject
// share-button icons directly into post content, which would otherwise be picked
// as the hero image ahead of any real content photo. Images with no declared
// dimensions are treated as real content, since they can't be judged this way.
function isIconSizedImage(img: HTMLImageElement): boolean {
  const width = parseInt(img.getAttribute('width') ?? '', 10)
  const height = parseInt(img.getAttribute('height') ?? '', 10)
  return Number.isFinite(width) && Number.isFinite(height) && width <= 50 && height <= 50
}

// Use the browser's own DOMParser to find the first content image and extract it
// as a hero, removing it from the body to avoid showing it twice. The content URL
// is used rather than flavor_image because TT-RSS rewrites content URLs to its
// local image cache while flavor_image retains the original external URL.
// Falls back to data-caption for alt/caption when the standard attributes are empty
// (Verge stores captions in data-caption rather than alt or figcaption).
function parseHero(content: string): { src: string | null; alt: string; caption: string; bodyHtml: string } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')

  // Resolve relative image/link URLs (e.g. a site emitting <img src="../media/x.jpg">)
  // before picking a hero candidate - otherwise a relative src extracted here would
  // never go through processContent()'s own resolveRelativeUrls() call, since that
  // only runs on the body content left AFTER the hero is pulled out.
  resolveRelativeUrls(doc, props.article.link ?? undefined)

  for (const img of doc.querySelectorAll('img')) {
    if (isIconSizedImage(img)) continue

    const dcText = stripHtml(img.getAttribute('data-caption') ?? '')
    const alt = img.getAttribute('alt') ?? ''
    let src: string | null = null

    // Prefer <source data-srcset|srcset> from a parent <picture>: lazy-loaded images
    // often have a broken or stub src while the real URL lives in data-srcset.
    const picture = img.closest('picture')
    if (picture) {
      const source = picture.querySelector('source[data-srcset], source[srcset]')
      if (source) {
        const raw = source.getAttribute('data-srcset') ?? source.getAttribute('srcset') ?? ''
        src = firstSrcsetUrl(raw)
      }
    }

    if (!src) src = img.getAttribute('data-src') ?? img.getAttribute('src') ?? null
    if (!src || src.startsWith('data:') || src === 'undefined' || src === 'null') continue
    if (/\/tracking[/.]|[-_]pixel\./i.test(src)) continue

    const container = img.closest('figure') ?? picture ?? img
    const caption = stripHtml(container.querySelector('figcaption')?.textContent?.trim() ?? '') || dcText
    container.remove()

    return { src, alt, caption, bodyHtml: doc.body.innerHTML }
  }

  return { src: null, alt: '', caption: '', bodyHtml: doc.body.innerHTML }
}

// Strip any origin from TT-RSS-internal URLs so they resolve as relative paths
// through the frontend proxy, regardless of hostname (localhost, Tailscale, etc.)
const normalizedContent = computed(() =>
  (props.article.content ?? '').replace(/https?:\/\/[^/]+(\/tt-rss\/)/g, '$1')
)

// Memoizes parseHero for the active content source. Uses fullContent when fetched
// so that the hero alt text and URL reflect the full article rather than the RSS excerpt.
const parsedHero = computed(() => {
  const content = fullContent.value !== null ? fullContent.value : normalizedContent.value
  if (!content) return null
  return parseHero(content)
})

function isUsableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (/\/tracking[/.]|[-_]pixel\./i.test(url)) return false
  if (/\/undefined(?:[?#/]|$)/.test(url)) return false
  return true
}

const heroUrl = computed(() => {
  const fi = props.article.flavor_image ? toRelativeUrl(props.article.flavor_image) : null
  return parsedHero.value?.src ?? (isUsableImageUrl(fi) ? fi : null)
})

const heroAlt = computed(() => parsedHero.value?.alt ?? '')

const heroCaption = computed(() => {
  if (!heroUrl.value) return ''
  return parsedHero.value?.caption ?? ''
})

function resolveRelativeUrls(doc: Document, baseUrl: string | undefined): void {
  if (!baseUrl) return
  let base: URL
  try { base = new URL(baseUrl) } catch { return }
  // normalizedContent() deliberately strips our own TT-RSS server's origin from
  // /tt-rss/-rooted URLs (image cache paths, etc.) so they resolve relative to
  // whatever host the SPA is served from. Those must not be re-absolutized
  // against the article's own site here, or they'd point at the wrong origin.
  doc.querySelectorAll('img[src]').forEach(el => {
    const src = el.getAttribute('src')
    if (src && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:') && !src.startsWith('/tt-rss/'))
      try { el.setAttribute('src', new URL(src, base).href) } catch {}
  })
  doc.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href')
    if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('/tt-rss/'))
      try { el.setAttribute('href', new URL(href, base).href) } catch {}
  })
}

function processContent(html: string): string {
  // Preprocess before DOMPurify strips data-* attributes: move data-caption
  // into alt (for lightbox) and figcaption (for below-image display) when empty.
  const pre = new DOMParser().parseFromString(html, 'text/html')
  pre.querySelectorAll('img[src]').forEach(el => {
    const src = el.getAttribute('src') ?? ''
    if (src === 'undefined' || src === '' || src === 'null' || /\/tracking[/.]|[-_]pixel\./i.test(src))
      el.remove()
  })
  resolveRelativeUrls(pre, props.article.link ?? undefined)
  pre.querySelectorAll('img[data-caption]').forEach(img => {
    const dc = img.getAttribute('data-caption') ?? ''
    const dcText = stripHtml(dc)
    if (!dcText) return
    const fig = img.closest('figure')
    if (fig) {
      const fc = fig.querySelector('figcaption')
      if (fc && !fc.textContent?.trim()) fc.textContent = dcText
    } else {
      const figure = pre.createElement('figure')
      const figcaption = pre.createElement('figcaption')
      figcaption.textContent = dcText
      img.parentNode?.insertBefore(figure, img)
      figure.appendChild(img)
      figure.appendChild(figcaption)
    }
  })
  const sanitized = DOMPurify.sanitize(pre.body.innerHTML)
  const doc = new DOMParser().parseFromString(sanitized, 'text/html')
  doc.querySelectorAll('table').forEach(table => {
    const wrapper = doc.createElement('div')
    wrapper.className = 'table-scroll'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })
  return doc.body.innerHTML
}

const readerContent = computed(() => {
  const content = fullContent.value !== null ? fullContent.value : normalizedContent.value
  if (!content) return ''
  const body = parsedHero.value?.bodyHtml ?? content
  if (!heroUrl.value) return processContent(content)
  return processContent(body)
})

function toRelativeUrl(url: string): string {
  return url.replace(/^https?:\/\/[^/]+(\/tt-rss\/)/, '$1')
}

const imageAttachments = computed(() => {
  const atts = props.article.attachments ?? []
  if (!atts.length) return []
  const images = atts
    .filter((a) => a.content_type?.startsWith('image/'))
    .map((a) => ({
      ...a,
      content_url: toRelativeUrl(a.content_url),
      title: a.title === 'og:thumbnail' ? '' : (a.title ?? ''),
    }))
    .filter((a) => a.content_url !== heroUrl.value)
  if (!images.length) return []
  if (props.article.always_display_attachments) return images
  // Show enclosure images when content has no inline images (e.g. BBC-style
  // articles with text-only content and a thumbnail-only enclosure)
  if (!heroUrl.value) return images
  return []
})

// Collapse images that fail to load rather than showing a broken-image icon.
// This backstops every upstream heuristic: beacons with no dimensions and an
// innocuous URL, dead CDN links in old articles, and anything else that slips
// through server-side stripping. Listeners are (re)attached whenever the
// rendered content changes, since v-html replaces the DOM wholesale.
function hideBrokenImage(ev: Event) {
  (ev.target as HTMLElement).style.display = 'none'
}

watch(
  () => [readerContent.value, contentEl.value] as const,
  () => {
    nextTick(() => {
      const el = contentEl.value
      if (!el) return
      for (const img of el.querySelectorAll('img')) {
        // Already finished loading and failed (e.g. cached failure before
        // this watcher ran): hide immediately, no error event will re-fire
        if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
          img.style.display = 'none'
        } else {
          img.addEventListener('error', hideBrokenImage, { once: true })
        }
      }
    })
  },
  { immediate: true },
)
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
  margin-bottom: 8px;
  display: block;
  cursor: zoom-in;
}

.reader-hero-caption {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0 0 20px;
  font-style: italic;
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

.reader-content :deep(*) {
  position: static !important;
}

.reader-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  display: block;
  cursor: zoom-in;
  margin-bottom: 1.5em;
}

.reader-content :deep(figure img) {
  margin-bottom: 0;
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

.reader-content :deep(.table-scroll) {
  overflow-x: auto;
  margin: 0 0 1.5em;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.reader-content :deep(table) {
  border-collapse: collapse;
  font-size: var(--font-size-sm);
  min-width: 100%;
}

.reader-content :deep(th),
.reader-content :deep(td) {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}

.reader-content :deep(th:last-child),
.reader-content :deep(td:last-child) {
  border-right: none;
}

.reader-content :deep(th) {
  font-weight: 600;
  background: rgba(128, 128, 128, 0.1);
  white-space: nowrap;
}

.reader-content :deep(tr:last-child td) {
  border-bottom: none;
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
  justify-content: space-between;
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

:global(.share-option--font) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:global(.share-option-chevron) {
  flex-shrink: 0;
  color: var(--color-text-muted);
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
  color: var(--color-on-accent);
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

.font-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
}

.font-dropdown {
  position: fixed;
  z-index: 200;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.font-option {
  display: block;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  transition: background var(--transition-fast);
  white-space: nowrap;
}

.font-option:hover,
.font-option.active {
  background: var(--color-surface);
}

.font-option.active {
  color: var(--color-accent);
}

.floating-toolbar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.floating-toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 4px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
