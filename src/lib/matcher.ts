import { domainLabel, householdLabel, jobLabel, lifeLabel } from './labels'
import type { Judgement, LifeStage, Policy, Profile, ScoredPolicy, Verdict } from './types'

export const CURRENT_YEAR = new Date().getFullYear()

export const DEFAULT_PROFILE: Profile = {
  gender: 'all',
  birthYear: null,
  region: '전국',
  jobs: [],
  households: [],
  domains: [],
  income: 'unknown',
  done: false,
}

export function ageFromBirthYear(birthYear?: number | null): number | null {
  if (!birthYear || birthYear < 1900 || birthYear > CURRENT_YEAR) return null
  const age = CURRENT_YEAR - birthYear
  return age >= 0 && age <= 120 ? age : null
}

export function lifeStageOfAge(age: number | null): LifeStage | null {
  if (age === null) return null
  if (age <= 8) return 'infant'
  if (age <= 18) return 'student'
  if (age <= 39) return 'youth'
  if (age <= 64) return 'middle'
  return 'senior'
}

const FAMILY_STAGES: LifeStage[] = ['infant', 'student']

/**
 * 정책 1건을 사용자 상황과 비교해 0~100 일치율과 사유를 만든다.
 * 하드 조건(성별·연령·지역·마감)이 어긋나면 점수를 크게 깎고 '조건 확인 필요'로 낮춘다.
 */
export function judge(policy: Policy, profile: Profile): Judgement {
  const m = policy.match || {}
  const age = ageFromBirthYear(profile.birthYear)
  const stage = lifeStageOfAge(age)
  const reasons: string[] = []
  const gaps: string[] = []
  let score = 54
  let hardBlock = false

  // 1) 성별
  const gender = m.gender ?? 'all'
  if (gender !== 'all') {
    if (profile.gender === 'all') {
      score -= 4
      gaps.push(gender === 'female' ? '여성 전용 — 성별 확인 필요' : '남성 전용 — 성별 확인 필요')
    } else if (gender === profile.gender) {
      score += 7
      reasons.push(gender === 'female' ? '여성 대상' : '남성 대상')
    } else {
      score -= 42
      hardBlock = true
      gaps.push(gender === 'female' ? '여성 전용 공고' : '남성 전용 공고')
    }
  }

  // 2) 연령 (0세 이상·제한 없음 표기는 조건 없음으로 처리)
  const min = typeof m.age_min === 'number' ? m.age_min : null
  const max = typeof m.age_max === 'number' ? m.age_max : null
  const noAgeLimit = (min === null || min <= 0) && (max === null || max >= 120)
  if (age !== null && !noAgeLimit && (min !== null || max !== null)) {
    const lo = min ?? 0
    const hi = max ?? 120
    if (age >= lo && age <= hi) {
      score += 13
      const rangeText =
        min !== null && max !== null ? `만 ${lo}~${hi}세` : min !== null ? `만 ${lo}세 이상` : `만 ${hi}세 이하`
      reasons.push(`만 ${age}세 지원 가능 (${rangeText})`)
    } else {
      score -= 38
      hardBlock = true
      gaps.push(min !== null && max !== null ? `만 ${lo}~${hi}세 대상` : min !== null ? `만 ${lo}세 이상 대상` : `만 ${hi}세 이하 대상`)
    }
  }

  // 3) 지역
  const regions = m.regions && m.regions.length ? m.regions : ['전국']
  const nationwide = regions.includes('전국')
  if (nationwide) {
    score += 4
    if (regions.length === 1) reasons.push('전국 어디서나 신청')
  } else if (profile.region && profile.region !== '전국') {
    if (regions.includes(profile.region)) {
      score += 11
      reasons.push(`${profile.region} 거주 조건 일치`)
    } else {
      score -= 16
      hardBlock = true
      gaps.push(`${regions.slice(0, 3).join('·')} 지역 대상`)
    }
  } else {
    score -= 3
    gaps.push(`${regions.slice(0, 3).join('·')} 지역 대상`)
  }

  // 4) 직군
  const jobs = m.jobs ?? []
  if (jobs.length) {
    const hit = jobs.filter((j) => profile.jobs.includes(j))
    if (hit.length) {
      score += 12
      reasons.push(`직군 일치 · ${hit.map((j) => jobLabel(j)).join(', ')}`)
    } else if (profile.jobs.length) {
      score -= 5
      gaps.push(`대상 직군 · ${jobs.slice(0, 3).map((j) => jobLabel(j)).join(', ')}`)
    }
  }

  // 5) 가구·상황
  const households = m.households ?? []
  if (households.length) {
    const hit = households.filter((h) => profile.households.includes(h))
    if (hit.length) {
      score += 12
      reasons.push(`가구 상황 일치 · ${hit.map((h) => householdLabel(h)).join(', ')}`)
    } else if (profile.households.length) {
      score -= 4
      gaps.push(`대상 가구 · ${households.slice(0, 3).map((h) => householdLabel(h)).join(', ')}`)
    }
  }

  // 6) 관심 분야
  const domains = m.domains ?? []
  if (domains.length && profile.domains.length) {
    const hit = domains.filter((d) => profile.domains.includes(d))
    if (hit.length) {
      score += 9
      reasons.push(`관심 분야 · ${hit.map((d) => domainLabel(d)).join(', ')}`)
    }
  }

  // 7) 생애주기
  const stages = m.life_stages ?? []
  if (stage && stages.length) {
    if (stages.includes(stage)) {
      score += 7
      if (stages.length === 1) reasons.push(`${lifeLabel(stage)} 대상`)
    } else {
      const familyOnly = stages.every((s) => FAMILY_STAGES.includes(s))
      const familyProfile =
        profile.households.includes('married') ||
        profile.households.includes('single_parent') ||
        profile.households.includes('multi_child') ||
        profile.households.includes('pregnant')
      if (familyOnly && familyProfile) {
        // 자녀·영유아 대상 제도는 부모에게도 유효
        score += 2
      } else {
        score -= 16
        gaps.push(`${stages.map((s) => lifeLabel(s)).join('·')} 대상`)
      }
    }
  }

  // 8) 소득
  if (m.income_note && profile.income === 'low') {
    score += 3
    reasons.push('저소득 조건 우대')
  }

  // 9) 마감
  const dday = policy.dday
  const urgent = typeof dday === 'number' && dday >= 0 && dday <= 7
  if (urgent) {
    score += 3
    reasons.push(dday === 0 ? '오늘 마감' : `D-${dday} 마감 임박`)
  }
  if (typeof dday === 'number' && dday < 0) {
    score -= 50
    hardBlock = true
    gaps.push('신청 기간 종료')
  }

  score = Math.max(3, Math.min(99, Math.round(score)))
  let verdict: Verdict
  if (hardBlock) verdict = score >= 58 ? 'check' : 'low'
  else if (score >= 82) verdict = 'perfect'
  else if (score >= 60) verdict = 'check'
  else verdict = 'low'

  return {
    score,
    verdict,
    urgent,
    reasons: unique(reasons).slice(0, 5),
    gaps: unique(gaps).slice(0, 3),
  }
}

function unique(list: string[]): string[] {
  const out: string[] = []
  for (const item of list) if (item && !out.includes(item)) out.push(item)
  return out
}

export type SortKey = 'match' | 'deadline' | 'recent'

export interface FilterOptions {
  query?: string
  domains?: string[]
  lifeStages?: string[]
  regions?: string[]
  verdicts?: Verdict[]
  onlyUrgent?: boolean
}

export function scorePolicies(policies: Policy[], profile: Profile): ScoredPolicy[] {
  return policies.map((policy) => ({ policy, judgement: judge(policy, profile) }))
}

export function sortScored(items: ScoredPolicy[], sort: SortKey): ScoredPolicy[] {
  const arr = [...items]
  arr.sort((a, b) => {
    if (sort === 'deadline') {
      const da = a.policy.dday
      const db = b.policy.dday
      const na = typeof da === 'number' ? da : Number.MAX_SAFE_INTEGER
      const nb = typeof db === 'number' ? db : Number.MAX_SAFE_INTEGER
      if (na !== nb) return na - nb
      return b.judgement.score - a.judgement.score
    }
    if (sort === 'recent') {
      const pa = a.policy.posted_at ?? ''
      const pb = b.policy.posted_at ?? ''
      if (pa !== pb) return pb.localeCompare(pa)
      return b.judgement.score - a.judgement.score
    }
    if (b.judgement.score !== a.judgement.score) return b.judgement.score - a.judgement.score
    const da = a.policy.dday
    const db = b.policy.dday
    const na = typeof da === 'number' ? da : Number.MAX_SAFE_INTEGER
    const nb = typeof db === 'number' ? db : Number.MAX_SAFE_INTEGER
    return na - nb
  })
  return arr
}

export function filterScored(items: ScoredPolicy[], options: FilterOptions): ScoredPolicy[] {
  const query = (options.query ?? '').trim().toLowerCase()
  const domains = options.domains ?? []
  const lifeStages = options.lifeStages ?? []
  const regions = options.regions ?? []
  const verdicts = options.verdicts ?? []

  return items.filter(({ policy, judgement }) => {
    if (options.onlyUrgent && !judgement.urgent) return false
    if (verdicts.length && !verdicts.includes(judgement.verdict)) return false
    if (domains.length) {
      const list = policy.match.domains ?? []
      if (!list.some((d) => domains.includes(d))) return false
    }
    if (lifeStages.length) {
      const list = policy.match.life_stages ?? []
      if (!list.some((s) => lifeStages.includes(s))) return false
    }
    if (regions.length) {
      const list = policy.match.regions ?? ['전국']
      if (!list.some((r) => regions.includes(r) || r === '전국')) return false
    }
    if (query) {
      const haystack = [
        policy.title,
        policy.summary,
        policy.org,
        policy.category,
        policy.keyword,
        ...(policy.match.households ?? []).map((h) => householdLabel(h)),
        ...(policy.match.jobs ?? []).map((j) => jobLabel(j)),
        ...(policy.match.domains ?? []).map((d) => domainLabel(d)),
        ...(policy.match.regions ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

export function summarize(items: ScoredPolicy[]) {
  return {
    total: items.length,
    perfect: items.filter((i) => i.judgement.verdict === 'perfect').length,
    check: items.filter((i) => i.judgement.verdict === 'check').length,
    urgent: items.filter((i) => i.judgement.urgent).length,
  }
}

export function profileSummary(profile: Profile): string[] {
  const parts: string[] = []
  const age = ageFromBirthYear(profile.birthYear)
  if (age !== null) parts.push(`만 ${age}세`)
  if (profile.gender === 'female') parts.push('여성')
  if (profile.gender === 'male') parts.push('남성')
  if (profile.region && profile.region !== '전국') parts.push(profile.region)
  profile.jobs.forEach((j) => parts.push(jobLabel(j)))
  profile.households.forEach((h) => parts.push(householdLabel(h)))
  profile.domains.forEach((d) => parts.push(`관심:${domainLabel(d)}`))
  if (profile.income === 'low') parts.push('저소득')
  return parts
}
