<template>
  <div class="snoozed-panel">
    <div class="manager-header">
      <h2>Self-destruct</h2>
    </div>

    <div v-if="loading" class="state-msg">Loading...</div>
    <div v-else-if="queued.length === 0" class="state-msg">Nothing is currently queued.</div>
    <ul v-else class="snoozed-list">
      <li v-for="item in queued" :key="item.article_id" class="snoozed-row">
        <div class="snoozed-info">
          <a
            class="snoozed-title"
            :href="item.link"
            target="_blank"
            rel="noopener noreferrer"
          >{{ item.title }}</a>
          <span class="snoozed-meta">Destroys {{ formatReturnTime(item.expires_at) }}</span>
        </div>
        <div class="snoozed-actions">
          <button class="icon-action" title="Edit time" @click="startEdit(item)"><Pencil :size="14" /></button>
          <button class="icon-action" title="Destroy now" @click="confirmingDestroyItem = item"><Flame :size="14" /></button>
          <button class="icon-action" title="Cancel" @click="cancelQueued(item)"><X :size="14" /></button>
        </div>
      </li>
    </ul>

    <div v-if="editingItem" class="edit-time-overlay" @click.self="editingItem = null">
      <div class="edit-time-dialog">
        <h3>Edit self-destruct time</h3>
        <input v-model="editValue" type="datetime-local" class="snooze-datetime-input" />
        <div class="edit-time-actions">
          <button @click="editingItem = null">Cancel</button>
          <button class="btn-primary" :disabled="!editValue || saving" @click="saveEditTime">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="confirmingDestroyItem" class="edit-time-overlay" @click.self="confirmingDestroyItem = null">
      <div class="edit-time-dialog">
        <h3>Destroy now?</h3>
        <p class="destroy-confirm-text">
          "{{ confirmingDestroyItem.title }}" will be marked read, all your labels on it removed, and unstarred - immediately, instead of waiting. This can't be undone.
        </p>
        <div class="edit-time-actions">
          <button @click="confirmingDestroyItem = null">Cancel</button>
          <button class="btn-primary btn-danger" :disabled="destroying" @click="confirmDestroyNow">
            {{ destroying ? 'Destroying...' : 'Destroy now' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Pencil, Flame, X } from 'lucide-vue-next'
import { getSelfDestructArticles, cancelSelfDestruct, destroySelfDestructNow, updateSelfDestructTime } from '@/api/selfDestruct'
import type { SelfDestructedArticle } from '@/api/selfDestruct'

const emit = defineEmits<{ copied: [label: string] }>()

const queued = ref<SelfDestructedArticle[]>([])
const loading = ref(true)
const editingItem = ref<SelfDestructedArticle | null>(null)
const editValue = ref('')
const saving = ref(false)
const confirmingDestroyItem = ref<SelfDestructedArticle | null>(null)
const destroying = ref(false)

async function load() {
  loading.value = true
  try {
    queued.value = await getSelfDestructArticles()
  } catch (e) {
    console.error('getSelfDestructArticles failed:', e)
    emit('copied', 'Could not load queued articles')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function formatReturnTime(expiresAt: string): string {
  // TT-RSS/Postgres timestamps come back without a timezone suffix - they're
  // UTC, so Date needs to be told that explicitly or it would parse them as
  // local time instead.
  const iso = expiresAt.includes('T') ? expiresAt : expiresAt.replace(' ', 'T')
  const date = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return date.toLocaleString()
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toDatetimeLocalValue(expiresAt: string): string {
  const iso = expiresAt.includes('T') ? expiresAt : expiresAt.replace(' ', 'T')
  const date = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function startEdit(item: SelfDestructedArticle) {
  editingItem.value = item
  editValue.value = toDatetimeLocalValue(item.expires_at)
}

async function saveEditTime() {
  if (!editingItem.value || !editValue.value || saving.value) return
  const until = new Date(editValue.value)
  if (isNaN(until.getTime())) {
    emit('copied', 'Invalid date/time')
    return
  }
  saving.value = true
  try {
    await updateSelfDestructTime(editingItem.value.article_id, until)
    editingItem.value = null
    await load()
    emit('copied', 'Self-destruct time updated')
  } catch (e) {
    console.error('updateSelfDestructTime failed:', e)
    emit('copied', 'Could not update self-destruct time')
  } finally {
    saving.value = false
  }
}

async function cancelQueued(item: SelfDestructedArticle) {
  try {
    await cancelSelfDestruct(item.article_id)
    queued.value = queued.value.filter((s) => s.article_id !== item.article_id)
    emit('copied', 'Cancelled')
  } catch (e) {
    console.error('cancelSelfDestruct failed:', e)
    emit('copied', 'Could not cancel')
  }
}

async function confirmDestroyNow() {
  if (!confirmingDestroyItem.value || destroying.value) return
  const item = confirmingDestroyItem.value
  destroying.value = true
  try {
    await destroySelfDestructNow(item.article_id)
    queued.value = queued.value.filter((s) => s.article_id !== item.article_id)
    confirmingDestroyItem.value = null
    emit('copied', 'Destroyed')
  } catch (e) {
    console.error('destroySelfDestructNow failed:', e)
    emit('copied', 'Could not destroy')
  } finally {
    destroying.value = false
  }
}
</script>

<style scoped>
.snoozed-panel {
  padding: 16px;
}

.manager-header {
  margin-bottom: 16px;
}

.manager-header h2 {
  margin: 0;
  font-size: var(--font-size-lg);
}

.state-msg {
  color: var(--color-text-muted);
  padding: 24px 0;
  text-align: center;
}

.snoozed-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.snoozed-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
}

.snoozed-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.snoozed-title {
  color: var(--color-text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snoozed-title:hover {
  text-decoration: underline;
}

.snoozed-meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.snoozed-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.icon-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--color-text-muted);
}

.icon-action:hover {
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.edit-time-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.edit-time-dialog {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  width: 280px;
}

.edit-time-dialog h3 {
  margin: 0 0 12px;
  font-size: var(--font-size-base);
}

.destroy-confirm-text {
  margin: 0 0 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.snooze-datetime-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.edit-time-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.btn-primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
  padding: 6px 12px;
  border-radius: 4px;
  font-weight: 600;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-danger {
  background: var(--color-danger, #dc2626);
}
</style>
