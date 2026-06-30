<template>
  <div class="filter-editor">
    <div class="editor-header">
      <button class="back-btn" @click="$emit('cancel')"><ChevronLeft :size="16" /> Back</button>
      <span class="editor-title">{{ isNew ? 'New filter' : 'Edit filter' }}</span>
    </div>

    <div class="editor-body">
      <section>
        <h3>General</h3>
        <label class="field-row">
          <span>Title</span>
          <input v-model="draft.title" class="field-input" type="text" placeholder="Untitled filter" />
        </label>
        <label class="field-row toggle-row">
          <span>Enabled</span>
          <input type="checkbox" v-model="draft.enabled" />
        </label>
        <label class="field-row toggle-row">
          <span>Match any rule (OR)</span>
          <input type="checkbox" v-model="draft.match_any_rule" />
        </label>
      </section>

      <section>
        <h3>Rules</h3>
        <div v-for="(rule, i) in draft.rules" :key="i" class="rule-row">
          <div class="rule-main">
            <select v-model.number="rule.filter_type" class="field-select">
              <option :value="1">Title</option>
              <option :value="2">Content</option>
              <option :value="3">Title or Content</option>
              <option :value="4">Link</option>
              <option :value="6">Author</option>
              <option :value="7">Tags</option>
            </select>
            <input v-model="rule.reg_exp" class="field-input rule-input" type="text" placeholder="Regex or text" />
            <button class="remove-btn" type="button" title="Remove rule" @click="removeRule(i)"><X :size="14" /></button>
          </div>
          <label class="rule-sub">
            <input type="checkbox" v-model="rule.inverse" />
            <span>Invert match</span>
          </label>
          <div class="rule-sub rule-scope">
            <span>Scope</span>
            <select v-model="rule.scopeType" class="field-select scope-select" @change="onScopeChange(rule)">
              <option value="all">All feeds</option>
              <option value="feed">Feed</option>
              <option value="cat">Category</option>
            </select>
            <select v-if="rule.scopeType === 'feed'" v-model.number="rule.feed_id" class="field-select scope-select">
              <option v-for="f in allFeeds" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
            <select v-if="rule.scopeType === 'cat'" v-model.number="rule.cat_id" class="field-select scope-select">
              <option v-for="c in allCats" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <p v-if="errors.rules" class="field-error">{{ errors.rules }}</p>
        <button class="add-btn" type="button" @click="addRule">+ Add rule</button>
      </section>

      <section>
        <h3>Actions</h3>
        <div v-for="(action, i) in draft.actions" :key="i" class="action-row">
          <div class="action-main">
            <select v-model.number="action.action_id" class="field-select" @change="onActionTypeChange(action)">
              <option :value="2">Mark as read</option>
              <option :value="1">Delete article</option>
              <option :value="3">Mark as starred</option>
              <option :value="7">Assign label</option>
              <option :value="6">Modify score</option>
              <option :value="8">Stop processing</option>
            </select>
            <input
              v-if="action.action_id === 6"
              v-model="action.action_param"
              class="field-input action-param"
              type="number"
              placeholder="Score delta"
            />
            <select
              v-else-if="action.action_id === 7"
              v-model="action.action_param"
              class="field-select action-param"
            >
              <option value="">-- pick label --</option>
              <option v-for="l in allLabels" :key="l.id" :value="l.caption">{{ l.caption }}</option>
            </select>
            <button class="remove-btn" type="button" title="Remove action" @click="removeAction(i)"><X :size="14" /></button>
          </div>
        </div>
        <p v-if="errors.actions" class="field-error">{{ errors.actions }}</p>
        <button class="add-btn" type="button" @click="addAction">+ Add action</button>
      </section>
    </div>

    <div class="editor-footer">
      <button class="btn-cancel" type="button" @click="$emit('cancel')">Cancel</button>
      <button class="btn-save" type="button" :disabled="saving" @click="save">
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ChevronLeft, X } from 'lucide-vue-next'
import { useFeedsStore } from '@/stores/feeds'
import { getAllLabels } from '@/api/articles'
import { saveFilter } from '@/api/filters'
import type { ApiFilter, ApiFilterRule, ApiFilterAction, ApiLabel, ApiFeedTreeItem } from '@/types/api'

type RuleWithScope = ApiFilterRule & { scopeType: 'all' | 'feed' | 'cat' }

interface DraftFilter {
  id?: number
  title: string
  enabled: boolean
  match_any_rule: boolean
  inverse: boolean
  rules: RuleWithScope[]
  actions: ApiFilterAction[]
}

const props = defineProps<{ filter: Partial<ApiFilter> }>()
const emit = defineEmits<{ save: [filter: ApiFilter]; cancel: [] }>()

const feedsStore = useFeedsStore()
const { tree } = storeToRefs(feedsStore)

const saving = ref(false)
const allLabels = ref<ApiLabel[]>([])
const errors = ref<{ rules?: string; actions?: string }>({})

const isNew = computed(() => !props.filter.id)

function toScopeType(rule: ApiFilterRule): 'all' | 'feed' | 'cat' {
  if (rule.cat_filter && rule.cat_id != null) return 'cat'
  if (!rule.cat_filter && rule.feed_id != null) return 'feed'
  return 'all'
}

function blankRule(): RuleWithScope {
  return { reg_exp: '', filter_type: 1, inverse: false, feed_id: null, cat_id: null, cat_filter: false, scopeType: 'all' }
}

function blankAction(): ApiFilterAction {
  return { action_id: 2, action_param: '' }
}

const draft = ref<DraftFilter>({
  id: props.filter.id,
  title: props.filter.title ?? '',
  enabled: props.filter.enabled ?? true,
  match_any_rule: props.filter.match_any_rule ?? true,
  inverse: props.filter.inverse ?? false,
  rules: (props.filter.rules ?? [blankRule()]).map(r => ({ ...r, scopeType: toScopeType(r) })),
  actions: props.filter.actions ?? [blankAction()],
})

const allFeeds = computed(() => {
  const feeds: { id: number; name: string }[] = []
  function walk(items: ApiFeedTreeItem[]) {
    for (const item of items) {
      if (item.type === 'feed' && item.bare_id > 0) feeds.push({ id: item.bare_id, name: item.name })
      if (item.items) walk(item.items)
    }
  }
  walk(tree.value)
  return feeds
})

const allCats = computed(() => {
  const cats: { id: number; name: string }[] = []
  function walk(items: ApiFeedTreeItem[]) {
    for (const item of items) {
      if (item.type === 'category' && item.bare_id > 0) cats.push({ id: item.bare_id, name: item.name })
      if (item.items) walk(item.items)
    }
  }
  walk(tree.value)
  return cats
})

onMounted(async () => {
  allLabels.value = await getAllLabels()
})

function addRule() {
  draft.value.rules.push(blankRule())
}

function removeRule(i: number) {
  draft.value.rules.splice(i, 1)
}

function addAction() {
  draft.value.actions.push(blankAction())
}

function removeAction(i: number) {
  draft.value.actions.splice(i, 1)
}

function onScopeChange(rule: RuleWithScope) {
  rule.feed_id = null
  rule.cat_id = null
  rule.cat_filter = rule.scopeType === 'cat'
}

function onActionTypeChange(action: ApiFilterAction) {
  action.action_param = ''
}

function validate(): boolean {
  errors.value = {}
  if (draft.value.rules.length === 0) { errors.value.rules = 'At least one rule is required.'; return false }
  if (draft.value.actions.length === 0) { errors.value.actions = 'At least one action is required.'; return false }
  return true
}

async function save() {
  if (!validate()) return
  saving.value = true
  try {
    const rules: ApiFilterRule[] = draft.value.rules.map(({ scopeType, ...r }) => ({
      ...r,
      feed_id: scopeType === 'feed' ? r.feed_id : null,
      cat_id: scopeType === 'cat' ? r.cat_id : null,
      cat_filter: scopeType === 'cat',
    }))
    const res = await saveFilter({ ...draft.value, rules })
    emit('save', { ...draft.value, id: res.id, rules } as ApiFilter)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.filter-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
}

.editor-title {
  font-weight: 600;
  font-size: var(--font-size-base);
}

.editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
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

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
  gap: 12px;
  font-size: var(--font-size-base);
}

.toggle-row span {
  flex: 1;
}

.field-input {
  flex: 1;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 6px 10px;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.field-select {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.rule-row {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-main {
  display: flex;
  gap: 6px;
  align-items: center;
}

.rule-input {
  flex: 1;
  min-width: 0;
}

.rule-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.rule-scope span {
  white-space: nowrap;
}

.scope-select {
  flex: 1;
  min-width: 0;
}

.action-row {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.action-main {
  display: flex;
  gap: 6px;
  align-items: center;
}

.action-param {
  flex: 1;
  min-width: 0;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  padding: 4px;
  border-radius: 4px;
  flex-shrink: 0;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.remove-btn:hover {
  color: var(--color-danger);
  background: var(--color-surface-raised);
}

.add-btn {
  margin-top: 6px;
  font-size: var(--font-size-sm);
  color: var(--color-accent);
  padding: 4px 0;
}

.field-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
  margin: 4px 0;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.btn-cancel {
  padding: 8px 16px;
  border-radius: 4px;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-save {
  padding: 8px 20px;
  border-radius: 4px;
  background: var(--color-accent);
  color: #fff;
  font-weight: 600;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
