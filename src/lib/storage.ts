import { DEFAULT_PROFILE } from './matcher'
import type { Profile, SavedEntry } from './types'

const KEYS = {
  profile: 'grantradar.profile.v1',
  saved: 'grantradar.saved.v1',
  settings: 'grantradar.settings.v1',
  authHint: 'grantradar.auth-hint.v1',
} as const

export interface AppSettings {
  adsEnabled: boolean
  lastRoute?: string
  hideOnboarding?: boolean
}

const DEFAULT_SETTINGS: AppSettings = { adsEnabled: true }

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as object) } as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장 실패(용량/프라이빗 모드)는 무시 — 앱은 계속 동작 */
  }
}

export function loadProfile(): Profile {
  const stored = read<Profile>(KEYS.profile, DEFAULT_PROFILE)
  return {
    ...DEFAULT_PROFILE,
    ...stored,
    jobs: Array.isArray(stored.jobs) ? stored.jobs : [],
    households: Array.isArray(stored.households) ? stored.households : [],
    domains: Array.isArray(stored.domains) ? stored.domains : [],
  }
}

export function saveProfile(profile: Profile): void {
  write(KEYS.profile, { ...profile, updatedAt: new Date().toISOString() })
}

export function loadSaved(): SavedEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEYS.saved)
    const parsed = raw ? (JSON.parse(raw) as SavedEntry[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function persistSaved(entries: SavedEntry[]): void {
  write(KEYS.saved, entries)
}

export function toggleSavedPolicy(entries: SavedEntry[], id: string): SavedEntry[] {
  const exists = entries.find((e) => e.id === id)
  if (exists) return entries.filter((e) => e.id !== id)
  return [{ id, savedAt: new Date().toISOString(), checklist: {} }, ...entries]
}

export function setChecklist(entries: SavedEntry[], id: string, checklist: Record<string, boolean>): SavedEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, checklist } : e))
}

export function setMemo(entries: SavedEntry[], id: string, memo: string): SavedEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, memo } : e))
}

export function loadSettings(): AppSettings {
  return read<AppSettings>(KEYS.settings, DEFAULT_SETTINGS)
}

export function saveSettings(settings: AppSettings): void {
  write(KEYS.settings, settings)
}

export function readAuthHint(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(KEYS.authHint) ?? ''
}

export function writeAuthHint(email: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEYS.authHint, email)
}

export function exportLocalData(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile: loadProfile(),
      saved: loadSaved(),
    },
    null,
    2,
  )
}

export function clearLocalData(): void {
  if (typeof window === 'undefined') return
  Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key))
}
