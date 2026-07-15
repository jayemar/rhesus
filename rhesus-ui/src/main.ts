import './styles/variables.css'
import './styles/base.css'
import '@fontsource/inter'
import '@fontsource/nunito'
import '@fontsource/merriweather'
import '@fontsource/lora'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// Track current input type so hover styles don't stick after touch taps on
// hybrid devices (touchscreen laptops, iPad + keyboard, etc.).
;(function trackInputType() {
  const el = document.documentElement
  el.dataset.input = 'mouse'
  document.addEventListener('touchstart', () => { el.dataset.input = 'touch' }, { passive: true })
  document.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') el.dataset.input = 'mouse' })
})()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
