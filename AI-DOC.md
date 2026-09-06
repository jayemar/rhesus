# AI notes for the rhesus repo

Notes for AI assistants working across this repo's several pieces:

- `rhesus-ui/` - the Vue frontend (this is where most work happens; see below)
- `rhesus-server/` - Dockerfile/nginx.conf that builds `rhesus-ui` and serves it,
  proxying `/tt-rss/` through to native TT-RSS so the session cookie is shared
- `rhesus-share/` - a Firefox browser extension for sharing pages into TT-RSS
  from the phone's share menu; see `rhesus-share/RHESUS-SHARE-BUILD-AND-DEPLOY.md`
- `rhesus_settings/` - TT-RSS plugin storing per-user UI settings for Rhesus
- `feed_subscription_log/` - TT-RSS plugin logging feed subscribe/unsubscribe events

## rhesus-ui: verifying changes

The user wants to see a change running on the actual deployed instance
(`https://centre.<tailnet>.ts.net:13001/`, container `ttrss-rhesus-server-1`)
before deciding whether to commit it - not commit first and check later, and
not check it on a separate long-running dev server instance either. Build and
deploy locally to let them look at it live, and only commit once they confirm
it's what they want:

```
cd rhesus-ui && npm run build
docker build -t ghcr.io/jayemar/rhesus-server:latest -f rhesus-server/Dockerfile /home/jayemar/projects/rhesus
docker compose up -d rhesus-server   # in /home/jayemar/projects/homelab/ttrss
```

This rebuilds from whatever is currently on disk, uncommitted changes
included, and briefly recreates the running container (a few seconds of
downtime for anyone using Rhesus at that moment). Do this whenever you want
the user to check a change, not just before a final deploy.

(A previous session instead ran a standalone `vite --port 3002 --host 0.0.0.0`
dev server with a Tailscale Serve mapping at `13002`, so changes appeared
without a rebuild. The user asked to go back to the build-and-deploy flow
above - don't reintroduce the standalone dev server unless asked.)

Once CI/`npm run build` has produced a new image and it's pushed to main,
`.github/workflows/rhesus-server-image.yml` publishes
`ghcr.io/jayemar/rhesus-server:latest` too - the homelab repo then just needs
`docker compose pull rhesus-server && docker compose up -d rhesus-server`.
That's the path for a change that's already been committed; the local build
above is for checking a change *before* committing it.

Use Playwright to verify the functionality of UI changes - not just by
running this repo's existing `.spec.ts` test files, but also as a
general-purpose interactive tool: write a throwaway Node script that requires
`playwright` from this repo's `node_modules` (e.g.
`require('/home/jayemar/projects/rhesus/rhesus-ui/node_modules/playwright')`),
launch a browser, log in, and click through or inspect the live app directly.
This works without any browser extension or other special permission, since
Playwright launches its own browser process - reach for it any time live
browser verification would help, including for TT-RSS's own Preferences
pages (plugin settings, etc.), not just the Rhesus frontend. It can launch
Firefox as well as Chromium (`require('playwright').firefox`) - worth doing
when a behavior might be browser-specific, since the user's own daily driver
is Firefox.

There is a TT-RSS account set up for this, with credentials given in
`rhesus-ui/.env.playwright`.
