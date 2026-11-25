/**
 * 모의계산기 3종의 계산 로직 — 앱(React)과 정적 HTML(pipeline/build_content.py)이 같은 기준값을 쓴다.
 *
 * 기준 (2026-11-21 확인)
 *  · 기준중위소득: 보건복지부 고시 제2025-135호(2026년), 제2026-157호(2027년, 2027.1.1. 시행)
 *  · 기본재산액: 2026년 소득인정액 산정 기준 — 대도시 1억 3,500만 / 중소도시 8,500만 / 농어촌 7,250만원
 *  · 구직급여(2026.1.1. 이후 이직자): 상한 1일 68,100원(기초일액 113,500원), 하한 최저임금 10,320원 × 소정근로시간 × 80%
 *  · 근로·자녀장려금: 2025년 귀속(2026년 신청) 국세청 기준
 *
 * 모든 결과는 참고용 모의계산이다. 실제 수급 여부·금액은 심사로 확정된다.
 */

export const CALC_UPDATED = '2026-11-21'

export const CALC_DISCLAIMER =
  '※ 본 계산 결과는 2026년 고시 기준 참고용 모의계산이며, 실제 수급 여부와 최종 지급액은 복지로·고용24·국세청 홈택스 심사에 따릅니다.'

/* ------------------------------------------------------------------ 1) 기준중위소득 */

export type MedianYear = 2026 | 2027

/** 1~7인 가구 기준중위소득(원/월). 8인 이상은 7인 값 + (7인 − 6인) × (n − 7). */
export const MEDIAN_INCOME: Record<MedianYear, number[]> = {
  2026: [2564238, 4199292, 5359036, 6494738, 7556719, 8555952, 9515150],
  2027: [2736042, 4480645, 5718091, 6929885, 8063019, 9129201, 10152665],
}

export function medianIncome(year: MedianYear, household: number): number {
  const table = MEDIAN_INCOME[year]
  const size = Math.max(1, Math.floor(household))
  if (size <= 7) return table[size - 1]
  return table[6] + (table[6] - table[5]) * (size - 7)
}

export type RegionKey = 'metro' | 'city' | 'rural'

/** 2026년 기본재산액(원) — 지역별 */
export const BASE_PROPERTY: Record<RegionKey, number> = {
  metro: 135000000,
  city: 85000000,
  rural: 72500000,
}

export const REGION_LABEL: Record<RegionKey, string> = {
  metro: '대도시',
  city: '중소도시',
  rural: '농어촌',
}

/** 재산의 소득환산율 — 연 4%를 월액으로 환산 */
export const ASSET_RATE = 0.04

/** [라벨, 기준 비율, 설명] */
export const MEDIAN_THRESHOLDS: { label: string; pct: number; note: string }[] = [
  { label: '생계급여', pct: 32, note: '기준중위소득 32% 이하' },
  { label: '의료급여', pct: 40, note: '기준중위소득 40% 이하' },
  { label: '주거급여', pct: 48, note: '기준중위소득 48% 이하' },
  { label: '교육급여·차상위', pct: 50, note: '기준중위소득 50% 이하' },
  { label: '국민취업지원·청년월세', pct: 60, note: '청년은 120%까지 완화' },
  { label: '중위 100%', pct: 100, note: '기준선 자체' },
  { label: '국민취업지원(청년)', pct: 120, note: '청년 1유형 120% 이하' },
  { label: '아이돌봄서비스', pct: 150, note: '200% 기준의 중간 구간' },
  { label: '중위 180%', pct: 180, note: '일부 지자체 사업 기준' },
]

export interface MedianInput {
  household: number
  monthlyIncome: number
  asset: number
  region: RegionKey
}

export interface MedianRow {
  label: string
  pct: number
  limit: number
  pass: boolean
  gap: number
}

export interface MedianResult {
  median2026: number
  median2027: number
  assetIncome: number
  recognized: number
  recognized2027: number
  ratio2026: number
  ratio2027: number
  rows: MedianRow[]
  passedLabels: string[]
}

export function calcMedianIncome(input: MedianInput): MedianResult {
  const household = Math.max(1, Math.floor(input.household || 1))
  const income = Math.max(0, input.monthlyIncome || 0)
  const asset = Math.max(0, input.asset || 0)
  const median2026 = medianIncome(2026, household)
  const median2027 = medianIncome(2027, household)
  const deduct = BASE_PROPERTY[input.region] ?? BASE_PROPERTY.metro
  const assetIncome = Math.max(0, Math.round((Math.max(0, asset - deduct) * ASSET_RATE) / 12))
  const recognized = income + assetIncome
  const recognized2027 = recognized
  const ratio2026 = median2026 > 0 ? (recognized / median2026) * 100 : 0
  const ratio2027 = median2027 > 0 ? (recognized / median2027) * 100 : 0
  const rows: MedianRow[] = MEDIAN_THRESHOLDS.map((item) => {
    const limit = Math.round((median2026 * item.pct) / 100)
    return { label: item.label, pct: item.pct, limit, pass: recognized <= limit, gap: recognized - limit }
  })
  return {
    median2026,
    median2027,
    assetIncome,
    recognized,
    recognized2027,
    ratio2026,
    ratio2027,
    rows,
    passedLabels: rows.filter((row) => row.pass).map((row) => row.label),
  }
}

/* ------------------------------------------------------------------ 2) 실업급여(구직급여) */

export const UNEMPLOYMENT = {
  maxDaily: 68100,
  minHourly: 10320,
  maxBaseDaily: 113500,
  minHours: 8,
}

export type InsuredBand = 'lt1' | '1to3' | '3to5' | '5to10' | 'gte10'

export const INSURED_BANDS: { key: InsuredBand; label: string }[] = [
  { key: 'lt1', label: '1년 미만' },
  { key: '1to3', label: '1년 이상 ~ 3년 미만' },
  { key: '3to5', label: '3년 이상 ~ 5년 미만' },
  { key: '5to10', label: '5년 이상 ~ 10년 미만' },
  { key: 'gte10', label: '10년 이상' },
]

/** 연령·가입기간별 소정급여일수 (50세 미만 / 50세 이상·장애인) */
export const INSURED_DAYS: Record<InsuredBand, { under50: number; over50: number }> = {
  lt1: { under50: 120, over50: 120 },
  '1to3': { under50: 150, over50: 180 },
  '3to5': { under50: 180, over50: 210 },
  '5to10': { under50: 210, over50: 240 },
  gte10: { under50: 240, over50: 270 },
}

export interface UnemploymentInput {
  monthlyWage: number
  age: number
  band: InsuredBand
  disabled: boolean
  hoursPerDay: number
}

export type LimitKind = 'max' | 'min' | 'none'

export interface UnemploymentResult {
  baseDaily: number
  rawDaily: number
  daily: number
  limit: LimitKind
  limitValue: number
  days: number
  total: number
  monthly: number
  highAge: boolean
}

export function calcUnemployment(input: UnemploymentInput): UnemploymentResult {
  const monthlyWage = Math.max(0, input.monthlyWage || 0)
  const hours = Math.min(8, Math.max(1, input.hoursPerDay || 8))
  const baseDaily = Math.round(monthlyWage / 30)
  const rawDaily = Math.round(baseDaily * 0.6)
  const minDaily = Math.round(UNEMPLOYMENT.minHourly * hours * 0.8)
  const maxDaily = UNEMPLOYMENT.maxDaily
  let daily = rawDaily
  let limit: LimitKind = 'none'
  if (rawDaily > maxDaily) {
    daily = maxDaily
    limit = 'max'
  } else if (rawDaily < minDaily) {
    daily = minDaily
    limit = 'min'
  }
  const highAge = (input.age || 0) >= 50 || input.disabled
  const days = (INSURED_DAYS[input.band] ?? INSURED_DAYS.lt1)[highAge ? 'over50' : 'under50']
  return {
    baseDaily,
    rawDaily,
    daily,
    limit,
    limitValue: limit === 'max' ? maxDaily : limit === 'min' ? minDaily : 0,
    days,
    total: daily * days,
    monthly: daily * 30,
    highAge,
  }
}

/* ------------------------------------------------------------------ 3) 근로·자녀장려금 */

export type EitcHousehold = 'single' | 'singleEarner' | 'dual'
export type AssetBand = 'under' | 'mid' | 'over'

export interface EitcParam {
  label: string
  max: number
  flatStart: number
  flatEnd: number
  incomeCap: number
}

/** 2025년 귀속(2026년 신청) 국세청 기준 */
export const EITC_PARAM: Record<EitcHousehold, EitcParam> = {
  single: { label: '단독가구', max: 1650000, flatStart: 4000000, flatEnd: 9000000, incomeCap: 22000000 },
  singleEarner: { label: '홑벌이가구', max: 2850000, flatStart: 7000000, flatEnd: 14000000, incomeCap: 32000000 },
  dual: { label: '맞벌이가구', max: 3300000, flatStart: 8000000, flatEnd: 17000000, incomeCap: 44000000 },
}

export const EITC_MIN = 30000

/** 자녀장려금: 홑벌이 0~2,100만 최대, 7,000만 미만 최소 50만 / 맞벌이 600~2,500만 최대 */
export const CHILD_CREDIT = {
  incomeCap: 70000000,
  maxPerChild: 1000000,
  minPerChild: 500000,
  singleEarnerFull: 21000000,
  dualFull: 25000000,
}

export const ASSET_BAND_LABEL: Record<AssetBand, string> = {
  under: '1억 7,000만 원 미만',
  mid: '1억 7,000만 원 이상 ~ 2억 4,000만 원 미만',
  over: '2억 4,000만 원 이상',
}

export interface EitcInput {
  household: EitcHousehold
  totalIncome: number
  children: number
  assetBand: AssetBand
}

export interface EitcResult {
  eligible: boolean
  eitcBase: number
  childBase: number
  assetFactor: number
  regularEitc: number
  regularChild: number
  regularTotal: number
  lateEitc: number
  lateChild: number
  lateTotal: number
  incomeCap: number
}

function baseEitc(income: number, param: EitcParam): number {
  if (income <= 0) return 0
  if (income >= param.incomeCap) return 0
  if (income < param.flatStart) {
    return Math.round((param.max * income) / param.flatStart)
  }
  if (income <= param.flatEnd) return param.max
  const ratio = (income - param.flatEnd) / (param.incomeCap - param.flatEnd)
  return Math.round(param.max * (1 - ratio))
}

function baseChildCredit(income: number, children: number, household: EitcHousehold): number {
  if (children <= 0) return 0
  if (household === 'single') return 0
  if (income >= CHILD_CREDIT.incomeCap) return 0
  const full = household === 'dual' ? CHILD_CREDIT.dualFull : CHILD_CREDIT.singleEarnerFull
  const perChild =
    income <= full
      ? CHILD_CREDIT.maxPerChild
      : Math.round(
          CHILD_CREDIT.maxPerChild -
            ((CHILD_CREDIT.maxPerChild - CHILD_CREDIT.minPerChild) * (income - full)) /
              (CHILD_CREDIT.incomeCap - full),
        )
  return perChild * children
}

export function calcEitc(input: EitcInput): EitcResult {
  const param = EITC_PARAM[input.household] ?? EITC_PARAM.single
  const income = Math.max(0, input.totalIncome || 0)
  const children = Math.max(0, Math.floor(input.children || 0))
  const assetFactor = input.assetBand === 'over' ? 0 : input.assetBand === 'mid' ? 0.5 : 1
  let eitcBase = baseEitc(income, param)
  if (eitcBase > 0 && eitcBase < EITC_MIN) eitcBase = EITC_MIN
  const childBase = baseChildCredit(income, children, input.household)
  const regularEitc = Math.round(eitcBase * assetFactor)
  const regularChild = Math.round(childBase * assetFactor)
  const lateEitc = Math.round(regularEitc * 0.95)
  const lateChild = Math.round(regularChild * 0.95)
  return {
    eligible: assetFactor > 0 && (regularEitc > 0 || regularChild > 0),
    eitcBase,
    childBase,
    assetFactor,
    regularEitc,
    regularChild,
    regularTotal: regularEitc + regularChild,
    lateEitc,
    lateChild,
    lateTotal: lateEitc + lateChild,
    incomeCap: param.incomeCap,
  }
}

/* ------------------------------------------------------------------ 4) 월세 세액공제 */

/**
 * 월세 세액공제 기준 (조세특례제한법 제95조의2, 2026년 귀속)
 *  · 총급여 8,000만 원 이하(종합소득금액 7,000만 원 초과자 제외)
 *  · 공제 대상 월세 연 1,000만 원 한도 · 무주택 세대주(요건 충족 시 세대원·배우자)
 *  · 공제율 — 총급여 5,500만 원 이하(종합소득금액 4,500만 원 이하) 17%, 그 밖 15%
 *  · 공제액이 표준세액공제 13만 원보다 적으면 표준세액공제가 유리하다
 */
export const RENT_CREDIT = {
  limit: 10000000,
  rateHigh: 0.17,
  rateNormal: 0.15,
  incomeCap: 80000000,
  highCap: 55000000,
  standardCredit: 130000,
  localTaxRate: 0.1,
} as const

export interface RentCreditInput {
  totalSalary: number
  monthlyRent: number
  months: number
  /** 종합소득금액 4,500만 원 초과 — 17% 구간에서 제외된다 */
  highOtherIncome?: boolean
}

export interface RentCreditResult {
  overIncome: boolean
  rate: number
  rentPaid: number
  rentBase: number
  credit: number
  creditWithLocal: number
  beatsStandard: boolean
  monthCount: number
}

export function calcRentCredit(input: RentCreditInput): RentCreditResult {
  const salary = Math.max(0, Math.round(input.totalSalary || 0))
  const monthly = Math.max(0, Math.round(input.monthlyRent || 0))
  const monthCount = Math.min(12, Math.max(0, Math.floor(input.months || 0)))
  const overIncome = salary > RENT_CREDIT.incomeCap
  const rentPaid = monthly * monthCount
  const rentBase = Math.min(rentPaid, RENT_CREDIT.limit)
  const highBand = salary <= RENT_CREDIT.highCap && !input.highOtherIncome
  const rate = overIncome ? 0 : highBand ? RENT_CREDIT.rateHigh : RENT_CREDIT.rateNormal
  const credit = Math.round(rentBase * rate)
  return {
    overIncome,
    rate,
    rentPaid,
    rentBase,
    credit,
    creditWithLocal: Math.round(credit * (1 + RENT_CREDIT.localTaxRate)),
    beatsStandard: credit > RENT_CREDIT.standardCredit,
    monthCount,
  }
}

/* ------------------------------------------------------------------ 표시 도우미 */

export function won(value: number): string {
  const rounded = Math.round(value || 0)
  return `${rounded.toLocaleString('ko-KR')}원`
}

export function manwon(value: number): string {
  const rounded = Math.round((value || 0) / 10000)
  return `${rounded.toLocaleString('ko-KR')}만 원`
}

export function percent(value: number): string {
  return `${(Math.round((value || 0) * 10) / 10).toFixed(1)}%`
}
