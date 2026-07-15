import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login as apiLogin, logout as apiLogout, checkSession } from '@/api/auth'
import { getSid, setSid, setNotLoggedInCallback } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const isChecking = ref(true)
  const apiUrl = ref(localStorage.getItem('ttrss-api-url') ?? '')

  setNotLoggedInCallback(() => { isAuthenticated.value = false })

  function setApiUrl(url: string) {
    apiUrl.value = url
    localStorage.setItem('ttrss-api-url', url)
  }

  async function init() {
    isChecking.value = true
    const sid = getSid()
    if (sid) {
      isAuthenticated.value = await checkSession()
      if (!isAuthenticated.value) setSid(null)
    }
    isChecking.value = false
  }

  async function login(username: string, password: string) {
    await apiLogin(username, password)
    isAuthenticated.value = true
  }

  async function logout() {
    await apiLogout()
    isAuthenticated.value = false
  }

  return { isAuthenticated, isChecking, apiUrl, setApiUrl, init, login, logout }
})
