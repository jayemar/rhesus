export interface ApiResponse<T> {
  seq: number
  status: number
  content: T
}

export interface ApiError {
  error: string
}

export interface LoginResult {
  session_id: string
  api_level: number
}

export interface ApiCategory {
  id: number
  title: string
  unread: number
  items?: ApiCategory[]
  type?: 'category'
}

export interface ApiFeed {
  id: number
  title: string
  unread: number
  has_icon: boolean
  cat_id: number
  feed_url: string
  type?: 'feed'
  last_updated?: number
  last_error?: string
  update_interval?: number
  order_id?: number
}

export interface ApiFeedTreeItem {
  id: string
  name: string
  unread: number
  type: 'feed' | 'category'
  bare_id: number
  items?: ApiFeedTreeItem[]
  icon?: string | false
  viewMode?: string
}

export interface ApiAttachment {
  id: number
  content_url: string
  content_type: string
  title: string
  duration?: string
  width?: number
  height?: number
}

export interface ApiLabel {
  id: number
  caption: string
  fg_color: string
  bg_color: string
  checked: boolean
}


export interface ApiArticle {
  id: number
  title: string
  link: string
  updated: number
  is_updated: boolean
  unread: boolean
  marked: boolean
  published: boolean
  author: string
  feed_id: number
  feed_title: string
  content: string
  excerpt?: string
  attachments?: ApiAttachment[]
  labels?: [number, string, string, string][]
  score?: number
  note?: string
  lang?: string
  comments_count?: number
  comments_link?: string
  always_display_attachments?: boolean
  flavor_image?: string
  flavor_stream?: string
  flavor_kind?: number
}

export interface UiSettings {
  theme: 'dark' | 'light' | 'system'
  sort_order: 'newest' | 'oldest'
  sidebar_collapsed: boolean
  show_thumbnails: boolean
  show_excerpt: boolean
  excerpt_lines: number
  mark_on_scroll: boolean
  swipe_right_action: 'none' | 'toggle_read' | 'toggle_starred'
  swipe_left_action: 'none' | 'toggle_read' | 'toggle_starred'
  long_press_title: 'none' | 'copy_text' | 'copy_link' | 'copy_markdown'
  font_size: number
  font_family: 'system' | 'inter' | 'nunito' | 'merriweather' | 'lora'
  date_sort: 'retrieval' | 'publication'
  load_on_startup: boolean
  poll_interval: number
}

export const DEFAULT_SETTINGS: UiSettings = {
  theme: 'dark',
  sort_order: 'newest',
  sidebar_collapsed: false,
  show_thumbnails: true,
  show_excerpt: true,
  excerpt_lines: 2,
  mark_on_scroll: true,
  swipe_right_action: 'none',
  swipe_left_action: 'none',
  long_press_title: 'copy_markdown',
  font_size: 14,
  font_family: 'system',
  date_sort: 'retrieval',
  load_on_startup: false,
  poll_interval: 0,
}
