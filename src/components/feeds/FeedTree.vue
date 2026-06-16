<template>
  <nav class="feed-tree">
    <template v-for="item in organizedTree" :key="item.id">
      <template v-if="item.type === 'divider'">
        <div class="section-divider" />
      </template>
      <template v-else-if="item.type === 'cat-group'">
        <button
          class="category-row"
          :class="{ open: openCats.has(item.bare_id) }"
          @click="toggleCat(item.bare_id)"
        >
          <span class="chevron">
            <ChevronDown v-if="openCats.has(item.bare_id)" :size="12" />
            <ChevronRight v-else :size="12" />
          </span>
          <span class="cat-title">{{ item.name }}</span>
          <span v-if="item.unread > 0" class="feed-unread">{{ item.unread }}</span>
        </button>
        <div v-if="openCats.has(item.bare_id)" class="category-feeds">
          <template v-for="cat in item.items" :key="cat.id">
            <button
              class="category-row subcategory-row"
              :class="{ open: openCats.has(cat.bare_id) }"
              @click="toggleCat(cat.bare_id)"
            >
              <span class="chevron">
                <ChevronDown v-if="openCats.has(cat.bare_id)" :size="12" />
                <ChevronRight v-else :size="12" />
              </span>
              <span class="cat-title">{{ cat.name }}</span>
              <span v-if="cat.unread > 0" class="feed-unread">{{ cat.unread }}</span>
            </button>
            <div v-if="openCats.has(cat.bare_id)" class="category-feeds subcategory-feeds">
              <FeedItem
                v-for="feed in cat.items ?? []"
                :key="feed.id"
                :item="feed"
                :selected="isFeedSelected(feed)"
                @select="selectFeed(feed)"
              />
            </div>
          </template>
        </div>
      </template>
      <template v-else-if="item.type === 'category'">
        <button
          class="category-row"
          :class="{ open: openCats.has(item.bare_id) }"
          @click="toggleCat(item.bare_id)"
        >
          <span class="chevron">
            <ChevronDown v-if="openCats.has(item.bare_id)" :size="12" />
            <ChevronRight v-else :size="12" />
          </span>
          <span class="cat-title">{{ item.name }}</span>
          <span v-if="item.unread > 0" class="feed-unread">{{ item.unread }}</span>
        </button>
        <div v-if="openCats.has(item.bare_id)" class="category-feeds">
          <FeedItem
            v-for="feed in item.items ?? []"
            :key="feed.id"
            :item="feed"
            :selected="isFeedSelected(feed)"
            @select="selectFeed(feed)"
          />
        </div>
      </template>
      <template v-else>
        <FeedItem
          :item="item"
          :selected="isFeedSelected(item)"
          @select="selectFeed(item)"
        />
      </template>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { useFeedsStore } from '@/stores/feeds'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import FeedItem from './FeedItem.vue'
import type { ApiFeedTreeItem } from '@/types/api'

type SentinelItem =
  | { type: 'divider'; id: string; bare_id: number }
  | { type: 'cat-group'; id: string; name: string; bare_id: number; unread: number; items: ApiFeedTreeItem[] }
type TreeRow = ApiFeedTreeItem | SentinelItem

const router = useRouter()
const route = useRoute()
const feedsStore = useFeedsStore()
const { tree } = storeToRefs(feedsStore)

const openCats = ref<Set<number>>(new Set())

function insertAfter(
  items: ApiFeedTreeItem[],
  afterId: number,
  newItem: ApiFeedTreeItem,
): ApiFeedTreeItem[] {
  const result: ApiFeedTreeItem[] = []
  for (const item of items) {
    if (item.type === 'category' && item.items) {
      result.push({ ...item, items: insertAfter(item.items, afterId, newItem) })
    } else {
      result.push(item)
      if (item.bare_id === afterId) result.push(newItem)
    }
  }
  return result
}

const treeWithUnread = computed(() => {
  const virtual: ApiFeedTreeItem = {
    id: 'virtual-unread',
    name: 'Unread articles',
    unread: 0,
    type: 'feed',
    bare_id: -4,
    icon: false,
    viewMode: 'unread',
  }
  return insertAfter(tree.value, -4, virtual)
})

const organizedTree = computed((): TreeRow[] => {
  const result: TreeRow[] = []
  const userCats: ApiFeedTreeItem[] = []

  for (const item of treeWithUnread.value) {
    if (item.type === 'category' && item.bare_id === -1) {
      result.push({ ...item, name: 'Lists' })
    } else if (item.type === 'category' && item.bare_id === -2) {
      result.push({ type: 'divider', id: 'divider-labels', bare_id: -998 })
      result.push(item)
    } else if (item.type === 'category' && item.bare_id >= 0) {
      userCats.push(item)
    } else {
      result.push(item)
    }
  }

  if (userCats.length > 0) {
    const totalUnread = userCats.reduce((sum, c) => sum + (c.unread ?? 0), 0)
    result.push({ type: 'divider', id: 'divider-cats', bare_id: -997 })
    result.push({
      type: 'cat-group',
      id: 'cat-group-categories',
      name: 'Categories',
      bare_id: -996,
      unread: totalUnread,
      items: userCats,
    })
  }

  return result
})

function isFeedSelected(feed: ApiFeedTreeItem): boolean {
  if (feed.type === 'category') {
    return route.name === 'category' && String(feed.bare_id) === route.params.id
  }
  if (route.name !== 'feed' || String(feed.bare_id) !== route.params.id) return false
  const routeViewMode = (route.query.viewMode as string) || 'all_articles'
  return (feed.viewMode ?? 'all_articles') === routeViewMode
}

onMounted(async () => {
  await feedsStore.loadTree()
  const firstUnread = tree.value.find((i) => i.type === 'category' && i.unread > 0)
  if (firstUnread) openCats.value.add(firstUnread.bare_id)
  else if (tree.value.length > 0) openCats.value.add(tree.value[0]!.bare_id)
})

function toggleCat(id: number) {
  if (openCats.value.has(id)) openCats.value.delete(id)
  else openCats.value.add(id)
}

function selectFeed(item: ApiFeedTreeItem) {
  const query = item.viewMode ? { viewMode: item.viewMode } : {}
  if (item.type === 'category') {
    router.replace({ name: 'category', params: { id: String(item.bare_id) } })
  } else {
    router.replace({ name: 'feed', params: { id: String(item.bare_id) }, query })
  }
}
</script>

<style scoped>
.feed-tree {
  overflow-y: auto;
  height: 100%;
  padding: 8px 0;
}

.section-divider {
  height: 1px;
  background: var(--color-border);
  margin: 6px 0;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 12px;
  text-align: left;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: background var(--transition-fast);
}

.category-row:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.subcategory-row {
  padding-left: 24px;
}

.subcategory-feeds {
  padding-left: 12px;
}

.chevron {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cat-title {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.feed-unread {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-accent);
}
</style>
