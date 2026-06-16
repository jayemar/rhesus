<template>
  <div class="feed-editor">
    <div class="feed-editor-inner">
      <h2>Manage feeds</h2>

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
        <div class="add-row">
          <input
            v-model="newFeedUrl"
            class="add-input"
            type="url"
            placeholder="https://example.com/feed.xml"
            :disabled="adding"
            @keydown.enter.prevent="submitAddFeed"
          />
          <select v-model.number="newFeedCatId" class="add-select" :disabled="adding">
            <option :value="0">Uncategorized</option>
            <option v-for="cat in userCategories" :key="cat.id" :value="cat.id">{{ cat.title }}</option>
          </select>
          <button class="add-btn" :disabled="!newFeedUrl.trim() || adding" @click="submitAddFeed">
            <Plus :size="14" />
          </button>
        </div>
        <p v-if="addError" class="add-error">{{ addError }}</p>
      </section>

      <section class="list-section">
        <div class="list-header">
          <h3>Feeds{{ feeds.length ? ` (${feeds.length})` : '' }}</h3>
          <button class="refresh-btn" :disabled="loading" title="Refresh" @click="load">
            <RefreshCw :size="13" :class="{ spinning: loading }" />
          </button>
        </div>

        <div v-if="loading && !feeds.length" class="list-empty">Loading...</div>
        <div v-else-if="!feeds.length" class="list-empty">No feeds subscribed yet.</div>

        <div v-else class="feed-list">
          <template v-for="cat in groupedFeeds" :key="cat.id">
            <div class="cat-header">{{ cat.title }}</div>
            <div
              v-for="feed in cat.feeds"
              :key="feed.id"
              class="feed-row"
              :class="{ editing: editingId === feed.id }"
            >
              <template v-if="editingId === feed.id">
                <div class="edit-form">
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
                  <div class="edit-actions">
                    <button class="edit-save" :disabled="saving" @click="saveEdit(feed)">Save</button>
                    <button class="edit-cancel" @click="cancelEdit">Cancel</button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="feed-title-col">
                  <span class="feed-title" :title="feed.feed_url">{{ feed.title }}</span>
                  <span v-if="expandedErrorId === feed.id" class="feed-error-msg">{{ feed.last_error }}</span>
                </div>
                <button
                  v-if="feed.last_error"
                  class="feed-error-btn"
                  :class="{ active: expandedErrorId === feed.id }"
                  title="Show error"
                  @click="toggleError(feed.id)"
                >!</button>
                <div class="feed-actions">
                  <button class="action-btn" title="Edit" @click="startEdit(feed)">
                    <Pencil :size="13" />
                  </button>
                  <button class="action-btn action-btn--danger" title="Delete" @click="confirmDelete(feed)">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </template>
            </div>
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
import { Download, Upload, Plus, Pencil, Trash2, RefreshCw, ExternalLink } from 'lucide-vue-next'
import { getAllFeeds, getAllCategories, deleteFeed, addFeed, editFeed, importOpml } from '@/api/feeds'
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
const saving = ref(false)

const newFeedUrl = ref('')
const newFeedCatId = ref(0)
const adding = ref(false)
const addError = ref<string | null>(null)

const feedToDelete = ref<ApiFeed | null>(null)
const expandedErrorId = ref<number | null>(null)

const importStatus = ref<string | null>(null)
const importStatusClass = ref('')

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

interface CatGroup { id: number; title: string; feeds: ApiFeed[] }

const groupedFeeds = computed((): CatGroup[] => {
  const map = new Map<number, CatGroup>()
  for (const feed of [...feeds.value].sort((a, b) => a.title.localeCompare(b.title))) {
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
    const [f, c] = await Promise.all([getAllFeeds(), getAllCategories()])
    feeds.value = f
    categories.value = c
  } finally {
    loading.value = false
  }
}

onMounted(load)

function toggleError(feedId: number) {
  expandedErrorId.value = expandedErrorId.value === feedId ? null : feedId
}

function startEdit(feed: ApiFeed) {
  editingId.value = feed.id
  editTitle.value = feed.title
  editFeedUrl.value = feed.feed_url
  editCatId.value = feed.cat_id ?? 0
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(feed: ApiFeed) {
  saving.value = true
  try {
    const title = editTitle.value.trim() || feed.title
    const feed_url = editFeedUrl.value.trim() || feed.feed_url
    await editFeed(feed.id, { title, feed_url, cat_id: editCatId.value })
    feed.title = title
    feed.feed_url = feed_url
    feed.cat_id = editCatId.value
    editingId.value = null
    feedsStore.loadTree()
  } finally {
    saving.value = false
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

async function submitAddFeed() {
  const url = newFeedUrl.value.trim()
  if (!url || adding.value) return
  adding.value = true
  addError.value = null
  try {
    const result = await addFeed(url, newFeedCatId.value)
    if (result.code === 0) {
      addError.value = 'Already subscribed to that feed.'
    } else if (result.code === 1) {
      newFeedUrl.value = ''
      await load()
      feedsStore.loadTree()
    } else if (result.code === 2) {
      addError.value = 'Invalid URL.'
    } else if (result.code === 3) {
      addError.value = 'No feed found at that URL.'
    } else if (result.code === 4) {
      addError.value = 'Multiple feeds found - please use a direct feed URL.'
    } else if (result.code === 5) {
      addError.value = result.message ? `Could not fetch feed: ${result.message}` : 'Could not fetch feed.'
    } else if (result.code === 6) {
      addError.value = 'Feed content could not be parsed.'
    } else {
      addError.value = `Error (code ${result.code}).`
    }
  } catch {
    addError.value = 'Failed to add feed.'
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
  max-width: 680px;
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
.add-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.add-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
}

.add-input:focus {
  border-color: var(--color-accent);
}

.add-select {
  padding: 7px 8px;
  background: var(--color-bg);
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
  color: #fff;
  flex-shrink: 0;
  transition: opacity var(--transition-fast);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.add-error {
  margin-top: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-danger);
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
  color: var(--color-text-muted);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
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
  padding: 12px;
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

.feed-error-btn:hover,
.feed-error-btn.active {
  opacity: 1;
  background: var(--color-danger);
  color: #fff;
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
  color: #fff;
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
