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
      <button class="tb-btn" :class="{ active: articleHasLabels }" title="Labels" @click.stop="openLabelMenu">
        <TagIcon :size="16" />
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
    <Teleport defer to=".reader-overlay">
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
            @click.stop="openLabelMenu"
          ><TagIcon :size="16" /></button>
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
    <Teleport defer to=".reader-overlay">
      <Transition name="fade">
        <div v-if="showSearch" class="floating-search">
          <div class="reader-search-input-wrap">
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
            <button
              v-if="searchQuery"
              class="reader-search-clear-btn"
              type="button"
              title="Clear"
              @click.stop="clearSearch"
            ><X :size="14" /></button>
          </div>
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
      </Transition>
    </Teleport>
    <Teleport defer to=".reader-overlay">
      <Transition name="fade">
        <div v-if="showNote" class="floating-note">
          <div class="reader-note-input-wrap">
            <textarea
              ref="noteInput"
              v-model="noteText"
              class="reader-note-input"
              placeholder="Add a note..."
              @keydown.stop
              @click.stop
            />
            <button
              v-if="noteText"
              class="reader-note-clear-btn"
              type="button"
              title="Clear"
              @click.stop="noteText = ''"
            ><X :size="14" /></button>
          </div>
          <div class="reader-note-actions">
            <button class="reader-note-save" :disabled="noteSaving" @click.stop="saveNote">Save</button>
            <button class="reader-note-cancel" @click.stop="cancelNote">Cancel</button>
          </div>
        </div>
      </Transition>
    </Teleport>
    <img
      v-if="heroUrl && !heroImageFailed"
      class="reader-hero"
      :style="heroCaption ? {} : { marginBottom: '20px' }"
      :src="heroUrl"
      :alt="heroAlt"
      decoding="async"
      @click="openLightbox(heroUrl!, heroAlt)"
      @error="heroImageFailed = true"
    />
    <div v-else-if="heroUrl" class="reader-hero-broken">
      <ImageOff :size="18" class="reader-hero-broken-icon" />
      <span>{{ heroAlt || 'Image unavailable' }}</span>
    </div>
    <p v-if="heroCaption" class="reader-hero-caption">{{ heroCaption }}</p>
    <div v-if="fetchingFull" class="reader-loading">Loading article...</div>
    <div v-else-if="!article.content && fullContent === null" class="reader-loading reader-loading--empty">
      <p>No content available for this article.</p>
      <button class="reader-loading-retry" @click="toggleFullContent">Try fetching full article</button>
    </div>
    <div v-else ref="contentEl" class="reader-content" v-html="readerContent" @click="onContentClick" />
    <div v-if="article.content" class="reader-end">* * *</div>
    <div v-if="imageAttachments.length" class="reader-attachments">
      <figure v-for="att in imageAttachments" :key="att.id" class="reader-attachment">
        <img :src="att.content_url" :alt="att.title" loading="lazy" decoding="async" @click="openLightbox(att.content_url, att.title)" />
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
      <div v-if="showLabelMenu" class="share-backdrop" @click="showLabelMenu = false" />
      <div
        v-if="showLabelMenu"
        class="label-popup"
        :style="labelPopupStyle"
        @click.stop
      >
        <div v-if="loadingLabels" class="label-status">Loading...</div>
        <button
          v-for="label in labelList"
          :key="label.id"
          class="label-option"
          @click="toggleLabel(label)"
        >
          <span class="label-dot" :style="{ background: label.bg_color || 'var(--color-text-muted)' }" />
          <span class="label-name">{{ label.caption }}</span>
          <Check v-if="label.checked" :size="13" class="label-check" />
        </button>
        <div class="label-new">
          <input
            v-model="newLabelName"
            class="label-new-input"
            placeholder="New label..."
            maxlength="64"
            @keydown.enter.prevent="addLabel"
            @keydown.stop
            @click.stop
          />
          <button
            class="label-new-btn"
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
        <button v-if="article.link" class="share-option" @click="openInNewTab">Open in new tab</button>
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
        <button class="share-option" @click="openMoreTagsDropdown">
          Tags ({{ nonEmptyTags.length }})
          <ChevronRight :size="13" class="share-option-chevron" />
        </button>
        <button
          class="share-option"
          :disabled="!settingsStore.snoozeAvailable"
          :title="settingsStore.snoozeAvailable ? '' : 'Snooze plugin not installed'"
          @click="openMoreSnoozeDropdown"
        >
          Snooze
          <ChevronRight :size="13" class="share-option-chevron" />
        </button>
        <button
          class="share-option"
          :disabled="!settingsStore.selfDestructAvailable"
          :title="settingsStore.selfDestructAvailable ? '' : 'Self-destruct plugin not installed'"
          @click="openMoreSelfDestructDropdown"
        >
          Self-destruct
          <ChevronRight :size="13" class="share-option-chevron" />
        </button>
        <button class="share-option" @click="openFeedEditDialog">Edit feed</button>
        <button class="share-option" :disabled="refetching" @click="refetchCurrentArticle">
          {{ refetching ? 'Refetching...' : 'Refetch article' }}
        </button>
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
      <div v-if="moreTagsOpen" class="font-backdrop" @click="moreTagsOpen = false" />
      <div v-if="moreTagsOpen" class="font-dropdown tags-popup" :style="moreTagsDropdownStyle" @click.stop>
        <div class="tags-popup-heading">Tags</div>
        <div v-if="!nonEmptyTags.length" class="label-status">No tags</div>
        <template v-else>
          <label
            class="tag-row"
            :class="{ 'tag-row--static': !pickingTagsForFilter }"
            v-for="tag in nonEmptyTags"
            :key="tag"
          >
            <input
              v-if="pickingTagsForFilter"
              type="checkbox"
              :checked="selectedTags.has(tag)"
              @change="toggleTagSelection(tag)"
            />
            <span class="tag-text">{{ tag }}</span>
          </label>
          <div class="tag-filter-footer">
            <button
              v-if="!pickingTagsForFilter"
              class="tag-filter-create-btn"
              @click="pickingTagsForFilter = true"
            >Create filter...</button>
            <button
              v-else
              class="tag-filter-create-btn"
              :disabled="!selectedTags.size"
              @click="onCreateFilterFromSelectedTags"
            >Create filter{{ selectedTags.size ? ` (${selectedTags.size})` : '' }}</button>
          </div>
        </template>
      </div>
      <div v-if="snoozeOpen" class="font-backdrop" @click="snoozeOpen = false" />
      <div v-if="snoozeOpen" class="font-dropdown tags-popup" :style="snoozeDropdownStyle" @click.stop>
        <div class="tags-popup-heading">Snooze until</div>
        <button
          v-for="preset in snoozePresets"
          :key="preset.label"
          class="font-option"
          :disabled="snoozing"
          @click="confirmSnooze(preset.until())"
        >{{ preset.label }}<span v-if="presetHint(preset)" class="snooze-preset-hint"> ({{ presetHint(preset) }})</span></button>
        <div class="tag-filter-footer snooze-custom-row">
          <input
            v-model="snoozeCustomValue"
            type="datetime-local"
            class="snooze-datetime-input"
            :disabled="snoozing"
          />
          <button
            class="tag-filter-create-btn"
            :disabled="snoozing || !snoozeCustomValue"
            @click="confirmCustomSnooze"
          >{{ snoozing ? 'Snoozing...' : 'Snooze' }}</button>
        </div>
      </div>
      <div v-if="selfDestructOpen" class="font-backdrop" @click="selfDestructOpen = false" />
      <div v-if="selfDestructOpen" class="font-dropdown tags-popup" :style="selfDestructDropdownStyle" @click.stop>
        <div class="tags-popup-heading">Self-destruct in</div>
        <button
          v-for="preset in selfDestructPresets"
          :key="preset.label"
          class="font-option"
          :disabled="selfDestructing"
          @click="confirmSelfDestruct(preset.until())"
        >{{ preset.label }}</button>
        <div class="tag-filter-footer snooze-custom-row">
          <input
            v-model="selfDestructCustomValue"
            type="datetime-local"
            class="snooze-datetime-input"
            :disabled="selfDestructing"
          />
          <button
            class="tag-filter-create-btn"
            :disabled="selfDestructing || !selfDestructCustomValue"
            @click="confirmCustomSelfDestruct"
          >{{ selfDestructing ? 'Queuing...' : 'Queue' }}</button>
        </div>
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
      <FeedEditDialog
        v-if="showFeedEditDialog"
        :feed-id="article.feed_id"
        @close="showFeedEditDialog = false"
        @unsubscribed="onFeedUnsubscribed"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import DOMPurify from 'dompurify'
import { Readability } from '@mozilla/readability'
import { Mail, MailOpen, Star, Tag as TagIcon, Check, Plus, MoreVertical, Share2, Search, X, ChevronUp, ChevronDown, StickyNote, Newspaper, ChevronRight, ImageOff } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useArticlesStore } from '@/stores/articles'
import { useFeedsStore } from '@/stores/feeds'
import { useSettingsStore } from '@/stores/settings'
import { getLabels, setArticleLabel, createLabel, saveArticleNote, fetchFullContent, refetchArticle } from '@/api/articles'
import { snoozeArticle } from '@/api/snooze'
import { selfDestructArticle } from '@/api/selfDestruct'
import { editFeed } from '@/api/feeds'
import { writeToClipboard } from '@/utils/clipboard'
import { extractJsonLdMeta } from '@/utils/jsonld'
import { stripInvisibleEntityArtifacts, fixUnescapedDataAttributeQuotes, decodeResidualEntities } from '@/utils/text'
import { anchorPopupStyle } from '@/utils/popup'
import FeedEditDialog from '@/components/feeds/FeedEditDialog.vue'
import type { ApiArticle, ApiLabel } from '@/types/api'

const props = defineProps<{ article: ApiArticle, scrolled?: boolean }>()
const emit = defineEmits<{
  close: []
  copied: [label: string]
  'scroll-to-top': []
  'create-filter-from-tags': [tags: string[]]
  'full-content-meta': [meta: { author?: string, publishedAt?: number }]
  'edit-feed': [feedId: number]
}>()
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

const moreTagsOpen = ref(false)
const moreTagsDropdownStyle = ref<Record<string, string>>({})
const selectedTags = ref<Set<string>>(new Set())
const pickingTagsForFilter = ref(false)

const nonEmptyTags = computed(() =>
  (props.article.tags ?? []).map(t => t.trim()).filter(t => t !== '')
)

function openMoreTagsDropdown() {
  showMoreMenu.value = false
  if (moreBtn.value) {
    moreTagsDropdownStyle.value = anchorPopupStyle(moreBtn.value.getBoundingClientRect(), 220)
  }
  selectedTags.value = new Set()
  pickingTagsForFilter.value = false
  moreTagsOpen.value = true
}

function toggleTagSelection(tag: string) {
  const next = new Set(selectedTags.value)
  if (next.has(tag)) next.delete(tag)
  else next.add(tag)
  selectedTags.value = next
}

const snoozeOpen = ref(false)
const snoozeDropdownStyle = ref<Record<string, string>>({})
const snoozeCustomValue = ref('')
const snoozing = ref(false)

// Quick presets, computed fresh each time the menu opens (not reactive
// refs) so "Later today" etc. always reflect the current moment rather
// than when the component first mounted.
const snoozePresets = [
  { label: 'Later today (+4h)', until: () => { const d = new Date(); d.setHours(d.getHours() + 4); return d } },
  { label: 'This evening', until: () => {
      const d = new Date()
      d.setHours(18, 0, 0, 0)
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
      return d
    } },
  { label: 'Tomorrow morning', until: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(6, 0, 0, 0)
      return d
    } },
  { label: 'Next week', until: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d } },
  { label: 'Next month', until: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d } },
]

function formatCompactTime(date: Date): string {
  let h = date.getHours()
  const m = date.getMinutes()
  const period = h >= 12 ? 'pm' : 'am'
  h = h % 12
  if (h === 0) h = 12
  return m === 0 ? `${h}${period}` : `${h}:${String(m).padStart(2, '0')}${period}`
}

// "Later today (+4h)" already spells out its own offset in the label, so it
// gets no extra hint. The rest get a short parenthetical: just a time for
// anything today/tomorrow (the label already says which), a short date
// otherwise - kept terse since the dropdown can't scroll horizontally.
function presetHint(preset: { label: string; until: () => Date }): string {
  if (preset.label.includes('(')) return ''
  const date = preset.until()
  const now = new Date()
  const dayDiff = Math.round(
    (new Date(date.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86400000
  )
  if (dayDiff <= 1) return formatCompactTime(date)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function openMoreSnoozeDropdown() {
  showMoreMenu.value = false
  if (moreBtn.value) {
    snoozeDropdownStyle.value = anchorPopupStyle(moreBtn.value.getBoundingClientRect(), 240)
  }
  snoozeCustomValue.value = ''
  snoozeOpen.value = true
}

async function confirmSnooze(until: Date) {
  if (snoozing.value) return
  snoozing.value = true
  try {
    await snoozeArticle(props.article.id, until)
    articlesStore.markRead(props.article.id, true)
    snoozeOpen.value = false
    emit('copied', `Snoozed until ${until.toLocaleString()}`)
  } catch (e) {
    console.error('snoozeArticle failed:', e)
    emit('copied', 'Snooze failed - see console for details')
  } finally {
    snoozing.value = false
  }
}

function confirmCustomSnooze() {
  if (!snoozeCustomValue.value) return
  const until = new Date(snoozeCustomValue.value)
  if (isNaN(until.getTime())) {
    emit('copied', 'Invalid date/time')
    return
  }
  void confirmSnooze(until)
}

const selfDestructOpen = ref(false)
const selfDestructDropdownStyle = ref<Record<string, string>>({})
const selfDestructCustomValue = ref('')
const selfDestructing = ref(false)

const selfDestructPresets = [
  { label: 'In 1 week', until: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d } },
  { label: 'In 1 month', until: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d } },
  { label: 'In 3 months', until: () => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d } },
  { label: 'In 1 year', until: () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d } },
]

function openMoreSelfDestructDropdown() {
  showMoreMenu.value = false
  if (moreBtn.value) {
    selfDestructDropdownStyle.value = anchorPopupStyle(moreBtn.value.getBoundingClientRect(), 240)
  }
  selfDestructCustomValue.value = ''
  selfDestructOpen.value = true
}

async function confirmSelfDestruct(until: Date) {
  if (selfDestructing.value) return
  selfDestructing.value = true
  try {
    await selfDestructArticle(props.article.id, until)
    selfDestructOpen.value = false
    emit('copied', `Self-destructs ${until.toLocaleString()}`)
  } catch (e) {
    console.error('selfDestructArticle failed:', e)
    emit('copied', 'Self-destruct failed - see console for details')
  } finally {
    selfDestructing.value = false
  }
}

function confirmCustomSelfDestruct() {
  if (!selfDestructCustomValue.value) return
  const until = new Date(selfDestructCustomValue.value)
  if (isNaN(until.getTime())) {
    emit('copied', 'Invalid date/time')
    return
  }
  void confirmSelfDestruct(until)
}

const showFeedEditDialog = ref(false)

function openFeedEditDialog() {
  showMoreMenu.value = false
  showFeedEditDialog.value = true
}

function onFeedUnsubscribed() {
  showFeedEditDialog.value = false
  emit('close')
}

function onCreateFilterFromSelectedTags() {
  if (!selectedTags.value.size) return
  moreTagsOpen.value = false
  emit('create-filter-from-tags', Array.from(selectedTags.value))
  emit('close')
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
  window.addEventListener('popstate', onLightboxPopstate)
  document.addEventListener('keydown', onLightboxKey)
  await nextTick()
  attachLightboxZoomListeners()
}

// Just triggers the history pop; onLightboxPopstate does the actual cleanup
// once it fires, whether that's from this back() call or a native back-button
// press. Popstate fires on window itself, so capture vs. bubble listeners
// there run in registration order rather than capture-before-bubble - trying
// to race AppShell's own popstate handler with stopImmediatePropagation()
// doesn't work. Instead AppShell checks isLightboxOpen (see defineExpose
// below) and skips closing the article while the lightbox is still open.
function closeLightbox() {
  if (!lightboxSrc.value) return
  history.back()
}

function onLightboxPopstate() {
  detachLightboxZoomListeners()
  window.removeEventListener('popstate', onLightboxPopstate)
  document.removeEventListener('keydown', onLightboxKey)
  lightboxSrc.value = null
}

function onLightboxKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeLightbox()
}

function onContentClick(e: MouseEvent) {
  const img = (e.target as HTMLElement).closest('img')
  if (img) {
    const caption = stripHtml((img as HTMLImageElement).alt)
      || stripHtml(img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ?? '')
      || ''
    openLightbox((img as HTMLImageElement).src, caption)
    return
  }
  const a = (e.target as HTMLElement).closest('a')
  if (a?.href) {
    e.preventDefault()
    const url = new URL(a.href, window.location.href)
    // Same origin isn't enough on its own - /tt-rss/prefs.php is proxied
    // through this same origin (see nginx.conf) but is a genuinely
    // different app/page, not a Rhesus route. Only a matching pathname
    // means it's actually this same SPA instance with just a different
    // hash; treating /tt-rss/... as "internal" set window.location.hash to
    // empty (that URL has no "#" at all), which cleared Rhesus's own route
    // and closed whatever was open instead of navigating to TT-RSS.
    if (url.origin === window.location.origin && url.pathname === window.location.pathname) {
      // The query string for a hash-routed URL lives inside the hash
      // fragment itself (e.g. "#/feed/698?editFeed=698"), not in url.search.
      const hashQuery = url.hash.split('?')[1]
      const editFeedId = hashQuery ? Number(new URLSearchParams(hashQuery).get('editFeed')) : NaN
      if (editFeedId > 0) {
        // A deep link back to a specific feed's edit dialog (e.g. from the
        // feed health report) - open it directly without navigating away
        // from whatever's currently showing (e.g. the article list behind
        // this reader). Changing the route here would switch that
        // underlying list to the clicked feed too, which is a bigger,
        // unwanted side effect of what's meant to be "just open a dialog."
        emit('edit-feed', editFeedId)
        return
      }
      // Any other same-page link is genuine internal navigation - stay
      // in this tab instead of forcing a new one open. Rhesus uses
      // hash-based routing, so just updating the hash is enough for Vue
      // Router to pick up and re-route, with no full page reload
      // (confirmed directly via Playwright).
      window.location.hash = url.hash
      return
    }
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
    closeSearch()
    noteText.value = currentNote.value
    showNote.value = true
    nextTick(() => {
      // preventScroll stops the browser's default scroll-into-view for the
      // newly-focused textarea - the note editor floats above the content
      // (teleported to .reader-overlay-panel, like the search bar) rather
      // than being inserted inline, so there's no layout shift to scroll
      // into view in the first place, but this still guards against the
      // browser's own focus-scroll behavior on unrelated ancestors.
      noteInput.value?.focus({ preventScroll: true })
    })
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

    // Adding a note to an otherwise-unorganized article (no labels, not
    // starred) is a good signal it's worth keeping track of, so star it
    // automatically. Only on adding real content, never on clearing the
    // note back to empty (that's how a note gets "deleted" here - there's
    // no separate delete action) - clearing shouldn't unstar, since the
    // star may be there for a reason unrelated to the note by that point.
    if (note && !props.article.marked && !articleHasLabels.value) {
      articlesStore.toggleStar(props.article.id)
    }
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
    showNote.value = false
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

function clearSearch() {
  searchQuery.value = ''
  doSearch()
  searchInput.value?.focus()
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
  emit('full-content-meta', {})
  if (showSearch.value && searchQuery.value) {
    nextTick(() => doSearch())
  }
  autoFetchIfEmpty()
})

const showShareMenu = ref(false)
const shareBtn = ref<HTMLElement | null>(null)
const sharePopupStyle = ref<Record<string, string>>({})

const showMoreMenu = ref(false)
const moreBtn = ref<HTMLElement | null>(null)
const morePopupStyle = ref<Record<string, string>>({})

const fullContent = ref<string | null>(null)
const fetchingFull = ref(false)

// Articles saved via rhesus-share (and anything else that creates an entry
// with no body) have permanently empty article.content - nothing ever
// populates it on its own. Trigger the same live fetch the "newspaper"
// button does automatically in that case, rather than leaving the reader
// stuck on "Loading article..." until the user discovers the manual button.
//
// Called directly here (setup runs synchronously before the first render)
// rather than from onMounted, so if a fetch is needed, fetchingFull is
// already true - a real fetch genuinely in flight - by the time the
// component first paints, instead of onMounted firing a tick later and
// briefly showing the wrong ("no content") message first.
function autoFetchIfEmpty() {
  if (!props.article.content && fullContent.value === null && !fetchingFull.value) {
    void toggleFullContent()
  }
}

autoFetchIfEmpty()

const showLabelMenu = ref(false)
const labelBtn = ref<HTMLElement | null>(null)
const labelPopupStyle = ref<Record<string, string>>({})
const labelList = ref<ApiLabel[]>([])
const loadingLabels = ref(false)
const labelsLoaded = ref(false)
const newLabelName = ref('')
const creatingLabel = ref(false)

const articleHasLabels = computed(() => {
  if (labelsLoaded.value) return labelList.value.some((l) => l.checked)
  return (props.article.labels?.length ?? 0) > 0
})

async function openLabelMenu(event: MouseEvent) {
  showShareMenu.value = false
  if (showLabelMenu.value) {
    showLabelMenu.value = false
    return
  }
  labelBtn.value = event.currentTarget as HTMLElement
  if (labelBtn.value) {
    labelPopupStyle.value = anchorPopupStyle(labelBtn.value.getBoundingClientRect(), 220)
  }
  showLabelMenu.value = true
  loadingLabels.value = true
  labelsLoaded.value = false
  try {
    labelList.value = await getLabels(props.article.id)
    labelsLoaded.value = true
  } finally {
    loadingLabels.value = false
  }
}

// Lets AppShell's mobile-back-button handling close just the label popup
// (rather than the whole article) when it's open - see AppShell.vue's
// onPopState(). The popup itself never touches history directly; AppShell
// re-pushes the article's own history entry after calling this, so the
// back press is "absorbed" by the popup instead of leaving the article.
defineExpose({
  isLabelMenuOpen: computed(() => showLabelMenu.value),
  closeLabelMenuForBackButton: () => { showLabelMenu.value = false },
  isLightboxOpen: computed(() => lightboxSrc.value !== null),
})

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
    feedsStore.adjustLabelCount(result.id, 1)
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
    feedsStore.adjustLabelCount(label.id, next ? 1 : -1)
  } catch {
    label.checked = !next
  }
}

function openShareMenu(event: MouseEvent) {
  showLabelMenu.value = false
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

function openInNewTab() {
  showMoreMenu.value = false
  if (props.article.link) window.open(props.article.link, '_blank', 'noopener,noreferrer')
}

const refetching = ref(false)

async function refetchCurrentArticle() {
  if (refetching.value) return
  refetching.value = true
  try {
    const result = await refetchArticle(props.article.id)
    if (result.changed) {
      await articlesStore.fetchContent(props.article.id)
      emit('copied', 'Article refetched and updated')
    } else {
      emit('copied', 'Article refetched - no changes found')
    }
  } catch (e) {
    console.error('refetchArticle failed:', e)
    emit('copied', 'Refetch failed - see console for details')
  } finally {
    refetching.value = false
    showMoreMenu.value = false
  }
}

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

async function nativeShare() {
  showShareMenu.value = false
  try {
    await navigator.share({
      title: props.article.title ?? undefined,
      url: props.article.link ?? undefined,
    })
  } catch (e) {
    // AbortError = user backed out of the share sheet, not a failure
    if (e instanceof Error && e.name === 'AbortError') return
    console.error('navigator.share failed:', e)
    emit('copied', 'Share failed - see console for details')
  }
}

async function toggleFullContent() {
  if (fullContent.value !== null) {
    fullContent.value = null
    emit('full-content-meta', {})
    return
  }
  fetchingFull.value = true
  try {
    const result = await fetchFullContent(props.article.id)
    const doc = new DOMParser().parseFromString(result.content, 'text/html')

    // Extract JSON-LD metadata before Readability's cleanup pass touches the
    // document. Only ever used as a fallback for values the feed itself
    // didn't provide - never to override real feed data.
    const jsonLdMeta = extractJsonLdMeta(doc)
    const meta: { author?: string, publishedAt?: number } = {}
    // A URL in the author field (RTE Sport puts their Facebook page there,
    // for one) isn't a byline - treat it the same as a missing author.
    const feedAuthorIsUsable = !!props.article.author && !/^https?:\/\//i.test(props.article.author)
    if (!feedAuthorIsUsable && jsonLdMeta.author) {
      meta.author = jsonLdMeta.author
    }
    // TT-RSS falls back to fetch time for `updated` when a feed provides no
    // publish date of its own. There's no explicit "missing date" flag, but
    // when `updated` sits within a minute of `date_entered` (when this
    // user's row was created), that's a strong sign `updated` IS the fetch
    // time rather than a real feed-provided date - fair game to prefer the
    // article's own JSON-LD date instead.
    const looksLikeFetchTimeFallback =
      props.article.date_entered !== undefined &&
      Math.abs(props.article.updated - props.article.date_entered) <= 60
    if (looksLikeFetchTimeFallback && jsonLdMeta.publishedAt) {
      meta.publishedAt = jsonLdMeta.publishedAt
    }

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

    // Readability's div-conditional-cleaning pass scores every <div> in the
    // document by its own class/id weight and link density, with no
    // awareness of a wrapping <blockquote> - a pull-quote whose CMS puts the
    // styling class on the <blockquote> itself (NPR does this) rather than
    // the inner <div> gets zero weight credit, so a short, link-heavy quote
    // (e.g. "...Listen to the full episode here") trips Readability's "low
    // weight and a little linky" rule and the whole <div> - text and all -
    // gets deleted, leaving an empty blockquote box. Unwrapping a <div>
    // that's the sole child of a <blockquote> first removes the div
    // Readability would flag, without touching the blockquote's actual text.
    doc.querySelectorAll('blockquote > div:only-child').forEach(div => {
      while (div.firstChild) div.parentNode?.insertBefore(div.firstChild, div)
      div.remove()
    })

    const article = new Readability(doc).parse()
    fullContent.value = article?.content ?? result.content
    if (meta.author || meta.publishedAt) emit('full-content-meta', meta)
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
// A srcset lists its candidates smallest-first by convention, so taking the
// first one picks the lowest-resolution variant on offer. NPR's hero srcset
// starts at 400w; stretched across the full reader width on a high-DPR phone
// that is visibly blurry. Pick by size instead of by position.
//
// Not simply the largest available either: that srcset goes up to 2400w, whose
// decoded bitmap is roughly 13MB, and the hero is one of the few images that
// is never lazy-loaded (it is above the fold). Choose the smallest candidate
// that still covers the display width, which is sharp without being wasteful.
//
// Content images keep their srcset through sanitization and are resolved by
// the browser natively; this only matters for the hero, which is extracted out
// to a single src.
function bestSrcsetUrl(srcset: string): string | null {
  if (!srcset) return null
  const dpr = window.devicePixelRatio || 1
  // Cap the target so an unusually wide window doesn't reach for a huge asset.
  const target = Math.min(window.innerWidth * dpr, 2048)

  const candidates = srcset
    .split(/,(?=\s+\S)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)\s+(\d+(?:\.\d+)?)([wx])$/)
      if (!m) return { url: part, width: 0 }
      const value = parseFloat(m[2]!)
      // Put w- and x-descriptors on one scale so they can be compared.
      return { url: m[1]!.trim(), width: m[3] === 'x' ? value * window.innerWidth : value }
    })
    .filter((c) => c.url)

  if (!candidates.length) return null
  // No descriptors at all (a bare single-URL srcset): nothing to choose by.
  if (candidates.every((c) => c.width === 0)) return candidates[0]!.url

  const sized = candidates.filter((c) => c.width > 0).sort((a, b) => a.width - b.width)
  const covering = sized.find((c) => c.width >= target)
  return (covering ?? sized[sized.length - 1]!).url
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
  const doc = parser.parseFromString(fixUnescapedDataAttributeQuotes(stripInvisibleEntityArtifacts(content)), 'text/html')

  // Strip images with a broken/sentinel src BEFORE resolving relative URLs
  // below - some feeds ship a template that never got its image URL filled
  // in (e.g. NPR emitting <img src="undefined" alt="...caption...">
  // literally). "undefined" has no scheme, so resolveRelativeUrls() would
  // otherwise happily rewrite it into a plausible-looking absolute URL
  // (resolved against the article's own link, e.g. ".../undefined"),
  // which then passes every later "is this broken?" check and gets wrongly
  // selected as the hero image - confirmed directly against a real NPR
  // article that did exactly this.
  doc.querySelectorAll('img[src]').forEach(el => {
    const src = el.getAttribute('src') ?? ''
    if (src === 'undefined' || src === '' || src === 'null' || /\/tracking[/.]|[-_]pixel\./i.test(src))
      el.remove()
  })

  // Resolve relative image/link URLs (e.g. a site emitting <img src="../media/x.jpg">)
  // before picking a hero candidate - otherwise a relative src extracted here would
  // never go through processContent()'s own resolveRelativeUrls() call, since that
  // only runs on the body content left AFTER the hero is pulled out.
  resolveRelativeUrls(doc, props.article.link ?? undefined)

  for (const img of doc.querySelectorAll('img')) {
    if (isIconSizedImage(img)) continue

    const dcText = stripHtml(img.getAttribute('data-caption') ?? '')
    // Some sites (The Verge's live pages, for one) put HTML-entity-escaped
    // markup directly inside alt text itself (e.g. alt="&lt;em&gt;caption
    // text&lt;/em&gt;") - since alt is semantically always plain text, and
    // becomes visible as-is (raw decoded entities included) whenever it's
    // shown directly (a failed image's fallback rendering, the lightbox
    // caption below), strip any embedded tags the same way data-caption
    // already is.
    const alt = stripHtml(img.getAttribute('alt') ?? '')
    let src: string | null = null

    // Prefer <source data-srcset|srcset> from a parent <picture>: lazy-loaded images
    // often have a broken or stub src while the real URL lives in data-srcset.
    const picture = img.closest('picture')
    if (picture) {
      const source = picture.querySelector('source[data-srcset], source[srcset]')
      if (source) {
        const raw = source.getAttribute('data-srcset') ?? source.getAttribute('srcset') ?? ''
        src = bestSrcsetUrl(raw)
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
  if (url === 'undefined' || url === 'null') return false
  if (/\/tracking[/.]|[-_]pixel\./i.test(url)) return false
  if (/\/undefined(?:[?#/]|$)/.test(url)) return false
  return true
}

const heroUrl = computed(() => {
  const fi = props.article.flavor_image ? toRelativeUrl(props.article.flavor_image) : null
  return parsedHero.value?.src ?? (isUsableImageUrl(fi) ? fi : null)
})

const heroAlt = computed(() => parsedHero.value?.alt ?? '')

const heroImageFailed = ref(false)
watch(heroUrl, () => { heroImageFailed.value = false })

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

// Pull quotes are an editorial/typographic device (usually a sentence
// repeated from the surrounding body text, set apart for emphasis) rather
// than a real quotation - there's no HTML5 semantic element for them the
// way <blockquote> covers actual quotes. The de facto convention across
// CMSs is a class name containing some form of "pull quote", so that's the
// only generally reliable signal available.
function markPullQuotes(doc: Document) {
  doc.querySelectorAll('[class*="pull-quote" i], [class*="pullquote" i], [class*="pull_quote" i]').forEach((el) => {
    // A bare <span> match is usually centered inside a wrapping <p> (e.g.
    // Tricycle: <p style="text-align:center"><span class="pull-quote">...).
    // Marking the <span> itself would only box the inline text, not the
    // paragraph - style the wrapping block instead when there is one.
    const target = el.tagName === 'SPAN' ? (el.closest('p') ?? el) : el
    target.classList.add('rhesus-pull-quote')
  })
}

// Social embed widgets (Instagram, TikTok, Facebook, etc.) ship as an empty
// placeholder element plus a <script> that a real browser on the origin
// site uses to fetch and render the actual embed client-side. That script
// never runs here (DOMPurify strips it, and tracker-blockers like Privacy
// Badger would block it anyway even if it did), so the placeholder renders
// as a blank box. Must run before DOMPurify.sanitize() - the permalink is
// usually itself a data-* attribute, which DOMPurify strips by default.
function fallbackEmptyEmbeds(doc: Document) {
  const selector = [
    'blockquote.instagram-media',
    'blockquote.twitter-tweet',
    'blockquote.tiktok-embed',
    'blockquote.fb-xfbml-parse-ignore',
    'div.fb-video',
    'div.fb-post',
    // A <canvas> element (e.g. a Chart.js graph) is only ever populated by
    // JavaScript, which never runs here - it otherwise sits as a large,
    // completely blank box reserving its declared width/height (a "hero
    // image" -shaped gap with nothing in it). No permalink-style attribute
    // to recover a source link from, so this always falls through to the
    // plain "content removed" note below rather than a "View on..." link.
    'canvas',
  ].join(',')
  doc.querySelectorAll(selector).forEach((el) => {
    // Some platforms (Twitter's static fallback markup, most TikTok embeds)
    // already include real, readable text - leave those alone entirely.
    // Instagram is the one exception: whenever data-instgrm-captioned is
    // set, its skeleton-loader placeholder bakes in text too ("View this
    // post on Instagram" / "A post shared by X") - but that's always
    // generic boilerplate, never the post's actual caption or content, so
    // it's never worth keeping over the small fallback link below. Left
    // as-is, it renders as a large, mostly-empty box sized to match the
    // real embed that never loads.
    const isInstagram = el.matches('blockquote.instagram-media')
    if (!isInstagram && el.textContent?.trim()) return
    const url =
      el.getAttribute('data-instgrm-permalink') ||
      el.getAttribute('cite') ||
      el.getAttribute('data-href') ||
      el.querySelector('a[href]')?.getAttribute('href') ||
      null
    if (!url) {
      const note = doc.createElement('p')
      note.className = 'rhesus-embed-removed'
      note.textContent = 'Embedded content removed - open the original article to view it.'
      el.replaceWith(note)
      return
    }
    const link = doc.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
    link.className = 'rhesus-embed-fallback'
    link.textContent = `View on ${embedPlatformName(url)} ↗`
    el.replaceWith(link)
  })
}

function embedPlatformName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('instagram')) return 'Instagram'
    if (host.includes('tiktok')) return 'TikTok'
    if (host === 'x.com' || host.includes('twitter')) return 'X'
    if (host.includes('facebook')) return 'Facebook'
    return host
  } catch {
    return 'original post'
  }
}

function processContent(html: string): string {
  // Preprocess before DOMPurify strips data-* attributes: move data-caption
  // into alt (for lightbox) and figcaption (for below-image display) when empty.
  const pre = new DOMParser().parseFromString(fixUnescapedDataAttributeQuotes(stripInvisibleEntityArtifacts(html)), 'text/html')
  pre.querySelectorAll('img[src]').forEach(el => {
    const src = el.getAttribute('src') ?? ''
    if (src === 'undefined' || src === '' || src === 'null' || /\/tracking[/.]|[-_]pixel\./i.test(src))
      el.remove()
  })
  // Repair entities the feed escaped one level too many (see text.ts). Done
  // on the parsed tree so attribute values, where a bare &amp; is legitimate,
  // are left alone.
  decodeResidualEntities(pre.body)
  resolveRelativeUrls(pre, props.article.link ?? undefined)
  fallbackEmptyEmbeds(pre)
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
  // A read-only sanitized article body has no legitimate use for an
  // interactive <button> - some feeds (Substack's image zoom/enlarge
  // controls, embedded directly in content:encoded) ship them anyway.
  // DOMPurify's default allowlist permits <button>/<svg> as ordinary,
  // non-dangerous HTML, so they survive sanitization and render as inert
  // icon clutter unless removed here.
  doc.querySelectorAll('button').forEach(el => el.remove())
  // A blockquote can end up with no real content for reasons outside our
  // control (Readability stripping a div-wrapped quote it judged "shady",
  // a malformed feed, etc.) - the CSS below still borders/backgrounds it
  // regardless, so leaving it in place renders as a visibly broken,
  // decorated box with nothing inside. Drop it outright instead. A
  // blockquote embedding only media (no text) is left alone - that's not
  // "empty" in the sense that matters here.
  doc.querySelectorAll('blockquote').forEach(bq => {
    const hasText = !!bq.textContent?.trim()
    const hasMedia = !!bq.querySelector('img, video, iframe, svg')
    if (!hasText && !hasMedia) bq.remove()
  })
  // Some sites wrap a pull quote in an outer <blockquote> used purely as a
  // styling frame, with the actual quote in a nested <blockquote> inside it.
  // Hearst's pattern is:
  //   <blockquote data-theme-key="pullquote">
  //     <span aria-hidden="true"></span>          (empty, decorative)
  //     <blockquote>the actual quote</blockquote>
  //     <span aria-hidden="true"></span>
  //   </blockquote>
  // Their CSS turns the outer into a pull-quote frame; here both are just
  // <blockquote>, so the reader draws two sets of indent and border, one
  // inside the other. Collapse the outer when it contributes nothing of its
  // own. A genuine quote-within-a-quote has its own text or media alongside
  // the nested one, and is left alone.
  doc.querySelectorAll('blockquote > blockquote').forEach(inner => {
    const outer = inner.parentElement
    if (!outer || outer.querySelectorAll('blockquote').length !== 1) return
    const ownNodes = Array.from(outer.childNodes).filter(n => n !== inner)
    if (ownNodes.some(n => (n.textContent ?? '').trim())) return
    // matches() as well as querySelector(): the media may *be* the sibling
    // node rather than sit inside it.
    const MEDIA = 'img, video, iframe, svg'
    if (ownNodes.some(n => n instanceof Element && (n.matches(MEDIA) || n.querySelector(MEDIA)))) return
    // Carry the outer's classes over so the pull-quote marker set above (and
    // any site class markPullQuotes matches on) survives the unwrap.
    outer.classList.forEach(c => inner.classList.add(c))
    outer.replaceWith(inner)
  })
  markPullQuotes(doc)
  // Defer decoding of article images until they approach the viewport. Without
  // this the browser decodes every image in the article at once, at full
  // natural resolution regardless of the max-width: 100% it is displayed at -
  // a long full-fetched article can hold hundreds of MB of decoded bitmaps.
  // On a memory-pressured device that starves the graphics caches, and the
  // first thing to fall over is the glyph atlas: shapes still paint while text
  // vanishes (see READER-KEYBOARD-VIEWPORT-FLASH.md). Applied after
  // DOMPurify.sanitize() above, which would otherwise strip these attributes.
  doc.querySelectorAll('img').forEach(img => {
    img.setAttribute('loading', 'lazy')
    img.setAttribute('decoding', 'async')
  })
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

.reader-loading--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.reader-loading-retry {
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.reader-loading-retry:hover {
  background: var(--color-surface);
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

.reader-hero-broken {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 8px;
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-style: italic;
}

.reader-hero-broken-icon {
  flex-shrink: 0;
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

/* .reader-content :deep(p) gives every paragraph its own margin-bottom,
   which stacks with the blockquote's own padding-bottom for whichever
   paragraph happens to be last inside it - padding-top has no equivalent
   margin-top to stack with, so the box reads as visibly bottom-heavy. */
.reader-content :deep(blockquote p:last-child) {
  margin-bottom: 0;
}

/* Pull quotes are typographic emphasis (often a sentence repeated from the
   surrounding body), not a real quotation like <blockquote> - top/bottom
   rules instead of a left border keeps the two visually distinct. */
.reader-content :deep(.rhesus-pull-quote) {
  display: block;
  text-align: center;
  font-size: 1.2em;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-accent);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: 0.9em 0.5em;
  margin: 0 0 1.1em;
}

.reader-content :deep(.rhesus-embed-fallback) {
  display: block;
  text-align: center;
  padding: 0.9em 1em;
  margin: 0 0 1.1em;
  background: rgba(128, 128, 128, 0.08);
  border: 1px dashed var(--color-border);
  border-radius: 4px;
  color: var(--color-accent);
  font-weight: 600;
}

/* Unlike .rhesus-embed-fallback, this isn't a link - no permalink could be
   found, so it's muted/italic rather than accent-colored, to not look
   tappable when it isn't. */
.reader-content :deep(.rhesus-embed-removed) {
  text-align: center;
  padding: 0.9em 1em;
  margin: 0 0 1.1em;
  background: rgba(128, 128, 128, 0.08);
  border: 1px dashed var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-style: italic;
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

:global(.label-popup) {
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

:global(.label-status) {
  padding: 12px 16px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

:global(.label-option) {
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

:global(.label-option:hover) {
  background: var(--color-surface);
}

:global(.label-dot) {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

:global(.label-name) {
  flex: 1;
}

:global(.label-check) {
  color: var(--color-accent);
  flex-shrink: 0;
}

:global(.label-new) {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-top: 1px solid var(--color-border);
}

:global(.label-new-input) {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  padding: 4px 6px;
}

:global(.label-new-input::placeholder) {
  color: var(--color-text-muted);
}

:global(.label-new-btn) {
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

:global(.label-new-btn:hover:not(:disabled)) {
  background: var(--color-surface);
}

:global(.label-new-btn:disabled) {
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

:global(.share-option:disabled) {
  color: var(--color-text-muted);
  cursor: default;
}

:global(.share-option:disabled:hover) {
  background: none;
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

.floating-search {
  position: absolute;
  top: 16px;
  left: 50%;
  /* Same reasoning as .floating-note below - the search field is focused and
     carries a blinking caret over the same scrollable article content. */
  transform: translateX(-50%) translateZ(0);
  contain: layout paint;
  width: min(90%, 420px);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.reader-search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.reader-search-input {
  width: 100%;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 5px 26px 5px 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
  min-width: 0;
}

.reader-search-input:focus {
  border-color: var(--color-accent);
}

.reader-search-clear-btn {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  padding: 2px;
  border-radius: 2px;
  transition: color var(--transition-fast);
}

.reader-search-clear-btn:hover {
  color: var(--color-text-primary);
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

.floating-note {
  position: absolute;
  top: 16px;
  left: 50%;
  /* translateZ(0) promotes this to its own compositor layer, and contain
     confines layout/paint work to it. The focused textarea has a caret that
     repaints twice a second for as long as the editor is open; without these,
     each blink invalidates a region of .reader-overlay-panel that overlaps
     .reader-scroll, forcing the whole article - images included - to be
     re-rasterized 2x/second. That is the only continuous repaint source that
     exists exclusively while the note editor is open, which matches the
     symptom being note-editor-specific rather than general memory pressure. */
  transform: translateX(-50%) translateZ(0);
  contain: layout paint;
  width: min(90%, 420px);
  z-index: 5;
  padding: 10px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.reader-note-input-wrap {
  position: relative;
}

.reader-note-input {
  width: 100%;
  min-height: 80px;
  padding: 6px 26px 6px 8px;
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

.reader-note-clear-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  padding: 2px;
  border-radius: 2px;
  transition: color var(--transition-fast);
}

.reader-note-clear-btn:hover {
  color: var(--color-text-primary);
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

.tags-popup {
  max-height: 320px;
  overflow-y: auto;
}

.tags-popup-heading {
  padding: 10px 14px;
  font-size: var(--font-size-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border);
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.tag-row:hover {
  background: var(--color-surface);
}

.tag-row--static {
  cursor: default;
}

.tag-row--static:hover {
  background: none;
}

.tag-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-filter-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--color-border);
}

.tag-filter-create-btn {
  width: 100%;
  padding: 8px 0;
  border-radius: 4px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.tag-filter-create-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.snooze-preset-hint {
  color: var(--color-text-muted);
}

.snooze-custom-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.snooze-datetime-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
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
