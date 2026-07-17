<template>
  <div class="overlay" @click.self="$emit('cancel')">
    <div class="dialog">
      <p>{{ message }}</p>
      <textarea
        v-if="reasonPlaceholder"
        v-model="reasonText"
        class="reason-input"
        :placeholder="reasonPlaceholder"
        rows="2"
      />
      <div class="actions">
        <button class="btn-cancel" @click="$emit('cancel')">Cancel</button>
        <button class="btn-confirm" @click="$emit('confirm', reasonText)">Confirm</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ message: string; reasonPlaceholder?: string }>()
defineEmits<{ confirm: [reason?: string]; cancel: [] }>()

const reasonText = ref('')
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
  padding: 24px;
  max-width: 360px;
  width: 90%;
}

p {
  margin-bottom: 20px;
}

.reason-input {
  width: 100%;
  resize: vertical;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 8px 10px;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-family: inherit;
  margin-bottom: 20px;
}

.reason-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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

.btn-confirm:hover {
  background: var(--color-accent-hover);
}
</style>
