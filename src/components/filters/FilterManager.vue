<template>
  <div class="filter-manager">
    <template v-if="!editingFilter">
      <div class="manager-header">
        <h2>Filters</h2>
      </div>

      <div class="manager-toolbar">
        <button class="btn-new" @click="startNew">New filter</button>
      </div>

      <div v-if="loading" class="state-msg">Loading...</div>
      <div v-else-if="filters.length === 0" class="state-msg">
        No filters yet. Filters automatically process incoming articles.
      </div>
      <ul v-else class="filter-list">
        <li v-for="f in filters" :key="f.id" class="filter-row">
          <div class="filter-info">
            <span class="filter-title">{{ f.title || 'Untitled filter' }}</span>
            <span v-if="f.last_triggered" class="filter-meta">Last triggered: {{ formatDate(f.last_triggered) }}</span>
            <span v-else class="filter-meta">Never triggered</span>
          </div>
          <div class="filter-actions">
            <input
              type="checkbox"
              :checked="f.enabled"
              title="Enabled"
              @change="toggleEnabled(f)"
            />
            <button class="icon-action" title="Edit" @click="startEdit(f)"><Pencil :size="14" /></button>
            <button class="icon-action danger" title="Delete" @click="confirmDelete(f)"><Trash2 :size="14" /></button>
          </div>
        </li>
      </ul>
    </template>

    <FilterEditor
      v-else
      :filter="editingFilter"
      @save="onSave"
      @cancel="editingFilter = null"
    />

    <ConfirmDialog
      v-if="filterToDelete"
      :message="`Delete filter '${filterToDelete.title || 'Untitled filter'}'? This cannot be undone.`"
      @confirm="doDelete"
      @cancel="filterToDelete = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import { getFilters, deleteFilter, setFilterEnabled } from '@/api/filters'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FilterEditor from './FilterEditor.vue'
import type { ApiFilter } from '@/types/api'

defineEmits<{ close: [] }>()

const loading = ref(false)
const filters = ref<ApiFilter[]>([])
const editingFilter = ref<Partial<ApiFilter> | null>(null)
const filterToDelete = ref<ApiFilter | null>(null)

onMounted(load)

async function load() {
  loading.value = true
  try {
    filters.value = await getFilters()
  } finally {
    loading.value = false
  }
}

function startNew() {
  editingFilter.value = {}
}

function startEdit(f: ApiFilter) {
  editingFilter.value = { ...f }
}

async function onSave(saved: ApiFilter) {
  editingFilter.value = null
  await load()
}

function confirmDelete(f: ApiFilter) {
  filterToDelete.value = f
}

async function doDelete() {
  if (!filterToDelete.value) return
  await deleteFilter(filterToDelete.value.id)
  filterToDelete.value = null
  await load()
}

async function toggleEnabled(f: ApiFilter) {
  f.enabled = !f.enabled
  try {
    await setFilterEnabled(f.id, f.enabled)
  } catch {
    f.enabled = !f.enabled
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.filter-manager {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--color-bg);
}

.manager-header {
  padding: 24px 24px 16px;
}

.manager-toolbar {
  padding: 12px 24px;
}

h2 {
  font-size: var(--font-size-xl);
}

.btn-new {
  padding: 7px 14px;
  border-radius: 4px;
  background: var(--color-accent);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.state-msg {
  padding: 48px 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
}

.filter-list {
  list-style: none;
  padding: 0 24px;
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
}

.filter-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.filter-title {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.icon-action {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  padding: 4px;
  border-radius: 4px;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.icon-action:hover {
  color: var(--color-text-primary);
  background: var(--color-surface-raised);
}

.icon-action.danger:hover {
  color: var(--color-danger);
}
</style>
