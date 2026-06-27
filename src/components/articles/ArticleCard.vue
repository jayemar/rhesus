<template>
  <article
    class="card"
    :class="{ unread: article.unread, highlighted: forceHighlight || article.unread, selected: isSelected }"
    :data-id="article.id"
  >
    <div class="swipe-bg swipe-bg-right" :style="rightBgStyle">
      <component :is="swipeRightIcon" v-if="swipeRightIcon" class="swipe-icon" :size="20" />
    </div>
    <div class="swipe-bg swipe-bg-left" :style="leftBgStyle">
      <component :is="swipeLeftIcon" v-if="swipeLeftIcon" class="swipe-icon" :size="20" />
    </div>

    <div
      class="card-content"
      :style="contentStyle"
      @click="onCardClick"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="resetSwipe"
    >
      <img
        v-if="article.feed_id > 0 && !iconFailed"
        :src="`/tt-rss/public.php?op=feed_icon&id=${article.feed_id}`"
        class="feed-icon"
        alt=""
        @error="iconFailed = true"
      />
      <Rss v-else class="feed-icon" :size="16" aria-label="RSS" />
      <div class="card-body">
        <div class="card-meta">
          <span class="feed-name">{{ article.feed_title }}</span>
        </div>
        <h2 class="card-title">{{ article.title }}</h2>
        <p v-if="showExcerpt && article.excerpt" class="card-excerpt">{{ truncatedExcerpt }}</p>
      </div>
      <div class="card-right">
        <div class="card-right-top">
          <Star v-if="article.marked" class="star-badge" :size="11" aria-label="Starred" />
          <Tag v-if="article.labels && article.labels.length" class="label-badge" :size="11" aria-label="Labelled" />
          <span class="timestamp">{{ articleDate }}</span>
        </div>
        <div v-if="showThumbs && thumbUrl" class="card-thumb">
          <img :src="thumbUrl" alt="" loading="lazy" @error="thumbFailed = true" />
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Star, Check, Rss, Tag } from 'lucide-vue-next'
import type { Component } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useArticlesStore } from '@/stores/articles'
import { writeToClipboard } from '@/utils/clipboard'
import type { ApiArticle } from '@/types/api'

const props = defineProps<{
  article: ApiArticle
  isSelected: boolean
  forceHighlight?: boolean
}>()

const emit = defineEmits<{ select: []; copied: [label: string] }>()

const settingsStore = useSettingsStore()
const articlesStore = useArticlesStore()
const { settings } = storeToRefs(settingsStore)
const showExcerpt = computed(() => settings.value.excerpt_lines > 0)
const showThumbs = computed(() => settings.value.show_thumbnails)
const excerptLines = computed(() => settings.value.excerpt_lines)

// --- Thumbnail ---

const thumbFailed = ref(false)
const iconFailed = ref(false)
const imgTagSrcPattern = /<img[^>]+src=["']([^"']+)["']/i

function toProxyUrl(url: string): string {
  // Strip any origin from TT-RSS internal paths so they load via the local proxy,
  // regardless of whether the server reported its URL as localhost, a Tailscale
  // hostname, or anything else.
  return url.replace(/^https?:\/\/[^/]+(\/tt-rss\/)/, '$1')
}

function firstContentImage(content: string): string | null {
  const match = imgTagSrcPattern.exec(content)
  if (!match || !match[1]) return null
  const decoded = decodeHtmlEntities(match[1])
  if (decoded.startsWith('data:')) return null
  return toProxyUrl(decoded)
}

const thumbUrl = computed(() => {
  if (thumbFailed.value) return null
  if (props.article.flavor_image) return toProxyUrl(props.article.flavor_image)
  const fromAttachment = (props.article.attachments ?? []).find((a) => a.content_type.startsWith('image/'))
  if (fromAttachment) return toProxyUrl(fromAttachment.content_url)
  return firstContentImage(props.article.content ?? '')
})

function decodeHtmlEntities(html: string): string {
  const el = document.createElement('textarea')
  el.innerHTML = html
  return el.value
}

const truncatedExcerpt = computed(() => {
  const text = decodeHtmlEntities(props.article.excerpt ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const max = excerptLines.value * 80
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
})

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

const articleDate = computed(() => {
  const d = new Date(props.article.updated * 1000)
  const now = new Date()
  if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    const tz = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(d).find(p => p.type === 'timeZoneName')?.value ?? ''
    return `${h}:${m} ${tz}`
  }
  const day = String(d.getDate()).padStart(2, '0')
  return `${day} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
})

// --- Swipe ---

const THRESHOLD = 72

const ACTION_COLOR: Record<string, string> = {
  toggle_starred: 'var(--color-starred)',
  toggle_read: 'var(--color-accent)',
  none: 'transparent',
}

const SWIPE_ICONS: Record<string, Component | null> = {
  toggle_starred: Star,
  toggle_read: Check,
  none: null,
}

const swipeRightIcon = computed(() => SWIPE_ICONS[settings.value.swipe_right_action] ?? null)
const swipeLeftIcon = computed(() => SWIPE_ICONS[settings.value.swipe_left_action] ?? null)

const swipeX = ref(0)
const swipeTransition = ref('')

let startX = 0
let startY = 0
let pointerActive = false
let directionLocked = false
let isHorizontal = false
let didSwipe = false
let longPressTimer: ReturnType<typeof setTimeout> | null = null

function cancelLongPress() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

async function executeLongPress() {
  longPressTimer = null
  didSwipe = true
  const action = settings.value.long_press_title
  if (action === 'none') return
  let text = ''
  let label = ''
  if (action === 'copy_text') {
    const div = document.createElement('div')
    div.innerHTML = props.article.content ?? ''
    text = div.textContent ?? ''
    label = 'Text copied'
  } else if (action === 'copy_link') {
    text = props.article.link ?? ''
    label = 'Link copied'
  } else if (action === 'copy_markdown') {
    text = `[${props.article.title}](${props.article.link})`
    label = 'Markdown link copied'
  }
  if (!text) return
  try {
    const needsToast = await writeToClipboard(text)
    if (needsToast) emit('copied', label)
  } catch {
    emit('copied', 'Copy failed')
  }
}

const rightBgStyle = computed(() => {
  const progress = Math.min(1, swipeX.value / THRESHOLD)
  return {
    background: ACTION_COLOR[settings.value.swipe_right_action],
    opacity: progress,
  }
})

const leftBgStyle = computed(() => {
  const progress = Math.min(1, -swipeX.value / THRESHOLD)
  return {
    background: ACTION_COLOR[settings.value.swipe_left_action],
    opacity: progress,
  }
})

const contentStyle = computed(() => {
  const style: Record<string, string> = {
    transform: `translateX(${swipeX.value}px)`,
  }
  if (swipeTransition.value) style.transition = swipeTransition.value
  return style
})

function executeAction(action: string) {
  if (action === 'toggle_read') {
    articlesStore.markRead(props.article.id, props.article.unread)
  } else if (action === 'toggle_starred') {
    articlesStore.toggleStar(props.article.id)
  }
}

function resetSwipe() {
  cancelLongPress()
  pointerActive = false
  directionLocked = false
  isHorizontal = false
  swipeTransition.value = 'transform 0.2s ease-out'
  swipeX.value = 0
  setTimeout(() => { swipeTransition.value = '' }, 200)
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse') return
  startX = e.clientX
  startY = e.clientY
  pointerActive = true
  directionLocked = false
  isHorizontal = false
  didSwipe = false
  swipeTransition.value = ''
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  longPressTimer = setTimeout(executeLongPress, 600)
}

function onPointerMove(e: PointerEvent) {
  if (!pointerActive) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY

  if (!directionLocked) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    isHorizontal = Math.abs(dx) > Math.abs(dy)
    directionLocked = true
    cancelLongPress()
  }

  if (!isHorizontal) return
  e.preventDefault()

  const rightAction = settings.value.swipe_right_action
  const leftAction = settings.value.swipe_left_action
  const max = THRESHOLD * 2

  if (dx > 0 && rightAction === 'none') return
  if (dx < 0 && leftAction === 'none') return

  swipeX.value = Math.max(
    leftAction !== 'none' ? -max : 0,
    Math.min(rightAction !== 'none' ? max : 0, dx),
  )
}

function onPointerUp() {
  cancelLongPress()
  if (!pointerActive) return
  pointerActive = false

  const x = swipeX.value
  const rightAction = settings.value.swipe_right_action
  const leftAction = settings.value.swipe_left_action

  if (x > THRESHOLD && rightAction !== 'none') {
    didSwipe = true
    executeAction(rightAction)
    swipeTransition.value = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
    swipeX.value = 0
    setTimeout(() => { swipeTransition.value = '' }, 450)
  } else if (x < -THRESHOLD && leftAction !== 'none') {
    didSwipe = true
    executeAction(leftAction)
    swipeTransition.value = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
    swipeX.value = 0
    setTimeout(() => { swipeTransition.value = '' }, 450)
  } else {
    resetSwipe()
  }
}

function onCardClick() {
  if (didSwipe) {
    didSwipe = false
    return
  }
  emit('select')
}
</script>

<style scoped>
.card {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
}

.swipe-bg {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
}

.swipe-bg-right {
  justify-content: flex-start;
  padding-left: 20px;
}

.swipe-bg-left {
  justify-content: flex-end;
  padding-right: 20px;
}

.swipe-icon {
  color: #fff;
}

.card-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-bg);
  cursor: pointer;
  position: relative;
  z-index: 1;
  touch-action: pan-y;
}

.card-content:hover {
  background: var(--color-surface-raised);
}

.card.selected {
  border-left: 3px solid var(--color-accent);
}

.card.selected .card-content {
  background: var(--color-surface-raised);
  padding-left: 13px;
}

.feed-icon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  object-fit: contain;
  color: var(--color-text-muted);
}

img.feed-icon {
  background: #fff;
  padding: 1px;
  border-radius: 3px;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.card-right-top {
  display: flex;
  align-items: center;
  gap: 4px;
}

.star-badge {
  color: var(--color-starred);
  flex-shrink: 0;
}

.star-badge :deep(path), .star-badge :deep(polygon) {
  fill: currentColor;
}

.label-badge {
  color: var(--color-starred);
  flex-shrink: 0;
}

.label-badge :deep(path), .label-badge :deep(polygon) {
  fill: currentColor;
}

.timestamp {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.card-title {
  font-size: var(--font-size-base);
  font-weight: 400;
  line-height: var(--line-height-tight);
  margin-bottom: 6px;
  color: var(--color-text-muted);
}

.card.highlighted .card-title {
  font-weight: 600;
  color: var(--color-text-primary);
}

.card.highlighted .card-excerpt {
  color: var(--color-text-primary);
}

.card-excerpt {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-body);
  display: -webkit-box;
  -webkit-line-clamp: v-bind(excerptLines);
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-thumb {
  width: var(--card-thumb-width);
  height: var(--card-thumb-height);
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-surface-raised);
}

.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
