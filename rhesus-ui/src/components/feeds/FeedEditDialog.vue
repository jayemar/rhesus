<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div v-if="loading" class="state-msg">Loading...</div>
      <div v-else-if="!feed" class="state-msg state-error">Feed not found.</div>

      <template v-else>
        <h3>Edit Feed</h3>

        <div class="icon-row">
          <img
            v-if="iconUrl"
            :src="iconUrl"
            class="icon-preview"
            alt=""
            @error="iconFailed = true"
          />
          <Rss v-else class="icon-preview icon-preview--placeholder" :size="18" />
          <label class="icon-btn">
            <Loader2 v-if="uploadingIcon" :size="13" class="spinning" />
            <span v-else>Change icon</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/x-icon,.ico"
              class="icon-file-input"
              :disabled="uploadingIcon"
              @change="onIconFileSelected"
            />
          </label>
          <button
            v-if="feed.has_icon"
            class="icon-btn"
            type="button"
            :disabled="uploadingIcon"
            @click="onRemoveIcon"
          >Remove icon</button>
        </div>
        <div class="icon-url-row">
          <div class="icon-url-input-wrap">
            <input
              v-model="iconUrlInput"
              class="field-input icon-url-input"
              type="url"
              placeholder="Or paste an icon URL..."
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              :disabled="uploadingIcon"
              @keydown.enter.prevent="onFetchIconUrl"
            />
            <button
              v-if="iconUrlInput"
              class="icon-url-clear-btn"
              type="button"
              title="Clear"
              :disabled="uploadingIcon"
              @click="iconUrlInput = ''"
            ><X :size="12" /></button>
          </div>
          <button
            class="icon-btn"
            type="button"
            :disabled="!iconUrlInput.trim() || uploadingIcon"
            @click="onFetchIconUrl"
          >
            <Loader2 v-if="uploadingIcon" :size="13" class="spinning" />
            <span v-else>Fetch</span>
          </button>
        </div>
        <p v-if="iconError" class="field-error">{{ iconError }}</p>

        <label class="field-label">Title</label>
        <input v-model="title" class="field-input" placeholder="Title" maxlength="250" />

        <label class="field-label">Feed URL</label>
        <div class="url-row">
          <input
            v-model="feedUrl"
            class="field-input url-input"
            type="url"
            placeholder="Feed URL"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
          />
          <a class="url-link" :href="feedUrl || undefined" target="_blank" rel="noopener noreferrer" title="Open feed URL" :tabindex="feedUrl ? 0 : -1">
            <ExternalLink :size="13" />
          </a>
        </div>

        <label class="field-label">Category</label>
        <select v-model.number="catId" class="field-select">
          <option :value="0">Uncategorized</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>

        <label class="field-label">Notes</label>
        <textarea v-model="note" class="field-input note-input" placeholder="Feed notes" rows="3" />

        <div class="danger-zone">
          <button class="unsubscribe-btn" :disabled="saving || unsubscribing" @click="showUnsubscribeConfirm = true">
            Unsubscribe from feed
          </button>
        </div>
      </template>

      <div class="actions">
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button v-if="feed" class="btn-confirm" :disabled="saving" @click="save">Save</button>
      </div>
    </div>

    <ConfirmDialog
      v-if="showUnsubscribeConfirm"
      :message="`Unsubscribe from &quot;${feed?.title ?? 'this feed'}&quot;?`"
      reason-placeholder="Reason for unsubscribing (optional)"
      @confirm="unsubscribe"
      @cancel="showUnsubscribeConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ExternalLink, Loader2, Rss, X } from 'lucide-vue-next'
import { getAllFeeds, getAllCategories, getFeedNotes, editFeed, deleteFeed, uploadFeedIcon, removeFeedIcon, fetchIconFromUrl, refreshFeed, logUnsubscribeReason } from '@/api/feeds'
import { ApiError } from '@/api/client'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useFeedsStore } from '@/stores/feeds'
import type { ApiFeed, ApiCategory } from '@/types/api'

const props = defineProps<{ feedId: number }>()
const emit = defineEmits<{ close: []; saved: []; unsubscribed: [] }>()

const feedsStore = useFeedsStore()

const loading = ref(true)
const feed = ref<ApiFeed | null>(null)
const categories = ref<ApiCategory[]>([])

const title = ref('')
const feedUrl = ref('')
const catId = ref(0)
const note = ref('')
const saving = ref(false)

const iconFailed = ref(false)
const iconVersion = ref(0)
const uploadingIcon = ref(false)
const iconError = ref<string | null>(null)
const iconUrlInput = ref('')

const showUnsubscribeConfirm = ref(false)
const unsubscribing = ref(false)

const ALLOWED_ICON_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon',
])

const iconUrl = computed(() => {
  if (!feed.value?.has_icon || iconFailed.value) return undefined
  return `/tt-rss/public.php?op=feed_icon&id=${feed.value.id}${iconVersion.value ? `&v=${iconVersion.value}` : ''}`
})

onMounted(async () => {
  loading.value = true
  try {
    const [feeds, cats, notes] = await Promise.all([getAllFeeds(), getAllCategories(), getFeedNotes()])
    categories.value = cats.filter((c) => c.id > 0).sort((a, b) => a.title.localeCompare(b.title))
    const found = feeds.find((f) => f.id === props.feedId) ?? null
    feed.value = found
    if (found) {
      title.value = found.title
      feedUrl.value = found.feed_url
      catId.value = found.cat_id ?? 0
      note.value = notes[found.id] ?? ''
    }
  } finally {
    loading.value = false
  }
})

function friendlyIconError(code: string, detectedType?: string): string {
  switch (code) {
    case 'ICON_INVALID_TYPE':
      return `Unsupported image type${detectedType ? ` (${detectedType})` : ''} - use PNG, JPEG, GIF, WEBP, BMP, or ICO.`
    case 'ICON_FILE_TOO_LARGE':
      return 'Icon file is too large.'
    case 'FEED_NOT_FOUND':
      return 'Feed not found.'
    case 'NOT_LOGGED_IN':
      return 'Not logged in - please refresh and try again.'
    case 'MISSING_URL':
      return 'Enter an icon URL first.'
    case 'INVALID_URL':
      return 'Invalid URL (must be http/https on a standard port, and not a private address).'
    case 'FETCH_FAILED':
      return 'Could not fetch an icon from that URL.'
    default:
      return 'Failed to set icon.'
  }
}

async function onIconFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !feed.value) return

  iconError.value = null

  if (!ALLOWED_ICON_MIME_TYPES.has(file.type)) {
    iconError.value = friendlyIconError('ICON_INVALID_TYPE', file.type)
    return
  }

  uploadingIcon.value = true
  try {
    await uploadFeedIcon(feed.value.id, file)
    feed.value.has_icon = true
    iconFailed.value = false
    iconVersion.value += 1
    feedsStore.loadTree()
  } catch (e) {
    iconError.value = e instanceof ApiError ? friendlyIconError(e.code, e.message) : 'Failed to upload icon.'
  } finally {
    uploadingIcon.value = false
  }
}

async function onFetchIconUrl() {
  const url = iconUrlInput.value.trim()
  if (!url || !feed.value) return

  iconError.value = null
  uploadingIcon.value = true
  try {
    await fetchIconFromUrl(feed.value.id, url)
    feed.value.has_icon = true
    iconFailed.value = false
    iconVersion.value += 1
    iconUrlInput.value = ''
    feedsStore.loadTree()
  } catch (e) {
    iconError.value = e instanceof ApiError ? friendlyIconError(e.code, e.message) : 'Failed to fetch icon.'
  } finally {
    uploadingIcon.value = false
  }
}

async function onRemoveIcon() {
  if (!feed.value) return
  iconError.value = null
  uploadingIcon.value = true
  try {
    await removeFeedIcon(feed.value.id)
    feed.value.has_icon = false
    iconVersion.value += 1
    feedsStore.loadTree()
  } catch {
    iconError.value = 'Failed to remove icon.'
  } finally {
    uploadingIcon.value = false
  }
}

async function save() {
  if (!feed.value) return
  saving.value = true
  try {
    const newTitle = title.value.trim() || feed.value.title
    const newUrl = feedUrl.value.trim() || feed.value.feed_url
    const urlChanged = newUrl !== feed.value.feed_url
    await editFeed(feed.value.id, { title: newTitle, feed_url: newUrl, cat_id: catId.value, note: note.value.trim() })
    if (urlChanged) {
      await refreshFeed(feed.value.id)
      await editFeed(feed.value.id, { update_interval: 0 })
    }
    feedsStore.loadTree()
    emit('saved')
    emit('close')
  } finally {
    saving.value = false
  }
}

async function unsubscribe(reason?: string) {
  if (!feed.value) return
  showUnsubscribeConfirm.value = false
  unsubscribing.value = true
  try {
    await logUnsubscribeReason(feed.value.id, reason, note.value)
    await deleteFeed(feed.value.id)
    feedsStore.loadTree()
    emit('unsubscribed')
  } finally {
    unsubscribing.value = false
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--card-radius);
  padding: 20px;
  max-width: 420px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

h3 {
  margin: 0 0 16px;
}

.state-msg {
  padding: 24px 8px;
  text-align: center;
  color: var(--color-text-secondary);
}

.state-error {
  color: var(--color-danger);
}

.icon-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.icon-preview {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 3px;
  object-fit: contain;
  background: #fff;
  padding: 2px;
}

.icon-preview--placeholder {
  color: var(--color-text-muted);
  background: transparent;
  padding: 0;
}

.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-xs, 11px);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.icon-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.icon-url-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.icon-url-input-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
}

input.icon-url-input {
  width: 100%;
  padding-right: 28px;
}

.icon-url-clear-btn {
  position: absolute;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  padding: 2px;
  border-radius: 2px;
  transition: color var(--transition-fast);
}

.icon-url-clear-btn:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.icon-file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.field-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
  margin-bottom: 12px;
}

.field-label {
  font-size: var(--font-size-xs, 11px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  margin-top: 12px;
}

.field-label:first-of-type {
  margin-top: 0;
}

.field-input,
.field-select {
  padding: 7px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
  width: 100%;
}

.field-input:focus,
.field-select:focus {
  border-color: var(--color-accent);
}

.url-row {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
}

.url-row:focus-within {
  border-color: var(--color-accent);
}

.url-input {
  flex: 1;
  min-width: 0;
  border: none !important;
  outline: none !important;
  background: transparent;
}

.url-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.url-link:hover {
  color: var(--color-accent);
}

.note-input {
  resize: vertical;
  font-family: inherit;
}

.danger-zone {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.unsubscribe-btn {
  width: 100%;
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid var(--color-danger);
  background: transparent;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.unsubscribe-btn:hover:not(:disabled) {
  background: var(--color-danger);
  color: #fff;
}

.unsubscribe-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.btn-cancel {
  padding: 8px 16px;
  border-radius: 4px;
  color: var(--color-text-secondary);
}

.btn-cancel:hover {
  background: var(--color-surface-raised);
}

.btn-confirm {
  padding: 8px 16px;
  border-radius: 4px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-weight: 600;
}

.btn-confirm:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
