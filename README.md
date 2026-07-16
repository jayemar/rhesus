# Rhesus Architecture

Rhesus is a mobile-first RSS reading SPA that replaces the TT-RSS web UI for
day-to-day reading. It speaks directly to the native TT-RSS JSON API and is
deployed as an additional Docker container alongside the standard TT-RSS stack.

**Deploying Rhesus against your own TT-RSS instance?** See
[`DEPLOYING.md`](DEPLOYING.md) for the setup steps. The rest of this document
is architecture, not a how-to.

**Repo layout:** this repo (`rhesus-ui/`, `rhesus_settings/`, `rhesus-server/`,
`rhesus-share/`) is checked out separately from the homelab repo that runs the
actual TT-RSS/Docker stack (default path `/home/jayemar/projects/rhesus`).
The homelab repo's `plugins.conf` references this checkout's `rhesus_settings/`
directory by absolute path so `manage-plugins.sh` can deploy it; it doesn't
vendor any Rhesus source itself. `rhesus-server` is decoupled entirely - see
below - the homelab repo just pulls its published image, no local checkout
needed for that piece.

---

## System Overview

```
Browser
  |
  | HTTP (port 3001)
  v
[rhesus-server container]  nginx
  |  /tt-rss/api/  -->  [web-nginx]  -->  [app (PHP-FPM)]  -->  [db (PostgreSQL)]
  |  /tt-rss/public.php  -->  [web-nginx]  -->  [app]
  |  /  -->  static SPA (index.html + JS/CSS bundle)
```

The rhesus-server container serves the pre-built SPA bundle and
reverse-proxies two TT-RSS paths:

- `/tt-rss/api/` -- the native JSON API used for all data operations
- `/tt-rss/public.php` -- cached image delivery (via the `nginx_xaccel` plugin)

All other paths serve `index.html` (Vue Router history-mode SPA routing).

---

## Components

### 1. Rhesus SPA (`rhesus-ui/`)

**Stack:** Vue 3 (Composition API), Vite, TypeScript, Pinia

```
rhesus-ui/src/
  api/
    client.ts         -- fetch wrapper; attaches session ID from localStorage
    articles.ts       -- getHeadlines, getArticle, updateArticle, catchupFeed
    feeds.ts          -- getFeedTree, getCounters
    auth.ts           -- login, logout
    settings.ts       -- getUiSettings, setUiSettings (custom API methods)
  stores/
    auth.ts           -- session ID, login state
    feeds.ts          -- feed tree, selected feed
    articles.ts       -- loaded articles, selected article, mark-read logic
    settings.ts       -- user preferences; debounced auto-save; font/theme application
  components/
    LoginPage.vue
    layout/
      AppShell.vue    -- sidebar + article list + reader pane; keyboard nav
      Sidebar.vue     -- feed tree with unread counts
    articles/
      ArticleList.vue -- virtualised scroll; IntersectionObserver for mark-on-scroll
      ArticleCard.vue -- thumbnail, badges, swipe gestures
      ArticleReader.vue
    SettingsPanel.vue
  router/index.ts     -- /login, /, /article/:id, /settings
  styles/
    variables.css     -- CSS custom properties (colours, spacing, typography)
    global.css
  types/api.ts        -- TypeScript interfaces matching TT-RSS JSON API shapes
```

**Key design choices:**

- The API client always posts to `/tt-rss/api/` (relative), so no CORS issues and
  the URL never needs to change after login.
- Settings are loaded once on startup and deep-watched with a 500 ms debounce to
  auto-save without spamming the server.
- `flavor_image` -- TT-RSS computes a best-effort thumbnail URL per article
  (`Article::_get_image()`) and returns it in `getHeadlines` when
  `show_content=true`. Rhesus uses this as the primary thumbnail source rather than
  re-implementing image extraction in the browser.
- Image URLs that include the TT-RSS server origin (e.g.
  `http://centre/tt-rss/public.php?op=cached&...`) are rewritten to a relative
  `/tt-rss/public.php?...` path so they always load via the local proxy regardless
  of what hostname TT-RSS used when generating the URL.
- Swipe gestures use the Pointer Events API with direction-lock (first 6 px
  determines horizontal vs. vertical) so vertical page scroll is not disrupted.

---

### 2. `rhesus_settings` TT-RSS Plugin (`rhesus_settings/init.php`)

A system plugin that extends TT-RSS in two ways:

**Custom API methods** (`getUiSettings` / `setUiSettings`)

Stores and retrieves a JSON settings blob per user in `ttrss_plugin_storage`.
This gives Rhesus persistent, server-side preferences that roam across devices.
New keys added to `default_settings()` are merged in on every read so that old
stored blobs gain new defaults automatically.

```
Settings stored:
  theme, sort_order, sidebar_collapsed, show_thumbnails, show_excerpt,
  excerpt_lines, mark_on_scroll, swipe_right_action, swipe_left_action,
  font_size, font_family
```

**Custom sort hook** (`HOOK_HEADLINES_CUSTOM_SORT_OVERRIDE`)

Starred articles (feed -1) are requested with `order_by=last_marked_asc`.
The hook intercepts this key and returns the SQL clause
`"last_marked, date_entered, updated"` (no direction keyword -- PostgreSQL
defaults to ASC, and TT-RSS's DISTINCT ON logic strips "desc" but not "asc",
which would produce invalid SQL).

**Deployment:** the plugin lives in `rhesus_settings/` in this repo and is
deployed into the homelab stack's `app`, `updater`, and `web-nginx` containers
via that repo's `manage-plugins.sh` (a tar-copy install, not a live
bind-mount - edits here need a `./manage-plugins.sh --update` run in the
homelab repo to take effect). It's enabled via the `TTRSS_PLUGINS`
environment variable in the homelab repo's `docker-compose.yaml`, and this
plugin's path is listed in that repo's `plugins.conf` so `manage-plugins.sh`
can find it.

---

### 3. rhesus-server Container (`rhesus-server/`)

```
rhesus-server/
  Dockerfile     -- nginx:alpine serving a pre-built SPA bundle
  nginx.conf     -- SPA fallback routing + two proxy_pass rules
```

**Build/publish:** unlike `rhesus_settings`, this isn't built or deployed by
the homelab repo at all. `.github/workflows/rhesus-server-image.yml` builds
the SPA (`npm run build` inside `rhesus-ui/`) and the Docker image on every
push to `main` that touches `rhesus-ui/` or `rhesus-server/`, then pushes it
to `ghcr.io/jayemar/rhesus-server:latest`. The homelab repo's
`docker-compose.yaml` just references that image directly
(`image: ghcr.io/jayemar/rhesus-server:latest`) - no `build:` section, no
local checkout of this repo required for that service. A plain
`docker compose pull rhesus-server && docker compose up -d rhesus-server` in
the homelab repo picks up a new build.

**nginx proxy rules:**

```nginx
location /tt-rss/api/      { proxy_pass http://web-nginx/tt-rss/api/; }
location /tt-rss/public.php { proxy_pass http://web-nginx/tt-rss/public.php; }
location /                 { try_files $uri $uri/ /index.html; }
```

`web-nginx` is the Docker service name of the standard TT-RSS nginx container,
resolvable within the Compose network.

---

## Data Flow: Loading an Article List

```
1. Browser  -->  GET /  (SPA bootstrap)
2. Pinia auth store reads session ID from localStorage
3. If no session: redirect to /login
4. feeds store: POST /tt-rss/api/ { op: getFeedTree }
5. User selects a feed
6. articles store: POST /tt-rss/api/ {
     op: getHeadlines,
     feed_id: N,
     show_content: true,
     include_attachments: true,
     show_excerpt: true,
     excerpt_length: 250,
     limit: 200,
     sanitize: false
   }
7. TT-RSS: HOOK_RENDER_ARTICLE_API fires (af_filter_enclosures, af_enhance_content)
8. TT-RSS: DiskCache::rewrite_urls() rewrites cached image src URLs
9. Response includes flavor_image (pre-computed best thumbnail URL)
10. ArticleCard renders thumbnail via toProxyUrl(flavor_image)
    --> /tt-rss/public.php?op=cached&file=images/<sha1>
    --> proxied to web-nginx --> nginx_xaccel --> served from image cache
```

## Data Flow: Starred Article Sort

```
1. User selects Starred (feed -1)
2. articles store requests order_by: "last_marked_asc"
3. TT-RSS API calls HOOK_HEADLINES_CUSTOM_SORT_OVERRIDE("last_marked_asc")
4. rhesus_settings plugin returns ["last_marked, date_entered, updated", false]
5. TT-RSS builds ORDER BY / DISTINCT ON using this clause
6. Articles returned oldest-starred-first
```

---

## Docker Compose Services

| Service | Image | Role |
|---------|-------|------|
| `db` | postgres:15-alpine | PostgreSQL database |
| `app` | cthulhoo/ttrss-fpm-pgsql-static | PHP-FPM; serves API and processes plugins |
| `updater` | cthulhoo/ttrss-fpm-pgsql-static | Background feed fetcher |
| `web-nginx` | cthulhoo/ttrss-web-nginx | nginx + FastCGI bridge for TT-RSS |
| `rhesus-server` | ghcr.io/jayemar/rhesus-server | nginx serving Rhesus SPA; port 3001 |

Port 3001 is the only port exposed to the host for day-to-day use. Port 8280
(`HTTP_PORT`) exposes the bare TT-RSS web UI and is used for admin tasks.

---

## Settings Persistence

Settings flow:

```
SettingsPanel (reactive v-model) --> Pinia settings store (deep watch, 500ms debounce)
  --> POST /tt-rss/api/ { op: setUiSettings, settings: {...} }
  --> rhesus_settings plugin --> ttrss_plugin_storage (PostgreSQL)

On startup:
  POST /tt-rss/api/ { op: getUiSettings }
  --> merged with default_settings() in PHP (new keys get defaults)
  --> loaded into Pinia store
  --> applyTheme() + applyFont() run immediately
```

---

## Thumbnail Resolution Order

For each article, `ArticleCard.vue` resolves a thumbnail URL as follows:

1. `article.flavor_image` -- TT-RSS-computed best image (cached URL if cached,
   original URL otherwise); covers inline images, enclosures, and YouTube embeds
2. First image attachment in `article.attachments`
3. First `<img src>` found in `article.content` (regex fallback)

All resolved URLs pass through `toProxyUrl()` which strips any
`https?://hostname/tt-rss/` origin prefix, converting TT-RSS server URLs to
relative `/tt-rss/` paths served via the rhesus-server nginx proxy.

---

## Key Plugins in the TT-RSS Stack

| Plugin | Role |
|--------|------|
| `rhesus_settings` | Custom API methods + starred sort hook |
| `af_enhance_content` | OG metadata extraction, srcset resolution, lazy-load fix, markup repair, content backfill |
| `af_filter_enclosures` | Respects `always_display_enclosures` in API responses |
| `af_feed_advisor` | Recommends per-feed enclosure display settings |
| `nginx_xaccel` | Efficient cached image delivery via X-Accel-Redirect |
