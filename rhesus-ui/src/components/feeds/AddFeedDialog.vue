<template>
  <div v-if="!previewUrl" class="overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header-row">
        <h3>Add feed</h3>
        <button class="close-btn" title="Close" @click="$emit('close')"><X :size="16" /></button>
      </div>
      <div class="add-row">
        <div class="add-input-wrap">
          <input
            ref="urlInput"
            v-model="newFeedUrl"
            class="add-input"
            type="text"
            placeholder="https://example.com/feed.xml"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
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
        <button class="add-btn" :disabled="!newFeedUrl.trim() || adding" @click="submitAddFeed">
          <Loader2 v-if="adding" :size="14" class="spinning" />
          <Plus v-else :size="14" />
        </button>
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
    </div>
  </div>

  <FeedPreviewDialog
    v-if="previewUrl"
    :loading="previewLoading"
    :error="previewError"
    :preview="previewData"
    :categories="userCategories"
    @confirm="confirmAddFeed"
    @cancel="cancelPreview"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { Plus, Loader2, X } from 'lucide-vue-next'
import { getAllCategories } from '@/api/feeds'
import FeedPreviewDialog from '@/components/feeds/FeedPreviewDialog.vue'
import { useAddFeed } from '@/composables/useAddFeed'
import type { ApiCategory } from '@/types/api'

defineEmits<{ close: [] }>()

const {
  newFeedUrl, adding, addError, addSuccess, feedChoices,
  previewUrl, previewLoading, previewError, previewData,
  submitAddFeed, confirmAddFeed, selectFeedChoice, cancelPreview,
} = useAddFeed()

const categories = ref<ApiCategory[]>([])
const userCategories = computed(() =>
  categories.value.filter((c) => c.id > 0).sort((a, b) => a.title.localeCompare(b.title)),
)

const urlInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  categories.value = await getAllCategories()
  await nextTick()
  urlInput.value?.focus()
})
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
}

.dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--card-radius);
  padding: 20px;
  max-width: 420px;
  width: 90%;
}

.dialog-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.dialog-header-row h3 {
  font-size: var(--font-size-md);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  padding: 4px;
  border-radius: 4px;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.close-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-surface-raised);
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

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
</style>
