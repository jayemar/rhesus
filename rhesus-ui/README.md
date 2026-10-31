# rhesus-ui

The Rhesus single-page app: Vue 3 (Composition API), Vite, TypeScript, Pinia.
See the repo root [`README.md`](../README.md) for architecture and
[`DEPLOYING.md`](../DEPLOYING.md) for deployment.

## Project Setup

```sh
npm install
```

### Dev server

```sh
npm run dev
```

`vite.config.ts` proxies `/tt-rss` to the bare TT-RSS web port
(`http://localhost:8280`), so the API works unchanged against the dev server.

### Type-check and build for production

```sh
npm run build
```

The output in `dist/` is what `rhesus-server/Dockerfile` packages.

### End-to-end tests

```sh
npm run test:e2e
```

Playwright tests log in with the credentials in `.env.playwright`.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).
`vue-tsc` replaces `tsc` for type-checking `.vue` imports.
