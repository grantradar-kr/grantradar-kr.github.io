export type SourceKey = 'youthcenter' | 'bokjiro' | 'bizinfo' | 'kstartup' | 'gov24'

export type LifeStage = 'infant' | 'student' | 'youth' | 'middle' | 'senior'
export type JobKey =
  | 'student'
  | 'employee'
  | 'jobseeker'
  | 'self_employed'
  | 'freelancer'
  | 'artist'
  | 'pre_founder'
export type HouseholdKey =
  | 'single'
  | 'married'
  | 'single_parent'
  | 'multi_child'
  | 'homeless'
  | 'pregnant'
  | 'disabled'
  | 'low_income'
export type DomainKey =
  | 'housing'
  | 'medical'
  | 'finance'
  | 'childcare'
  | 'education'
  | 'employment'
  | 'business'
  | 'senior_welfare'
export type Gender = 'all' | 'male' | 'female'
export type IncomeLevel = 'unknown' | 'low' | 'middle' | 'high'

export interface PolicyMatch {
  gender?: Gender
  life_stages?: LifeStage[]
  jobs?: JobKey[]
  households?: HouseholdKey[]
  domains?: DomainKey[]
  regions?: string[]
  age_min?: number | null
  age_max?: number | null
  income_note?: string
}

export interface Policy {
  id: string
  source: SourceKey
  title: string
  summary?: string
  org?: string
  url: string
  apply_url?: string | null
  posted_at?: string | null
  deadline?: string | null
  dday?: number | null
  is_always?: boolean
  match: PolicyMatch
  support?: string
  documents?: string
  keyword?: string
  category?: string
}

export interface MetaSourceStatus {
  source: SourceKey | string
  ok: boolean
  count: number
  cached?: boolean
  elapsed_sec?: number
  error?: string
  skipped?: string
}

export interface Meta {
  app: string
  app_en?: string
  generated_at: string
  today: string
  total: number
  raw_total?: number
  expired_filtered?: number
  by_source: Record<string, number>
  source_labels?: Record<string, string>
  distributions: {
    life_stages: Record<string, number>
    jobs: Record<string, number>
    households: Record<string, number>
    domains: Record<string, number>
    regions: Record<string, number>
  }
  counts: {
    urgent7: number
    always: number
    with_apply_url: number
  }
  sources: MetaSourceStatus[]
  elapsed_sec?: number
  data_bytes?: number
  license?: string
}

export interface Profile {
  gender: Gender
  birthYear: number | null
  region: string
  jobs: JobKey[]
  households: HouseholdKey[]
  domains: DomainKey[]
  income: IncomeLevel
  done: boolean
  updatedAt?: string
}

export type Verdict = 'perfect' | 'check' | 'low'

export interface Judgement {
  score: number
  verdict: Verdict
  urgent: boolean
  reasons: string[]
  gaps: string[]
}

export interface ScoredPolicy {
  policy: Policy
  judgement: Judgement
}

export interface SavedEntry {
  id: string
  savedAt: string
  checklist?: Record<string, boolean>
  memo?: string
}

export type Route = 'home' | 'browse' | 'saved' | 'settings' | 'guides' | 'calculators' | 'about'
