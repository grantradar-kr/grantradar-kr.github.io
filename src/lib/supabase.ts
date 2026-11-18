import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Profile, SavedEntry } from './types'

/**
 * Supabase는 "있으면 쓰고, 없으면 로컬" 구조다.
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 없으면 앱은 게스트(로컬) 모드로 100% 동작한다.
 */
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

export type CloudState = 'disabled' | 'guest' | 'signed-in' | 'error'

export interface CloudStatus {
  state: CloudState
  email?: string
  userId?: string
  message?: string
}

export async function currentCloudStatus(): Promise<CloudStatus> {
  const supabase = getSupabase()
  if (!supabase) return { state: 'disabled', message: '클라우드 미설정 · 기기 저장 모드' }
  try {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) return { state: 'guest' }
    return { state: 'signed-in', email: user.email ?? undefined, userId: user.id }
  } catch (error) {
    return { state: 'error', message: (error as Error).message }
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<{ ok: boolean; message: string }> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, message: '클라우드가 설정되지 않았습니다. 기기 저장 모드로 계속 이용할 수 있어요.' }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { ok: false, message: translateAuthError(error.message) }
  if (!data.session) return { ok: true, message: '가입 확인 메일을 보냈어요. 메일 인증 후 로그인해 주세요.' }
  return { ok: true, message: '가입 완료! 이제 기기를 바꿔도 내 조건과 저장 목록이 유지돼요.' }
}

export async function signInWithEmail(email: string, password: string): Promise<{ ok: boolean; message: string }> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, message: '클라우드가 설정되지 않았습니다. 기기 저장 모드로 계속 이용할 수 있어요.' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, message: translateAuthError(error.message) }
  return { ok: true, message: '로그인했습니다.' }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function fetchCloudProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_profiles')
    .select('gender, birth_year, region, jobs, households, domains, income, onboarding_done, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    gender: (data.gender as Profile['gender']) ?? 'all',
    birthYear: (data.birth_year as number | null) ?? null,
    region: (data.region as string) ?? '전국',
    jobs: (data.jobs as Profile['jobs']) ?? [],
    households: (data.households as Profile['households']) ?? [],
    domains: (data.domains as Profile['domains']) ?? [],
    income: (data.income as Profile['income']) ?? 'unknown',
    done: Boolean(data.onboarding_done),
    updatedAt: data.updated_at as string | undefined,
  }
}

export async function upsertCloudProfile(userId: string, profile: Profile): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  const { error } = await supabase.from('user_profiles').upsert(
    {
      user_id: userId,
      gender: profile.gender,
      birth_year: profile.birthYear,
      region: profile.region,
      jobs: profile.jobs,
      households: profile.households,
      domains: profile.domains,
      income: profile.income,
      onboarding_done: profile.done,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  return !error
}

export async function fetchCloudSaved(userId: string): Promise<SavedEntry[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('saved_policies')
    .select('policy_id, checklist, memo, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => ({
    id: row.policy_id as string,
    savedAt: row.created_at as string,
    checklist: (row.checklist as Record<string, boolean>) ?? {},
    memo: (row.memo as string) ?? undefined,
  }))
}

export async function pushCloudSaved(userId: string, entries: SavedEntry[]): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  const { error: delError } = await supabase.from('saved_policies').delete().eq('user_id', userId)
  if (delError) return false
  if (!entries.length) return true
  const rows = entries.map((entry) => ({
    user_id: userId,
    policy_id: entry.id,
    checklist: entry.checklist ?? {},
    memo: entry.memo ?? null,
    created_at: entry.savedAt,
  }))
  const { error } = await supabase.from('saved_policies').insert(rows)
  return !error
}

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않습니다.',
    'Email not confirmed': '메일 인증이 아직 완료되지 않았습니다. 받은편지함을 확인해 주세요.',
    'User already registered': '이미 가입된 이메일입니다. 로그인해 주세요.',
    'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
  }
  return map[message] ?? message
}
