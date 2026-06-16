import { call, setSid } from './client'
import type { LoginResult } from '@/types/api'

export async function login(username: string, password: string): Promise<string> {
  const res = await call<LoginResult>('login', { user: username, password })
  setSid(res.session_id)
  return res.session_id
}

export async function logout(): Promise<void> {
  await call('logout').catch(() => {})
  setSid(null)
}

export async function checkSession(): Promise<boolean> {
  try {
    await call<{ status: boolean }>('isLoggedIn')
    return true
  } catch {
    return false
  }
}
