<template>
  <div class="feed-editor">
    <div class="feed-editor-inner">
      <h2>Feeds</h2>

      <section class="opml-section">
        <h3>OPML</h3>
        <div class="opml-row">
          <a class="opml-btn" :href="opmlExportUrl" target="_blank" rel="noopener noreferrer">
            <Download :size="14" /> Export
          </a>
          <label class="opml-btn opml-import-label">
            <Upload :size="14" /> Import
            <input type="file" accept=".opml,application/xml,text/xml" class="opml-file-input" @change="onImportFile" />
          </label>
          <span v-if="importStatus" class="opml-status" :class="importStatusClass">{{ importStatus }}</span>
        </div>
      </section>

      <section class="add-section">
        <h3>Add feed</h3>
        <div class="add-form">
          <div class="add-row">
            <div class="add-input-wrap">
              <input
                v-model="newFeedUrl"
                class="add-input"
                type="text"
                placeholder="https://example.com/feed.xml"
                autocomplete="off"
                autocapitalize="off"
                :disabled="adding"
                @keydown.enter.prevent="submitAddFeed"
              />
              <button
                v-if="newFeedUrl"
                class="add-clear-btn"
                type="button"
                title="Clear"
                :disabled="adding"
                @click="newFeedUrl = ''; feedChoices = null; addError = null; addSuccess = null"
              ><X :size="12" /></button>
            </div>
            <select v-model.number="newFeedCatId" class="add-select" :disabled="adding">
              <option :value="0">Uncategorized</option>
              <option v-for="cat in userCategories" :key="cat.id" :value="cat.id">{{ cat.title }}</option>
            </select>
          </div>
          <div class="add-row">
            <input
              v-model="newFeedNote"
              class="add-input add-note-input"
              type="text"
              placeholder="Feed note (optional)"
              :disabled="adding"
              @keydown.enter.prevent="submitAddFeed"
            />
            <button class="add-btn" :disabled="!newFeedUrl.trim() || adding" @click="submitAddFeed">
              <Loader2 v-if="adding" :size="14" class="spinning" />
              <Plus v-else :size="14" />
            </button>
          </div>
        </div>
        <p v-if="addSuccess" class="add-success">{{ addSuccess }}</p>
        <p v-if="addError" class="add-error">{{ addError }}</p>
        <div v-if="feedChoices" class="feed-choices">
          <p class="feed-choices-label">Multiple feeds found - select one:</p>
          <button
            v-for="(title, url) in feedChoices"
            :key="url"
            class="feed-choice-btn"
            :disabled="adding"
            @click="selectFeedChoice(url)"
          >
            <span class="feed-choice-title">{{ title || url }}</span>
            <span v-if="title" class="feed-choice-url">{{ url }}</span>
          </button>
        </div>
      </section>

      <section class="list-section">
        <div class="list-header">
          <h3>Feeds{{ feeds.length ? ` (${filteredFeeds.length})` : '' }}</h3>
          <div v-if="feeds.length" class="search-input-wrap">
            <input
              v-model="searchQuery"
              class="search-input"
              type="text"
              placeholder="Search feeds..."
              autocomplete="off"
              autocapitalize="off"
            />
            <button
              v-if="searchQuery"
              class="add-clear-btn"
              type="button"
              title="Clear"
              @click="searchQuery = ''"
            ><X :size="12" /></button>
          </div>
          <button
            v-if="feeds.length"
            class="refresh-btn"
            :class="{ active: errorsOnly }"
            title="Show feeds with errors only"
            @click="errorsOnly = !errorsOnly"
          >
            <AlertCircle :size="13" />
          </button>
          <button class="refresh-btn" :disabled="loading" title="Refresh" @click="load">
            <RefreshCw :size="13" :class="{ spinning: loading }" />
          </button>
        </div>

        <div v-if="loading && !feeds.length" class="list-empty">Loading...</div>
        <div v-else-if="!feeds.length" class="list-empty">No feeds subscribed yet.</div>
        <div v-else-if="!filteredFeeds.length" class="list-empty">
          {{ errorsOnly && !searchQuery ? 'No feeds with errors.' : `No feeds matching "${searchQuery}".` }}
        </div>

        <div v-else class="feed-list">
          <template v-for="cat in groupedFeeds" :key="cat.id">
            <div class="cat-header" @click="toggleCat(cat.id)">
              <ChevronDown v-if="!collapsedCats[cat.id]" :size="12" class="cat-chevron" />
              <ChevronRight v-else :size="12" class="cat-chevron" />
              {{ cat.title }}
            </div>
            <template v-if="!collapsedCats[cat.id]">
            <div
              v-for="feed in cat.feeds"
              :key="feed.id"
              class="feed-row"
              :class="{ editing: editingId === feed.id }"
            >
              <template v-if="editingId !== feed.id">
                <img
                  v-if="iconUrl(feed)"
                  :src="iconUrl(feed)"
                  class="feed-row-icon"
                  alt=""
                  @error="iconFailed[feed.id] = true"
                />
                <Rss v-else class="feed-row-icon feed-row-icon--placeholder" :size="14" />
              </template>
              <div class="feed-title-col">
                <span class="feed-title" :title="feed.feed_url">{{ feed.title }}</span>
                <span v-if="expandedErrorId === feed.id" class="feed-error-msg" :title="feed.last_error">{{ interpretError(feed.last_error ?? '') }}</span>
                <span v-if="expandedNoteId === feed.id" class="feed-note-text">{{ feedNotes[feed.id] }}</span>
              </div>
              <button
                v-if="feed.last_error && editingId !== feed.id"
                class="feed-error-btn"
                :class="{ active: expandedErrorId === feed.id }"
                title="Show error"
                @click="toggleError(feed.id)"
              >!</button>
              <button
                v-if="feedNotes[feed.id] && editingId !== feed.id"
                class="feed-note-btn"
                :class="{ active: expandedNoteId === feed.id }"
                title="Show note"
                @click="toggleNote(feed.id)"
              ><StickyNote :size="13" /></button>
              <div v-if="editingId !== feed.id" class="feed-actions">
                <button
                  class="action-btn"
                  title="Refresh"
                  :disabled="refreshingId === feed.id"
                  @click="triggerRefresh(feed.id)"
                >
                  <RefreshCw :size="13" :class="{ spinning: refreshingId === feed.id }" />
                </button>
                <button class="action-btn" title="Edit" @click="startEdit(feed)">
                  <Pencil :size="13" />
                </button>
                <button class="action-btn action-btn--danger" title="Delete" @click="confirmDelete(feed)">
                  <Trash2 :size="13" />
                </button>
              </div>
              <template v-if="editingId === feed.id">
                <div class="edit-form">
                  <div class="edit-icon-row">
                    <img
                      v-if="iconUrl(feed)"
                      :src="iconUrl(feed)"
                      class="edit-icon-preview"
                      alt=""
                      @error="iconFailed[feed.id] = true"
                    />
                    <Rss v-else class="edit-icon-preview edit-icon-preview--placeholder" :size="16" />
                    <label class="edit-icon-btn">
                      <Loader2 v-if="uploadingIconId === feed.id" :size="13" class="spinning" />
                      <span v-else>Change icon</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/x-icon,.ico"
                        class="edit-icon-file-input"
                        :disabled="uploadingIconId === feed.id"
                        @change="onIconFileSelected($event, feed)"
                      />
                    </label>
                    <button
                      v-if="feed.has_icon"
                      class="edit-icon-btn"
                      type="button"
                      :disabled="uploadingIconId === feed.id"
                      @click="onRemoveIcon(feed)"
                    >Remove icon</button>
                  </div>
                  <p v-if="iconError && editingId === feed.id" class="add-error">{{ iconError }}</p>
                  <input v-model="editTitle" class="edit-input" placeholder="Title" maxlength="250" />
                  <div class="edit-url-row">
                    <input v-model="editFeedUrl" class="edit-input edit-url-input" type="url" placeholder="Feed URL" />
                    <a class="edit-url-link" :href="editFeedUrl || undefined" target="_blank" rel="noopener noreferrer" title="Open feed URL" :tabindex="editFeedUrl ? 0 : -1">
                      <ExternalLink :size="13" />
                    </a>
                  </div>
                  <select v-model.number="editCatId" class="edit-select">
                    <option :value="0">Uncategorized</option>
                    <option v-for="c in userCategories" :key="c.id" :value="c.id">{{ c.title }}</option>
                  </select>
                  <textarea
                    v-model="editNote"
                    class="edit-input edit-note-input"
                    placeholder="Feed notes"
                    rows="2"
                  />
                  <div class="edit-actions">
                    <button class="edit-save" :disabled="saving" @click="saveEdit(feed)">Save</button>
                    <button class="edit-cancel" @click="cancelEdit">Cancel</button>
                  </div>
                </div>
              </template>
            </div>
            </template>
          </template>
        </div>
      </section>
    </div>

    <ConfirmDialog
      v-if="feedToDelete"
      :message="`Delete &quot;${feedToDelete.title}&quot;? This cannot be undone.`"
      @confirm="doDelete"
      @cancel="feedToDelete = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Download, Upload, Plus, Pencil, Trash2, RefreshCw, ExternalLink, X, Loader2, ChevronDown, ChevronRight, AlertCircle, StickyNote, Rss } from 'lucide-vue-next'
import { getAllFeeds, getAllCategories, deleteFeed, addFeed, editFeed, importOpml, resolveSubscribeUrl, refreshFeed, getFeedNotes, uploadFeedIcon, removeFeedIcon } from '@/api/feeds'
import { ApiError } from '@/api/client'
import { useFeedsStore } from '@/stores/feeds'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { ApiFeed, ApiCategory } from '@/types/api'

const feedsStore = useFeedsStore()

const feeds = ref<ApiFeed[]>([])
const categories = ref<ApiCategory[]>([])
const loading = ref(false)

const editingId = ref<number | null>(null)
const editTitle = ref('')
const editFeedUrl = ref('')
const editCatId = ref(0)
const editNote = ref('')
const saving = ref(false)

const feedNotes = ref<Record<number, string>>({})
const expandedNoteId = ref<number | null>(null)

// Icon load failures and a per-feed cache-busting counter (the icon URL is
// otherwise identical before/after an upload, since it's keyed by feed_id
// alone - see rhesus_settings/upload_icon.php).
const iconFailed = ref<Record<number, boolean>>({})
const iconVersion = ref<Record<number, number>>({})
const uploadingIconId = ref<number | null>(null)
const iconError = ref<string | null>(null)

const ALLOWED_ICON_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon',
])

const newFeedUrl = ref('')
const newFeedCatId = ref(0)
const newFeedNote = ref('')
const adding = ref(false)
const addError = ref<string | null>(null)
const addSuccess = ref<string | null>(null)
const feedChoices = ref<Record<string, string> | null>(null)

const feedToDelete = ref<ApiFeed | null>(null)
const expandedErrorId = ref<number | null>(null)
const refreshingId = ref<number | null>(null)
const collapsedCats = ref<Record<number, boolean>>({})

const importStatus = ref<string | null>(null)
const importStatusClass = ref('')
const searchQuery = ref('')
const errorsOnly = ref(false)

const opmlExportUrl = '/tt-rss/backend.php?op=opml&method=export'

const userCategories = computed(() =>
  categories.value.filter((c) => c.id > 0).sort((a, b) => a.title.localeCompare(b.title)),
)

const catMap = computed(() => {
  const m = new Map<number, string>()
  m.set(0, 'Uncategorized')
  for (const c of categories.value) {
    if (c.id > 0) m.set(c.id, c.title)
  }
  return m
})

const filteredFeeds = computed(() => {
  let result = feeds.value
  if (errorsOnly.value) result = result.filter((f) => f.last_error)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) result = result.filter((f) => f.title.toLowerCase().includes(q) || f.feed_url.toLowerCase().includes(q))
  return result
})

interface CatGroup { id: number; title: string; feeds: ApiFeed[] }

const groupedFeeds = computed((): CatGroup[] => {
  const map = new Map<number, CatGroup>()
  for (const feed of [...filteredFeeds.value].sort((a, b) => a.title.localeCompare(b.title))) {
    const catId = feed.cat_id ?? 0
    if (!map.has(catId)) {
      map.set(catId, { id: catId, title: catMap.value.get(catId) ?? 'Uncategorized', feeds: [] })
    }
    map.get(catId)!.feeds.push(feed)
  }
  return [...map.values()].sort((a, b) => {
    if (a.id === 0) return 1
    if (b.id === 0) return -1
    return a.title.localeCompare(b.title)
  })
})

async function load() {
  loading.value = true
  try {
    const [f, c, notes] = await Promise.all([getAllFeeds(), getAllCategories(), getFeedNotes()])
    feeds.value = f
    categories.value = c
    feedNotes.value = notes
  } finally {
    loading.value = false
  }
}

onMounted(load)

function toggleCat(catId: number) {
  collapsedCats.value[catId] = !collapsedCats.value[catId]
}

function toggleError(feedId: number) {
  expandedErrorId.value = expandedErrorId.value === feedId ? null : feedId
}

function toggleNote(feedId: number) {
  expandedNoteId.value = expandedNoteId.value === feedId ? null : feedId
}

function iconUrl(feed: ApiFeed): string | undefined {
  if (!feed.has_icon || iconFailed.value[feed.id]) return undefined
  const v = iconVersion.value[feed.id]
  return `/tt-rss/public.php?op=feed_icon&id=${feed.id}${v ? `&v=${v}` : ''}`
}

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
    default:
      return 'Failed to upload icon.'
  }
}

async function onIconFileSelected(event: Event, feed: ApiFeed) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  iconError.value = null

  // Mirrors the server's own validation (upload_icon.php) for immediate
  // feedback - the server check is what actually matters for security, this
  // one just avoids a round trip for the common case (e.g. picking an SVG).
  if (!ALLOWED_ICON_MIME_TYPES.has(file.type)) {
    iconError.value = friendlyIconError('ICON_INVALID_TYPE', file.type)
    return
  }

  uploadingIconId.value = feed.id
  try {
    await uploadFeedIcon(feed.id, file)
    feed.has_icon = true
    iconFailed.value[feed.id] = false
    iconVersion.value[feed.id] = (iconVersion.value[feed.id] ?? 0) + 1
    feedsStore.loadTree()
  } catch (e) {
    iconError.value = e instanceof ApiError ? friendlyIconError(e.code, e.message) : 'Failed to upload icon.'
  } finally {
    uploadingIconId.value = null
  }
}

async function onRemoveIcon(feed: ApiFeed) {
  iconError.value = null
  uploadingIconId.value = feed.id
  try {
    await removeFeedIcon(feed.id)
    feed.has_icon = false
    iconVersion.value[feed.id] = (iconVersion.value[feed.id] ?? 0) + 1
    feedsStore.loadTree()
  } catch {
    iconError.value = 'Failed to remove icon.'
  } finally {
    uploadingIconId.value = null
  }
}

function interpretError(err: string): string {
  if (/Empty feed data provided/i.test(err))
    return 'Bot protection or error page received instead of feed content'
  if (/Opening and ending tag mismatch:.*\b(head|meta|link)\b/i.test(err))
    return 'Bot protection or error page received instead of feed content'
  if (/403 Forbidden/i.test(err)) return 'Access blocked (HTTP 403)'
  if (/404 Not Found/i.test(err)) return 'Feed not found (HTTP 404)'
  if (/503|Service Unavailable/i.test(err)) return 'Server unavailable (HTTP 503)'
  if (/429|Too Many Requests|throttled/i.test(err)) return 'Rate limited (HTTP 429)'
  if (/cURL error 28|timed out|Operation timed out/i.test(err)) return 'Connection timed out'
  if (/cURL error 6|Could not resolve host/i.test(err)) return 'DNS lookup failed'
  if (/no content was received/i.test(err)) return 'Feed returned empty response'
  if (/LibXML error/i.test(err)) return 'Feed XML is malformed'
  return err
}

function startEdit(feed: ApiFeed) {
  editingId.value = feed.id
  editTitle.value = feed.title
  editFeedUrl.value = feed.feed_url
  editCatId.value = feed.cat_id ?? 0
  editNote.value = feedNotes.value[feed.id] ?? ''
  iconError.value = null
}

function cancelEdit() {
  editingId.value = null
  iconError.value = null
}

async function saveEdit(feed: ApiFeed) {
  saving.value = true
  try {
    const title = editTitle.value.trim() || feed.title
    const feed_url = editFeedUrl.value.trim() || feed.feed_url
    const urlChanged = feed_url !== feed.feed_url
    const note = editNote.value.trim()
    await editFeed(feed.id, { title, feed_url, cat_id: editCatId.value, note })
    feed.title = title
    feed.feed_url = feed_url
    feed.cat_id = editCatId.value
    if (note) {
      feedNotes.value[feed.id] = note
    } else {
      delete feedNotes.value[feed.id]
      if (expandedNoteId.value === feed.id) expandedNoteId.value = null
    }
    editingId.value = null
    feedsStore.loadTree()
    if (urlChanged) {
      await triggerRefresh(feed.id)
    }
  } finally {
    saving.value = false
  }
}

async function triggerRefresh(feedId: number) {
  refreshingId.value = feedId
  try {
    await refreshFeed(feedId)
    await editFeed(feedId, { update_interval: 0 })
    await load()
    feedsStore.loadTree()
  } finally {
    refreshingId.value = null
  }
}

function confirmDelete(feed: ApiFeed) {
  feedToDelete.value = feed
}

async function doDelete() {
  const feed = feedToDelete.value
  feedToDelete.value = null
  if (!feed) return
  await deleteFeed(feed.id)
  feeds.value = feeds.value.filter((f) => f.id !== feed.id)
  feedsStore.loadTree()
}

async function subscribeToUrl(feedUrl: string) {
  adding.value = true
  addError.value = null
  addSuccess.value = null
  feedChoices.value = null
  try {
    const result = await addFeed(feedUrl, newFeedCatId.value)
    if (result.code === 0) {
      addError.value = 'Already subscribed to that feed.'
    } else if (result.code === 1) {
      const note = newFeedNote.value.trim()
      if (note && result.feed_id) {
        await editFeed(result.feed_id, { note })
        feedNotes.value[result.feed_id] = note
      }
      newFeedUrl.value = ''
      newFeedNote.value = ''
      addSuccess.value = `Feed added successfully: ${feedUrl}`
      setTimeout(() => { addSuccess.value = null }, 4000)
      await load()
      feedsStore.loadTree()
    } else if (result.code === 2) {
      addError.value = result.message ? `Invalid URL: ${result.message}` : 'Invalid URL.'
    } else if (result.code === 3) {
      addError.value = 'No feed found at that URL.'
    } else if (result.code === 4) {
      feedChoices.value = result.feeds ?? null
      if (!feedChoices.value) addError.value = 'Multiple feeds found - please use a direct feed URL.'
    } else if (result.code === 5) {
      addError.value = result.message ? `Could not fetch feed: ${result.message}` : 'Could not fetch feed.'
    } else if (result.code === 6) {
      addError.value = result.message ? `Feed could not be parsed: ${result.message}` : 'Feed content could not be parsed.'
    } else {
      addError.value = result.message ? `Error (code ${result.code}): ${result.message}` : `Error (code ${result.code}).`
    }
  } finally {
    adding.value = false
  }
}

async function selectFeedChoice(url: string) {
  await subscribeToUrl(url)
}

async function submitAddFeed() {
  const raw = newFeedUrl.value.trim()
  if (!raw || adding.value) return
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  adding.value = true
  addError.value = null
  feedChoices.value = null
  try {
    const resolved = await resolveSubscribeUrl(url)
    const resolvedNote = resolved.url !== url ? ` (tried: ${resolved.url})` : ''
    await subscribeToUrl(resolved.url)
    if (addError.value && resolvedNote) addError.value = addError.value + resolvedNote
  } catch (e) {
    if (e instanceof ApiError) {
      const messages: Record<string, string> = {
        'UNKNOWN_FEED':       'No feed found at that URL.',
        'INVALID_URL':        'Invalid URL (must be http/https on a standard port, and not a private address).',
        'MISSING_URL':        'No URL provided.',
        'NOT_LOGGED_IN':      'Not logged in - please refresh and try again.',
        'API_DISABLED':       'API access is not enabled for this account.',
        'LOGIN_ERROR':        'Authentication failed.',
        'INCORRECT_USAGE':    'Unexpected error - this may be a bug in Rhesus.',
        'UNKNOWN_METHOD':     'Server configuration error: feed resolution unavailable (rhesus_settings plugin may not be active).',
        'E_OPERATION_FAILED': 'Operation failed on the server.',
        'E_NOT_FOUND':        'Resource not found.',
        'HTTP_ERROR':         'Network error contacting the server.',
      }
      const friendly = messages[e.code]
      addError.value = friendly ?? `Failed to add feed: ${e.code}`
    } else {
      addError.value = e instanceof Error ? `Failed to add feed: ${e.message}` : 'Failed to add feed.'
    }
  } finally {
    adding.value = false
  }
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importStatus.value = 'Importing...'
  importStatusClass.value = ''
  try {
    const content = await file.text()
    await importOpml(content)
    importStatus.value = 'Import complete.'
    importStatusClass.value = 'success'
    await load()
    feedsStore.loadTree()
  } catch {
    importStatus.value = 'Import failed.'
    importStatusClass.value = 'error'
  }
  setTimeout(() => { importStatus.value = null }, 4000)
}
</script>

<style scoped>
.feed-editor {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--color-bg);
}

.feed-editor-inner {
  padding: 24px;
}

h2 {
  font-size: var(--font-size-xl);
  margin-bottom: 24px;
}

section {
  margin-bottom: 28px;
}

h3 {
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

/* OPML */
.opml-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.opml-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  text-decoration: none;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.opml-btn:hover {
  background: var(--color-surface-raised);
}

.opml-import-label {
  position: relative;
  overflow: hidden;
}

.opml-file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.opml-status {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.opml-status.success {
  color: var(--color-accent);
}

.opml-status.error {
  color: var(--color-danger);
}

/* Add feed */
.add-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.add-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.add-input-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
}

.add-input {
  width: 100%;
  padding: 7px 28px 7px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
}

.add-input:focus {
  border-color: var(--color-accent);
}

.add-note-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
}

.add-clear-btn {
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

.add-clear-btn:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.add-select {
  padding: 7px 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  flex-shrink: 0;
  max-width: 140px;
}

.add-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  flex-shrink: 0;
  transition: opacity var(--transition-fast);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.add-success {
  margin-top: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-accent);
}

.add-error {
  margin-top: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

.feed-choices {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feed-choices-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: 2px;
}

.feed-choice-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  text-align: left;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.feed-choice-btn:hover:not(:disabled) {
  background: var(--color-surface-raised);
  border-color: var(--color-accent);
}

.feed-choice-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.feed-choice-title {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.feed-choice-url {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-text-muted);
  word-break: break-all;
}

/* Feed list */
.list-section {
  margin-bottom: 0;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.list-header h3 {
  margin-bottom: 0;
  white-space: nowrap;
}

.search-input-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: 5px 26px 5px 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
}

.search-input:focus {
  border-color: var(--color-accent);
}

.refresh-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--color-text-muted);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.refresh-btn.active {
  color: var(--color-accent);
}

.refresh-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinning {
  animation: spin 0.8s linear infinite;
}

.list-empty {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  padding: 12px 0;
}

.feed-list {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
}

.cat-header {
  padding: 6px 12px;
  font-size: var(--font-size-xs, 11px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-primary);
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cat-chevron {
  flex-shrink: 0;
  opacity: 0.6;
}

.cat-header:not(:first-child) {
  border-top: 1px solid var(--color-border);
}

.feed-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  min-height: 44px;
}

.feed-row:last-child {
  border-bottom: none;
}

.feed-row.editing {
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  background: var(--color-surface);
}

.feed-row.editing .feed-title-col {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}

.feed-row.editing .edit-form {
  padding: 12px;
}

.feed-row-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
  object-fit: contain;
}

img.feed-row-icon {
  background: #fff;
  padding: 1px;
  border-radius: 3px;
}

.feed-row-icon--placeholder {
  color: var(--color-text-muted);
}

.feed-title-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feed-title {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-error-msg {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-danger);
  white-space: normal;
  line-height: 1.4;
}

.feed-error-btn {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-danger);
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--color-danger);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}

.feed-error-btn:hover {
  opacity: 1;
}

.feed-error-btn.active {
  opacity: 1;
  background: var(--color-danger);
  color: #fff;
}

.feed-note-text {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-text-muted);
  white-space: normal;
  line-height: 1.4;
}

.feed-note-btn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  opacity: 0.8;
  transition: opacity var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}

.feed-note-btn:hover {
  opacity: 1;
}

.feed-note-btn.active {
  opacity: 1;
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.feed-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--color-text-muted);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.action-btn:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.action-btn--danger:hover {
  color: var(--color-danger);
}

/* Inline edit form */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-icon-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-icon-preview {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 3px;
  object-fit: contain;
  background: #fff;
  padding: 2px;
}

.edit-icon-preview--placeholder {
  color: var(--color-text-muted);
  background: transparent;
  padding: 0;
}

.edit-icon-btn {
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

.edit-icon-btn:hover {
  border-color: var(--color-accent);
}

.edit-icon-file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.edit-url-row {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
}

.edit-url-row:focus-within {
  border-color: var(--color-accent);
}

.edit-url-input {
  flex: 1;
  min-width: 0;
  border: none !important;
  outline: none !important;
  background: transparent;
}

.edit-url-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.edit-url-link:hover {
  color: var(--color-accent);
}

.edit-input,
.edit-select {
  padding: 7px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
  width: 100%;
}

.edit-input:focus,
.edit-select:focus {
  border-color: var(--color-accent);
}

.edit-note-input {
  resize: vertical;
  font-family: inherit;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.edit-save,
.edit-cancel {
  padding: 6px 14px;
  border-radius: 4px;
  font-size: var(--font-size-sm);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.edit-save {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.edit-save:disabled {
  opacity: 0.5;
  cursor: default;
}

.edit-cancel {
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.edit-cancel:hover {
  background: var(--color-surface-raised);
}
</style>
