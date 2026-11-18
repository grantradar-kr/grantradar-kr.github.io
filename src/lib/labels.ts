import type { DomainKey, HouseholdKey, JobKey, LifeStage, SourceKey } from './types'

export const LIFE_STAGES: { key: LifeStage; label: string; short: string; emoji: string }[] = [
  { key: 'infant', label: '영유아·아동', short: '영유아', emoji: '🍼' },
  { key: 'student', label: '초중고·대학생', short: '학생', emoji: '🎒' },
  { key: 'youth', label: '청년 (19~39세)', short: '청년', emoji: '🧑‍💻' },
  { key: 'middle', label: '중장년 (40~64세)', short: '중장년', emoji: '💼' },
  { key: 'senior', label: '노인 (65세 이상)', short: '노인', emoji: '🌿' },
]

export const JOBS: { key: JobKey; label: string; emoji: string }[] = [
  { key: 'student', label: '학생', emoji: '🎓' },
  { key: 'employee', label: '직장인', emoji: '🏢' },
  { key: 'jobseeker', label: '구직자·취업준비생', emoji: '🔎' },
  { key: 'self_employed', label: '자영업·소상공인', emoji: '🏪' },
  { key: 'freelancer', label: '프리랜서·특수고용', emoji: '🧾' },
  { key: 'artist', label: '예술인·창작자', emoji: '🎨' },
  { key: 'pre_founder', label: '예비창업자·창업자', emoji: '🚀' },
]

export const HOUSEHOLDS: { key: HouseholdKey; label: string; emoji: string }[] = [
  { key: 'single', label: '1인가구·미혼', emoji: '🙋' },
  { key: 'married', label: '기혼·신혼부부', emoji: '💍' },
  { key: 'single_parent', label: '한부모·돌싱', emoji: '🤝' },
  { key: 'multi_child', label: '다자녀', emoji: '👨‍👩‍👧‍👦' },
  { key: 'homeless', label: '무주택', emoji: '🏠' },
  { key: 'pregnant', label: '임산부·난임', emoji: '🤰' },
  { key: 'disabled', label: '장애인·보훈', emoji: '♿' },
  { key: 'low_income', label: '저소득·차상위', emoji: '🪙' },
]

export const DOMAINS: { key: DomainKey; label: string; short: string; emoji: string; color: string }[] = [
  { key: 'housing', label: '주거', short: '주거', emoji: '🏡', color: 'bg-sky-50 text-sky-700 ring-sky-100' },
  { key: 'medical', label: '의료·건강', short: '의료', emoji: '🏥', color: 'bg-rose-50 text-rose-700 ring-rose-100' },
  { key: 'finance', label: '생활·금융', short: '금융', emoji: '💳', color: 'bg-amber-50 text-amber-700 ring-amber-100' },
  { key: 'childcare', label: '영유아·보육', short: '보육', emoji: '🍼', color: 'bg-pink-50 text-pink-700 ring-pink-100' },
  { key: 'education', label: '교육', short: '교육', emoji: '📚', color: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
  { key: 'employment', label: '취업·일자리', short: '취업', emoji: '💼', color: 'bg-teal-50 text-teal-700 ring-teal-100' },
  { key: 'business', label: '창업·소상공인', short: '창업', emoji: '🚀', color: 'bg-violet-50 text-violet-700 ring-violet-100' },
  { key: 'senior_welfare', label: '노인복지', short: '노인', emoji: '🌿', color: 'bg-lime-50 text-lime-700 ring-lime-100' },
]

export const REGIONS = [
  '전국',
  '서울',
  '경기',
  '인천',
  '부산',
  '대구',
  '광주',
  '대전',
  '울산',
  '세종',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
]

export const SOURCE_LABEL: Record<SourceKey, string> = {
  youthcenter: '온통청년',
  bokjiro: '복지로',
  bizinfo: '기업마당',
  kstartup: 'K-Startup',
  gov24: '보조금24',
}

export const SOURCE_COLOR: Record<SourceKey, string> = {
  youthcenter: 'bg-teal-50 text-teal-700 ring-teal-100',
  bokjiro: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  bizinfo: 'bg-orange-50 text-orange-700 ring-orange-100',
  kstartup: 'bg-violet-50 text-violet-700 ring-violet-100',
  gov24: 'bg-blue-50 text-blue-700 ring-blue-100',
}

export const LIFE_LABEL: Record<LifeStage, string> = LIFE_STAGES.reduce(
  (acc, item) => ({ ...acc, [item.key]: item.short }),
  {} as Record<LifeStage, string>,
)

export const JOB_LABEL: Record<JobKey, string> = JOBS.reduce(
  (acc, item) => ({ ...acc, [item.key]: item.label }),
  {} as Record<JobKey, string>,
)

export const HOUSEHOLD_LABEL: Record<HouseholdKey, string> = HOUSEHOLDS.reduce(
  (acc, item) => ({ ...acc, [item.key]: item.label }),
  {} as Record<HouseholdKey, string>,
)

export const DOMAIN_LABEL: Record<DomainKey, string> = DOMAINS.reduce(
  (acc, item) => ({ ...acc, [item.key]: item.label }),
  {} as Record<DomainKey, string>,
)

export function domainMeta(key: string) {
  return DOMAINS.find((d) => d.key === key)
}

export function lifeLabel(key: string): string {
  return LIFE_LABEL[key as LifeStage] ?? key
}

export function jobLabel(key: string): string {
  return JOB_LABEL[key as JobKey] ?? key
}

export function householdLabel(key: string): string {
  return HOUSEHOLD_LABEL[key as HouseholdKey] ?? key
}

export function domainLabel(key: string): string {
  return DOMAIN_LABEL[key as DomainKey] ?? key
}

export function sourceLabel(key: string): string {
  return SOURCE_LABEL[key as SourceKey] ?? key
}
