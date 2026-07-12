<template>
  <div class="settings-panel">
    <div class="settings-inner">
    <h2>Settings</h2>
    <div>
      <section>
        <h3>Display</h3>
        <label class="toggle-row">
          <span>Show thumbnails</span>
          <input type="checkbox" v-model="s.show_thumbnails" />
        </label>
        <label class="select-row">
          <span>Excerpt lines</span>
          <select v-model.number="s.excerpt_lines">
            <option :value="0">Off</option>
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="3">3</option>
          </select>
        </label>
        <label class="select-row">
          <span>Theme</span>
          <select v-model="s.theme">
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <div class="select-row">
          <span>Font size (px)</span>
          <div class="stepper">
            <button type="button" :disabled="s.font_size <= 8" @click="s.font_size = Math.max(8, s.font_size - 1)">-</button>
            <span class="stepper-value">{{ s.font_size }}</span>
            <button type="button" :disabled="s.font_size >= 32" @click="s.font_size = Math.min(32, s.font_size + 1)">+</button>
          </div>
        </div>
        <label class="select-row">
          <span>Font</span>
          <select v-model="s.font_family">
            <option value="system">System UI</option>
            <option value="inter">Inter</option>
            <option value="nunito">Nunito</option>
            <option value="merriweather">Merriweather</option>
            <option value="lora">Lora</option>
          </select>
        </label>
        <label class="select-row">
          <span>Sort articles by</span>
          <select v-model="s.date_sort">
            <option value="retrieval">Retrieval date</option>
            <option value="publication">Publication date</option>
          </select>
        </label>
      </section>
      <section>
        <h3>Behaviour</h3>
        <label class="toggle-row">
          <span>Load unread articles on startup</span>
          <input type="checkbox" v-model="s.load_on_startup" />
        </label>
        <label class="select-row">
          <span>Check for new articles</span>
          <select v-model.number="s.poll_interval">
            <option :value="0">Manual refresh only</option>
            <option :value="15">Every 15 minutes</option>
            <option :value="30">Every 30 minutes</option>
            <option :value="60">Every hour</option>
            <option :value="120">Every 2 hours</option>
          </select>
        </label>
        <label class="toggle-row">
          <span>Mark as read on scroll</span>
          <input type="checkbox" v-model="s.mark_on_scroll" />
        </label>
        <label class="select-row">
          <span>Swipe right</span>
          <select v-model="s.swipe_right_action">
            <option value="none">None</option>
            <option value="toggle_read">Toggle read</option>
            <option value="toggle_starred">Toggle starred</option>
          </select>
        </label>
        <label class="select-row">
          <span>Swipe left</span>
          <select v-model="s.swipe_left_action">
            <option value="none">None</option>
            <option value="toggle_read">Toggle read</option>
            <option value="toggle_starred">Toggle starred</option>
          </select>
        </label>
        <label class="select-row">
          <span>Long press title</span>
          <select v-model="s.long_press_title">
            <option value="none">None</option>
            <option value="copy_text">Copy article text</option>
            <option value="copy_link">Copy link</option>
            <option value="copy_markdown">Copy as markdown link</option>
          </select>
        </label>
        <label class="select-row">
          <span>Search engine (for author search)</span>
          <select v-model="s.search_engine">
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="google">Google</option>
            <option value="bing">Bing</option>
          </select>
        </label>
      </section>
    </div>

    <section class="links-section">
      <h3>TT-RSS</h3>
      <div class="select-row account-row">
        <span>Logged in as</span>
        <span class="account-name">{{ username || '...' }}</span>
      </div>
      <a :href="ttrssUrl" target="_blank" rel="noopener noreferrer" class="ttrss-link">
        Open TT-RSS settings <ExternalLink :size="13" class="ttrss-link-icon" />
      </a>
    </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ExternalLink } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { getSid } from '@/api/client'

const settingsStore = useSettingsStore()
const { settings: s, username } = storeToRefs(settingsStore)

const ttrssUrl = computed(() => {
  const sid = getSid()
  return sid
    ? `/tt-rss/plugins.local/rhesus_settings/redirect.php?sid=${sid}`
    : '/tt-rss/prefs.php'
})
</script>

<style scoped>
.settings-panel {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-bg);
}

.settings-inner {
  padding: 24px;
}

h2 {
  font-size: var(--font-size-xl);
  margin-bottom: 24px;
}

section {
  margin-bottom: 24px;
}

h3 {
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

.toggle-row,
.select-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-base);
  gap: 16px;
}

.toggle-row:last-child,
.select-row:last-child {
  border-bottom: none;
}

select,
input[type='number'] {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.stepper button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-size: 16px;
  line-height: 1;
  border: none;
  transition: background var(--transition-fast);
}

.stepper button:hover:not(:disabled) {
  background: var(--color-surface-raised);
}

.stepper button:disabled {
  opacity: 0.35;
  cursor: default;
}

.stepper-value {
  min-width: 32px;
  text-align: center;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background: var(--color-bg);
  padding: 0 4px;
  user-select: none;
}

.links-section {
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
}

.ttrss-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  color: var(--color-accent);
  font-size: var(--font-size-base);
  text-decoration: none;
}

.ttrss-link:hover {
  text-decoration: underline;
}

.account-row {
  cursor: default;
}

.account-name {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}


</style>
