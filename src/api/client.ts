import type { ApiResponse, ApiError as ApiErrorShape } from '@/types/api'

const API_URL = '/tt-rss/api/'

let _sid: string | null = null
let _onNotLoggedIn: (() => void) | null = null

export function setNotLoggedInCallback(fn: () => void) {
  _onNotLoggedIn = fn
}

export function setSid(sid: string | null) {
  _sid = sid
  if (sid) {
    localStorage.setItem('ttrss-sid', sid)
  } else {
    localStorage.removeItem('ttrss-sid')
  }
}

export function getSid(): string | null {
  if (!_sid) {
    _sid = localStorage.getItem('ttrss-sid')
  }
  return _sid
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code)
  }
}

export async function call<T>(op: string, params: Record<string, unknown> = {}): Promise<T> {
  const sid = getSid()
  const body: Record<string, unknown> = { op, ...params }
  if (sid) body.sid = sid

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new ApiError('HTTP_ERROR', `HTTP ${res.status}`)
  }

  const json: ApiResponse<T | ApiErrorShape> = await res.json()

  if (json.status !== 0) {
    const err = json.content as ApiErrorShape
    if (err.error === 'NOT_LOGGED_IN') {
      setSid(null)
      _onNotLoggedIn?.()
    }
    throw new ApiError(err.error ?? 'UNKNOWN_ERROR')
  }

  return json.content as T
}
