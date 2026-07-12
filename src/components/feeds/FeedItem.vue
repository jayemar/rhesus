<template>
  <button
    class="feed-item"
    :class="{ selected, unread: item.unread > 0 }"
    @click="$emit('select')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="cancelLongPress"
    @pointercancel="cancelLongPress"
  >
    <img
      v-if="iconUrl"
      :src="iconUrl"
      class="feed-icon"
      alt=""
      @error="iconFailed = true"
    />
    <Rss v-else class="feed-icon feed-icon--placeholder" :size="14" />
    <span class="feed-title">{{ item.name }}</span>
    <span v-if="item.unread > 0 || alwaysShowCount" class="feed-unread">{{ item.unread }}</span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Rss } from 'lucide-vue-next'
import type { ApiFeedTreeItem } from '@/types/api'

const props = defineProps<{
  item: ApiFeedTreeItem
  selected: boolean
  deletable?: boolean
  alwaysShowCount?: boolean
}>()

const emit = defineEmits<{ select: []; 'long-press': [] }>()

const iconFailed = ref(false)

let longPressTimer: ReturnType<typeof setTimeout> | null = null
let startX = 0
let startY = 0

function onPointerDown(e: PointerEvent) {
  if (!props.deletable || e.pointerType === 'mouse') return
  startX = e.clientX
  startY = e.clientY
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    emit('long-press')
  }, 600)
}

function onPointerMove(e: PointerEvent) {
  if (longPressTimer === null) return
  if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) cancelLongPress()
}

function cancelLongPress() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const iconUrl = computed(() => {
  if (iconFailed.value || !props.item.icon) return null
  return `/tt-rss/public.php?op=feed_icon&id=${props.item.bare_id}`
})
</script>

<style scoped>
.feed-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px 6px 20px;
  text-align: left;
  color: var(--color-text-secondary);
  border-radius: 0;
  transition: background var(--transition-fast);
  font-size: var(--font-size-base);
}

.feed-item:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.feed-item.selected {
  background: var(--color-surface-raised);
  color: var(--color-accent);
}

.feed-item.unread {
  color: var(--color-text-primary);
}

.feed-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
  object-fit: contain;
}

img.feed-icon {
  background: #fff;
  padding: 1px;
  border-radius: 3px;
}

.feed-icon--placeholder {
  color: var(--color-text-muted);
}

.feed-title {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.feed-unread {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-accent);
  min-width: 20px;
  text-align: right;
}
</style>
