<template>
  <div class="login-wrap">
    <form class="login-box" @submit.prevent="submit">
      <h1>Rhesus</h1>
      <label>
        API URL
        <input v-model="apiUrl" type="url" placeholder="http://centre:3001/tt-rss/api/" required />
      </label>
      <label>
        Username
        <input v-model="username" type="text" autocomplete="username" required />
      </label>
      <label>
        Password
        <div class="password-wrap">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
          />
          <button type="button" class="pw-toggle" @click="showPassword = !showPassword">
            {{ showPassword ? 'Hide' : 'Show' }}
          </button>
        </div>
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="busy">{{ busy ? 'Signing in...' : 'Sign in' }}</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const port = window.location.port ? `:${window.location.port}` : ''
const apiUrl = ref(`${window.location.protocol}//localhost${port}/tt-rss/api/`)
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  auth.setApiUrl(apiUrl.value)
  try {
    await auth.login(username.value, password.value)
    router.push('/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.login-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--color-bg);
}

.login-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 360px;
  padding: 32px;
  background: var(--color-surface);
  border-radius: var(--card-radius);
  border: 1px solid var(--color-border);
}

h1 {
  font-size: var(--font-size-xl);
  text-align: center;
  margin-bottom: 8px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

input {
  padding: 8px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

input:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: -1px;
}

.password-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.password-wrap input {
  flex: 1;
  padding-right: 52px;
}

.pw-toggle {
  position: absolute;
  right: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  padding: 2px 4px;
  border-radius: 3px;
  transition: color var(--transition-fast);
}

.pw-toggle:hover {
  color: var(--color-text-primary);
}

button[type='submit'] {
  padding: 10px;
  background: var(--color-accent);
  color: #fff;
  border-radius: 4px;
  font-size: var(--font-size-base);
  font-weight: 600;
  transition: background var(--transition-fast);
}

button[type='submit']:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

button[type='submit']:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}
</style>
