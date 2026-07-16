# Deploying Rhesus

This walks through adding Rhesus to an existing TT-RSS instance running via
Docker Compose. It assumes the standard TT-RSS Docker setup: `app` (PHP-FPM),
`updater`, `web-nginx`, and `db` services, with `app`/`updater` sharing a
named volume mounted at `/var/www/html` (see
[TT-RSS's own Docker install docs](https://tt-rss.org/wiki/InstallationNotes)
if you don't have this yet).

None of this requires forking or vendoring this repo into your TT-RSS
project - just a local checkout and two small `docker-compose.yaml`
additions.

## 1. Clone this repo

```bash
git clone https://github.com/jayemar/rhesus.git /path/to/rhesus
```

Anywhere on the host is fine. The rest of this guide calls that path
`$RHESUS_PATH`.

## 2. Deploy the `rhesus_settings` plugin

Rhesus depends on `rhesus_settings` - it's not optional. Roughly half of
Rhesus's API calls (settings persistence, saved filters, feed notes, OPML
import, starred/label totals, full-content fetch) only exist because this
plugin registers them; without it, those features fail outright rather than
degrading gracefully.

**Get the files into `plugins.local/`.** Any of these works:

- Bind-mount it directly in `docker-compose.yaml` (simplest, live-editable):
  ```yaml
  services:
    app:
      volumes:
        - $RHESUS_PATH/rhesus_settings:/var/www/html/tt-rss/plugins.local/rhesus_settings
    updater:
      volumes:
        - $RHESUS_PATH/rhesus_settings:/var/www/html/tt-rss/plugins.local/rhesus_settings
    web-nginx:
      volumes:
        - $RHESUS_PATH/rhesus_settings:/var/www/html/tt-rss/plugins.local/rhesus_settings:ro
  ```
  (`web-nginx` needs it too - `rhesus_settings` has a couple of endpoints,
  like feed icon uploads, that it serves directly rather than through
  PHP-FPM.)
- Or copy the directory into the `app`/`updater` containers' shared volume
  by whatever mechanism you already use to manage local plugins (a
  deploy script, `docker cp`, etc.) - nothing about `rhesus_settings` is
  special here, it's a plain TT-RSS system plugin like any other.

**Enable it.** Add `rhesus_settings` to `TTRSS_PLUGINS` for both `app` and
`updater`:

```yaml
services:
  app:
    environment:
      - TTRSS_PLUGINS=auth_internal,note,nginx_xaccel,rhesus_settings
  updater:
    environment:
      - TTRSS_PLUGINS=auth_internal,note,nginx_xaccel,rhesus_settings
```

(Keep any other plugins you already have enabled - just add
`rhesus_settings` to the list.)

**Recreate, don't restart:**

```bash
docker compose up -d app updater
```

`TTRSS_PLUGINS` is only read from the container's environment at *creation*
time - `docker compose restart` reuses the existing container and silently
ignores this change. `up -d` is what actually re-reads the compose file.

## 3. Add the `rhesus-server` service

This serves the Rhesus SPA and reverse-proxies TT-RSS, so the browser only
ever talks to one origin. The image is public and pre-built by this repo's
own CI - nothing to build locally:

```yaml
services:
  rhesus-server:
    image: ghcr.io/jayemar/rhesus-server:latest
    restart: unless-stopped
    ports:
      - "3001:80"   # pick any host port you like
    depends_on:
      - web-nginx
```

Then:

```bash
docker compose pull rhesus-server
docker compose up -d rhesus-server
```

## 4. Enable browser API access (easy to miss)

TT-RSS has two separate, independent per-user preferences gating API
access, and only one of them is well-known:

- **"Enable API"** - the documented one.
- **"Enable browser-based API access"** - a second toggle, directly below
  the first in Preferences -> Preferences -> General, defaulting to **off**
  for every account. If it's off, logging in through Rhesus will succeed,
  but every subsequent call fails with `API_DISABLED` - with nothing in the
  response pointing at the actual cause. `curl` and other non-browser
  clients never hit this check at all, which is exactly why it's easy to
  miss during testing.

Log into the native TT-RSS web UI once, go to Preferences -> Preferences ->
General, and check **both** boxes before trying Rhesus. TT-RSS's own
[API Reference wiki page](https://github.com/tt-rss/tt-rss/wiki/Api-Reference)
doesn't mention the second toggle at all - if you hit `API_DISABLED` after a
successful login, this is almost certainly why.

## 5. Log in

Open `http://<host>:<port>/` (port 3001 in the example above) and log in
with your TT-RSS credentials.

## Updating

- **`rhesus-server`**: `docker compose pull rhesus-server && docker compose
  up -d rhesus-server` picks up whatever this repo's CI has most recently
  published to `ghcr.io/jayemar/rhesus-server:latest`.
- **`rhesus_settings`**: `git pull` this repo, then redeploy the directory
  via whichever method you chose in step 2.

## Optional: the `rhesus-share` browser extension

A Firefox extension for saving arbitrary pages to TT-RSS from the browser
toolbar (works like Pocket/Instapaper), independent of everything above -
it only needs your TT-RSS URL and credentials, no server-side deployment.
See `rhesus-share/RHESUS-SHARE-BUILD-AND-DEPLOY.md`.
