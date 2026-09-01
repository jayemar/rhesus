Use Playwright to verify the functionality of UI changes - not just by running this repo's existing `.spec.ts` test files, but also as a general-purpose interactive tool: write a throwaway Node script that requires `playwright` from this repo's `node_modules` (e.g. `require('/home/jayemar/projects/rhesus/rhesus-ui/node_modules/playwright')`), launch a browser, log in, and click through or inspect the live app directly. This works without any browser extension or other special permission, since Playwright launches its own Chromium process - reach for it any time live browser verification would help, including for TT-RSS's own Preferences pages (plugin settings, etc.), not just the Rhesus frontend.

There is a TT-RSS account set up for this, with credentials given in .env.playwright.

Changes need to be deployed to take effect. Pushing to main triggers
.github/workflows/rhesus-server-image.yml, which builds and pushes
ghcr.io/jayemar/rhesus-server:latest - the homelab repo then just needs
`docker compose pull rhesus-server && docker compose up -d rhesus-server`.

To test locally before pushing, build and run the image yourself:
- npm run build
- docker build -t ghcr.io/jayemar/rhesus-server:latest -f rhesus-server/Dockerfile .
- docker compose up -d rhesus-server (in the homelab repo)

