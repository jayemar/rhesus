import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify((() => {
      const d = new Date()
      const date = d.toISOString().slice(0, 10)
      const time = d.toISOString().slice(11, 16)
      return `${date} ${time} UTC`
    })()),
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/tt-rss': {
        target: 'http://localhost:8280',
        changeOrigin: true,
      },
    },
  },
})
