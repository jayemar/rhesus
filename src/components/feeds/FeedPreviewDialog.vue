<template>
  <div class="overlay" @click.self="$emit('cancel')">
    <div class="dialog">
      <div v-if="loading" class="state-msg">Loading preview…</div>

      <div v-else-if="error" class="state-msg state-error">
        <p>{{ error }}</p>
      </div>

      <template v-else-if="preview">
        <div class="dialog-header">
          <h3>{{ preview.title || 'Untitled feed' }}</h3>
          <a v-if="preview.link" :href="preview.link" target="_blank" rel="noopener noreferrer" class="feed-link">{{ preview.link }}</a>
        </div>

        <div class="items">
          <div v-if="!preview.items.length" class="state-msg">No articles found in this feed.</div>
          <a
            v-for="(item, i) in preview.items"
            :key="i"
            class="item"
            :href="item.link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div class="item-title">{{ item.title || '(untitled)' }}</div>
            <div v-if="item.date" class="item-date">{{ formatDate(item.date) }}</div>
            <div v-if="item.description" class="item-desc">{{ item.description }}</div>
          </a>
        </div>

        <div class="options-row">
          <select v-model.number="catId" class="cat-select">
            <option :value="0">Uncategorized</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.title }}</option>
          </select>
          <input
            v-model="note"
            class="note-input"
            type="text"
            placeholder="Feed note (optional)"
            autocomplete="off"
          />
        </div>
      </template>

      <div class="actions">
        <button class="btn-cancel" @click="$emit('cancel')">Cancel</button>
        <button v-if="!loading && !error" class="btn-confirm" @click="$emit('confirm', catId, note)">Subscribe</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FeedPreview } from '@/api/feeds'
import type { ApiCategory } from '@/types/api'

defineProps<{
  loading: boolean
  error: string | null
  preview: FeedPreview | null
  categories: ApiCategory[]
}>()
defineEmits<{ confirm: [catId: number, note: string]; cancel: [] }>()

const catId = ref(0)
const note = ref('')

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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
  max-width: 520px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  margin-bottom: 12px;
}

.dialog-header h3 {
  margin: 0 0 4px;
}

.feed-link {
  font-size: 12px;
  color: var(--color-text-secondary);
  word-break: break-all;
}

.state-msg {
  padding: 24px 8px;
  text-align: center;
  color: var(--color-text-secondary);
}

.state-error {
  color: var(--color-danger);
}

.items {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.item {
  display: block;
  padding: 8px 10px;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
}

.item:hover {
  background: var(--color-surface-raised);
}

.item-title {
  font-weight: 600;
  font-size: 14px;
}

.item-date {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.item-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.options-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-shrink: 0;
}

.cat-select {
  padding: 7px 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  flex-shrink: 0;
  max-width: 140px;
}

.note-input {
  width: 100%;
  padding: 7px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
  flex: 1;
  min-width: 0;
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
