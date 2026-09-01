<template>
  <div class="snoozed-panel">
    <div class="manager-header">
      <h2>Snoozed</h2>
    </div>

    <div v-if="loading" class="state-msg">Loading...</div>
    <div v-else-if="snoozed.length === 0" class="state-msg">Nothing is currently snoozed.</div>
    <ul v-else class="snoozed-list">
      <li v-for="item in snoozed" :key="item.article_id" class="snoozed-row">
        <div class="snoozed-info">
          <a
            class="snoozed-title"
            :href="item.link"
            target="_blank"
            rel="noopener noreferrer"
          >{{ item.title }}</a>
          <span class="snoozed-meta">Returns {{ formatReturnTime(item.expires_at) }}</span>
        </div>
        <div class="snoozed-actions">
          <button class="icon-action" title="Edit time" @click="startEdit(item)"><Pencil :size="14" /></button>
          <button class="icon-action" title="Unsnooze now" @click="unsnoozeNow(item)"><AlarmClockOff :size="14" /></button>
        </div>
      </li>
    </ul>

    <div v-if="editingItem" class="edit-time-overlay" @click.self="editingItem = null">
      <div class="edit-time-dialog">
        <h3>Edit snooze time</h3>
        <input v-model="editValue" type="datetime-local" class="snooze-datetime-input" />
        <div class="edit-time-actions">
          <button @click="editingItem = null">Cancel</button>
          <button class="btn-primary" :disabled="!editValue || saving" @click="saveEditTime">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Pencil, AlarmClockOff } from 'lucide-vue-next'
import { getSnoozedArticles, unsnoozeArticle, updateSnoozeTime } from '@/api/snooze'
import type { SnoozedArticle } from '@/api/snooze'

const emit = defineEmits<{ copied: [label: string] }>()

const snoozed = ref<SnoozedArticle[]>([])
const loading = ref(true)
const editingItem = ref<SnoozedArticle | null>(null)
const editValue = ref('')
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    snoozed.value = await getSnoozedArticles()
  } catch (e) {
    console.error('getSnoozedArticles failed:', e)
    emit('copied', 'Could not load snoozed articles')
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

function startEdit(item: SnoozedArticle) {
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
    await updateSnoozeTime(editingItem.value.article_id, until)
    editingItem.value = null
    await load()
    emit('copied', 'Snooze time updated')
  } catch (e) {
    console.error('updateSnoozeTime failed:', e)
    emit('copied', 'Could not update snooze time')
  } finally {
    saving.value = false
  }
}

async function unsnoozeNow(item: SnoozedArticle) {
  try {
    await unsnoozeArticle(item.article_id)
    snoozed.value = snoozed.value.filter((s) => s.article_id !== item.article_id)
    emit('copied', 'Unsnoozed')
  } catch (e) {
    console.error('unsnoozeArticle failed:', e)
    emit('copied', 'Could not unsnooze')
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
</style>
