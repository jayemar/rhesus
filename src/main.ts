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

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
