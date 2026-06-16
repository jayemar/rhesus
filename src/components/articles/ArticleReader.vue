<template>
  <div class="reader">
    <div v-if="!article.content" class="reader-loading">Loading article...</div>
    <div v-else class="reader-content" v-html="readerContent" />
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
import { ref, computed } from 'vue'
import { Mail, MailOpen, Star, Tag, Check, Plus, ExternalLink, Share2 } from 'lucide-vue-next'
import { useArticlesStore } from '@/stores/articles'
import { getLabels, setArticleLabel, createLabel } from '@/api/articles'
import { writeToClipboard } from '@/utils/clipboard'
import type { ApiArticle, ApiLabel } from '@/types/api'

const props = defineProps<{ article: ApiArticle }>()
const emit = defineEmits<{ close: [], copied: [label: string] }>()
const articlesStore = useArticlesStore()

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
      bottom: `${window.innerHeight - rect.top + 8}px`,
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
      bottom: `${window.innerHeight - rect.top + 8}px`,
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

const readerContent = computed(() =>
  (props.article.content ?? '').replace(/https?:\/\/localhost(:\d+)?/g, ''),
)
</script>

<style scoped>
.reader {
  padding: 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.reader-loading {
  padding: 32px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.reader-content {
  font-size: var(--font-size-base);
  line-height: 1.7;
  color: var(--color-text-primary);
  max-width: 720px;
}

.reader-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
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
}

.reader-content :deep(blockquote) {
  border-left: 3px solid var(--color-border);
  padding-left: 12px;
  color: var(--color-text-secondary);
}

.reader-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--color-border);
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
</style>
