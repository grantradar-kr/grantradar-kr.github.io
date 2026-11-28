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

/* ------------------------------------------------------------------ 5) 연말정산 공제·환급 시뮬레이터 */

/**
 * 2026년 귀속(2027년 1~2월 연말정산) 기준 — 2026-11-28 확인
 *  · 근로소득공제: 소득세법 제47조, 한도 2,000만 원
 *  · 기본세율: 소득세법 제55조 (1,400만 원 6% ~ 10억 원 초과 45%)
 *  · 근로소득세액공제: 소득세법 제59조 — 산출세액 130만 원 이하 55%, 초과분 30%, 총급여별 한도 74만~20만 원
 *  · 신용카드 등 소득공제: 조세특례제한법 제126조의2 — 총급여 25% 문턱, 신용 15%·체크/현금 30%·전통시장/대중교통 40%,
 *    기본한도 300만 원(총급여 7,000만 원 초과 250만 원) + 자녀 등 1명 50만·2명 이상 100만 원,
 *    추가한도 300만 원(총급여 7,000만 원 초과 200만 원)
 *  · 연금계좌 세액공제: 소득세법 제59조의3 — 연금저축 600만 원·IRP 합산 900만 원, 16.5%(총급여 5,500만 원 이하)·13.2%
 *  · 고향사랑기부금: 조세특례제한법 제58조 — 10만 원 이하 100/110, 10만 원 초과 20만 원 이하 40%, 20만 원 초과 15%
 *  · 월세 세액공제: 조세특례제한법 제95조의2 — 연 1,000만 원 한도, 17%·15%
 *  · 의료비 15%(총급여 3% 초과, 일반 부양가족 연 700만 원 한도) · 교육비 15% · 자녀세액공제 25만·55만·95만 원
 *
 * 소득세액공제는 산출세액을 넘을 수 없고, 표준세액공제 13만 원은 특별세액공제 합계가 그보다 적을 때 대신 적용한다.
 * 실제 환급액은 기납부세액(원천징수)과 결정세액의 차이로 정해지므로, 이 계산기는 두 가지를 모두 보여 준다.
 */

export const YEAR_END_UPDATED = '2026-11-28'

export const YEAR_END = {
  earnedCap: 20000000,
  personalPerHead: 1500000,
  standardCredit: 130000,
  localRate: 0.1,
  card: {
    thresholdRate: 0.25,
    creditRate: 0.15,
    checkRate: 0.3,
    marketRate: 0.4,
    transitRate: 0.4,
    baseLow: 3000000,
    baseHigh: 2500000,
    childUnit: 500000,
    addLow: 3000000,
    addHigh: 2000000,
    highSalary: 70000000,
  },
  pension: { savingsLimit: 6000000, totalLimit: 9000000, rateLow: 0.165, rateHigh: 0.132, salaryCap: 55000000 },
  hometown: { unit: 100000, highUnit: 200000, midRate: 0.44, topRate: 0.165 },
  medical: { thresholdRate: 0.03, rate: 0.15, generalLimit: 7000000 },
  education: { rate: 0.15 },
  insuranceRate: 0.094,
} as const

/** 소득세법 제55조 기본세율 [과세표준 상한, 세율, 누진공제] */
export const TAX_BRACKETS: { limit: number; rate: number; progressive: number }[] = [
  { limit: 14000000, rate: 0.06, progressive: 0 },
  { limit: 50000000, rate: 0.15, progressive: 1260000 },
  { limit: 88000000, rate: 0.24, progressive: 5760000 },
  { limit: 150000000, rate: 0.35, progressive: 15440000 },
  { limit: 300000000, rate: 0.38, progressive: 19940000 },
  { limit: 500000000, rate: 0.4, progressive: 25940000 },
  { limit: 1000000000, rate: 0.42, progressive: 35940000 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, progressive: 65940000 },
]

/** 근로소득공제 (소득세법 제47조, 한도 2,000만 원) */
export function earnedIncomeDeduction(gross: number): number {
  const g = Math.max(0, gross || 0)
  let value: number
  if (g <= 5000000) value = g * 0.7
  else if (g <= 15000000) value = 3500000 + (g - 5000000) * 0.4
  else if (g <= 45000000) value = 7500000 + (g - 15000000) * 0.15
  else if (g <= 100000000) value = 12000000 + (g - 45000000) * 0.05
  else value = 14750000 + (g - 100000000) * 0.02
  return Math.min(Math.round(value), YEAR_END.earnedCap, Math.round(g))
}

/** 산출세액 = 과세표준 × 세율 − 누진공제 */
export function grossIncomeTax(base: number): number {
  const b = Math.max(0, base || 0)
  const bracket = TAX_BRACKETS.find((item) => b <= item.limit) ?? TAX_BRACKETS[TAX_BRACKETS.length - 1]
  return Math.max(0, Math.round(b * bracket.rate - bracket.progressive))
}

/** 근로소득세액공제 (소득세법 제59조) */
export function laborIncomeTaxCredit(gross: number, grossTax: number): number {
  if (grossTax <= 0) return 0
  const raw = grossTax <= 1300000 ? grossTax * 0.55 : 715000 + (grossTax - 1300000) * 0.3
  const g = Math.max(0, gross || 0)
  let cap: number
  if (g <= 33000000) cap = 740000
  else if (g <= 70000000) cap = Math.max(660000, 740000 - (g - 33000000) * 0.008)
  else if (g <= 120000000) cap = Math.max(500000, 660000 - (g - 70000000) * 0.5)
  else cap = Math.max(200000, 500000 - (g - 120000000) * 0.5)
  return Math.min(Math.round(raw), Math.round(cap), grossTax)
}

/** 자녀세액공제 (2026년 귀속: 9세 이상 기본공제 자녀 1명 25만·2명 55만·3명 이상 95만 + 1명당 40만) */
export function childTaxCredit(children: number): number {
  const n = Math.max(0, Math.floor(children || 0))
  if (n <= 0) return 0
  if (n === 1) return 250000
  if (n === 2) return 550000
  return 950000 + 400000 * (n - 3)
}

export interface CardInput {
  gross: number
  children: number
  credit: number
  check: number
  market: number
  transit: number
}

export interface CardResult {
  threshold: number
  used: number
  thresholdLeft: number
  raw: number
  baseLimit: number
  addLimit: number
  baseUsed: number
  addUsed: number
  deduction: number
  limitLeft: number
  excess: number
}

/** 신용카드 등 사용금액 소득공제 (조세특례제한법 제126조의2) */
export function calcCardDeduction(input: CardInput): CardResult {
  const c = YEAR_END.card
  const gross = Math.max(0, input.gross || 0)
  const credit = Math.max(0, Math.round(input.credit || 0))
  const check = Math.max(0, Math.round(input.check || 0))
  const market = Math.max(0, Math.round(input.market || 0))
  const transit = Math.max(0, Math.round(input.transit || 0))
  const used = credit + check + market + transit
  const threshold = Math.round(gross * c.thresholdRate)
  const raw = credit * c.creditRate + check * c.checkRate + market * c.marketRate + transit * c.transitRate

  let minus = raw
  if (used > threshold) {
    if (credit >= threshold) minus = threshold * c.creditRate
    else if (credit + check >= threshold) minus = credit * c.creditRate + (threshold - credit) * c.checkRate
    else minus = credit * c.creditRate + check * c.checkRate + (threshold - credit - check) * c.marketRate
  }
  const pre = Math.max(0, Math.round(raw - minus))

  const kids = Math.max(0, Math.floor(input.children || 0))
  const high = gross > c.highSalary
  const baseLimit =
    (high ? c.baseHigh : c.baseLow) + (kids >= 2 ? c.childUnit * 2 : kids === 1 ? c.childUnit : 0)
  const addLimit = high ? c.addHigh : c.addLow
  const baseUsed = Math.min(pre, baseLimit)
  const excess = Math.max(0, pre - baseLimit)
  const preferential = Math.round(market * c.marketRate + transit * c.transitRate)
  const addUsed = Math.min(excess, preferential, addLimit)
  const deduction = baseUsed + addUsed

  return {
    threshold,
    used,
    thresholdLeft: Math.max(0, threshold - used),
    raw: Math.round(raw),
    baseLimit,
    addLimit,
    baseUsed,
    addUsed,
    deduction,
    limitLeft: Math.max(0, baseLimit + addLimit - deduction),
    excess,
  }
}

/** 연금계좌(연금저축·IRP) 세액공제 — 연금저축 600만 원, 합산 900만 원 한도 */
export function calcPensionCredit(gross: number, savings: number, irp: number) {
  const p = YEAR_END.pension
  const savingsBase = Math.min(Math.max(0, Math.round(savings || 0)), p.savingsLimit)
  const base = Math.min(savingsBase + Math.max(0, Math.round(irp || 0)), p.totalLimit)
  const rate = Math.max(0, gross || 0) <= p.salaryCap ? p.rateLow : p.rateHigh
  return {
    base,
    cap: p.totalLimit,
    left: Math.max(0, p.totalLimit - base),
    rate,
    credit: Math.round(base * rate),
  }
}

/** 고향사랑기부금 세액공제 (조세특례제한법 제58조, 지방소득세 포함 금액) */
export function calcHometownCredit(donation: number): number {
  const h = YEAR_END.hometown
  const d = Math.max(0, Math.round(donation || 0))
  if (d <= 0) return 0
  if (d <= h.unit) return d
  if (d <= h.highUnit) return Math.round(h.unit + (d - h.unit) * h.midRate)
  return Math.round(h.unit + h.unit * h.midRate + (d - h.highUnit) * h.topRate)
}

export interface YearEndInput {
  gross: number
  /** 본인 제외 기본공제 대상자 수 */
  dependents: number
  /** 9세 이상 기본공제 자녀 수 (자녀세액공제) */
  children: number
  /** 연간 4대보험료(근로자 부담). 0이면 총급여의 9.4%로 추정 */
  insurance: number
  cardCredit: number
  cardCheck: number
  cardMarket: number
  cardTransit: number
  /** 12월 남은 지출 예상액 — 신용카드 대신 체크카드로 쓸 금액 */
  remainingSpend: number
  pensionSavings: number
  pensionIrp: number
  hometown: number
  rentMonthly: number
  rentMonths: number
  medical: number
  education: number
  /** 기납부 소득세(원천징수영수증). 0이면 환급 계산 생략 */
  paidTax: number
}

export interface YearEndAction {
  key: string
  title: string
  detail: string
  saving: number
}

export interface YearEndResult {
  gross: number
  earnedDeduction: number
  earnedIncome: number
  personalDeduction: number
  insuranceDeduction: number
  insuranceEstimated: boolean
  cardDeduction: number
  taxableBase: number
  grossTax: number
  laborCredit: number
  childCredit: number
  pensionCredit: number
  pensionBase: number
  pensionRate: number
  pensionLeft: number
  medicalCredit: number
  educationCredit: number
  hometownCredit: number
  rentCredit: number
  specialCredit: number
  standardApplied: boolean
  standardCredit: number
  creditsTotal: number
  decisionTax: number
  localTax: number
  totalTax: number
  baseTotalTax: number
  saving: number
  refund: number | null
  headroom: number
  card: CardResult
  actions: YearEndAction[]
}

interface YearEndCore {
  gross: number
  earnedDeduction: number
  earnedIncome: number
  personalDeduction: number
  insuranceDeduction: number
  insuranceEstimated: boolean
  card: CardResult
  taxableBase: number
  grossTax: number
  laborCredit: number
  childCredit: number
  pensionBase: number
  pensionRate: number
  pensionLeft: number
  pensionCredit: number
  medicalCredit: number
  educationCredit: number
  hometownCredit: number
  rentCredit: number
  specialCredit: number
  standardApplied: boolean
  standardCredit: number
  creditsTotal: number
  decisionTax: number
  localTax: number
  totalTax: number
  headroom: number
}

function computeYearEnd(input: YearEndInput): YearEndCore {
  const gross = Math.max(0, Math.round(input.gross || 0))
  const dependents = Math.max(0, Math.floor(input.dependents || 0))
  const children = Math.max(0, Math.floor(input.children || 0))

  const earnedDeduction = earnedIncomeDeduction(gross)
  const earnedIncome = Math.max(0, gross - earnedDeduction)
  const personalDeduction = YEAR_END.personalPerHead * (1 + dependents)
  const insuranceEstimated = !(input.insurance > 0)
  const insuranceDeduction = Math.min(
    earnedIncome,
    Math.round(input.insurance > 0 ? input.insurance : gross * YEAR_END.insuranceRate),
  )
  const card = calcCardDeduction({
    gross,
    children,
    credit: input.cardCredit,
    check: input.cardCheck,
    market: input.cardMarket,
    transit: input.cardTransit,
  })

  const taxableBase = Math.max(0, earnedIncome - personalDeduction - insuranceDeduction - card.deduction)
  const grossTax = grossIncomeTax(taxableBase)
  const laborCredit = laborIncomeTaxCredit(gross, grossTax)
  const childCredit = childTaxCredit(children)

  const pension = calcPensionCredit(gross, input.pensionSavings, input.pensionIrp)
  const medicalBase = Math.min(
    Math.max(0, Math.round((input.medical || 0) - gross * YEAR_END.medical.thresholdRate)),
    YEAR_END.medical.generalLimit,
  )
  const medicalCredit = Math.round(medicalBase * YEAR_END.medical.rate)
  const educationCredit = Math.round(Math.max(0, input.education || 0) * YEAR_END.education.rate)
  const hometownCredit = calcHometownCredit(input.hometown)
  const rent = calcRentCredit({
    totalSalary: gross,
    monthlyRent: input.rentMonthly,
    months: input.rentMonths,
  })
  const rentCredit = rent.overIncome ? 0 : rent.credit

  // 표준세액공제 13만 원: 특별세액공제(보험료·의료비·교육비·기부금·월세) 합계가 그보다 적으면 대신 적용
  const specialCredit = medicalCredit + educationCredit + hometownCredit + rentCredit
  const standardApplied = specialCredit < YEAR_END.standardCredit
  const standardCredit = standardApplied ? YEAR_END.standardCredit : 0

  const creditsTotal = laborCredit + childCredit + pension.credit + specialCredit + standardCredit
  const taxBeforeCredits = Math.max(0, grossTax - laborCredit)
  const decisionTax = Math.max(0, taxBeforeCredits - (childCredit + pension.credit + specialCredit + standardCredit))
  const localTax = Math.round(decisionTax * YEAR_END.localRate)
  const headroom = Math.max(
    0,
    grossTax - laborCredit - childCredit - pension.credit - specialCredit - standardCredit,
  )

  return {
    gross,
    earnedDeduction,
    earnedIncome,
    personalDeduction,
    insuranceDeduction,
    insuranceEstimated,
    card,
    taxableBase,
    grossTax,
    laborCredit,
    childCredit,
    pensionBase: pension.base,
    pensionRate: pension.rate,
    pensionLeft: pension.left,
    pensionCredit: pension.credit,
    medicalCredit,
    educationCredit,
    hometownCredit,
    rentCredit,
    specialCredit,
    standardApplied,
    standardCredit,
    creditsTotal,
    decisionTax,
    localTax,
    totalTax: decisionTax + localTax,
    headroom,
  }
}

/** 2026년 귀속 연말정산 공제·환급 시뮬레이션 */
export function calcYearEndTax(input: YearEndInput): YearEndResult {
  const core = computeYearEnd(input)
  const bare = computeYearEnd({
    ...input,
    cardCredit: 0,
    cardCheck: 0,
    cardMarket: 0,
    cardTransit: 0,
    pensionSavings: 0,
    pensionIrp: 0,
    hometown: 0,
    rentMonthly: 0,
    medical: 0,
    education: 0,
  })
  const saving = Math.max(0, bare.totalTax - core.totalTax)
  const paidTax = Math.max(0, Math.round(input.paidTax || 0))
  const actions: YearEndAction[] = []

  // 1) 연금계좌 남은 한도
  if (core.pensionLeft > 0) {
    const filled = computeYearEnd({
      ...input,
      pensionSavings: Math.max(0, input.pensionSavings),
      pensionIrp: YEAR_END.pension.totalLimit,
    })
    const gain = Math.max(0, core.totalTax - filled.totalTax)
    actions.push({
      key: 'pension',
      title: '연금저축·IRP 남은 한도 채우기',
      detail: `남은 한도 ${manwon(core.pensionLeft)} · 한도 900만 원 중 ${won(core.pensionBase)} 납입 · ${rateLabel(core.pensionRate)} 세액공제${
        gain < Math.round(core.pensionLeft * core.pensionRate) ? ' · 결정세액 한도에 걸려 일부만 반영' : ''
      }`,
      saving: gain,
    })
  } else {
    actions.push({
      key: 'pension',
      title: '연금저축·IRP 한도 900만 원 소진',
      detail: '이미 한도를 채웠습니다. 더 넣어도 세액공제는 늘지 않습니다.',
      saving: 0,
    })
  }

  // 2) 12월 결제수단 전환 (신용카드 → 체크카드·현금영수증)
  const spend = Math.max(0, Math.round(input.remainingSpend || 0))
  if (spend > 0) {
    const asCredit = computeYearEnd({ ...input, cardCredit: (input.cardCredit || 0) + spend })
    const asCheck = computeYearEnd({ ...input, cardCheck: (input.cardCheck || 0) + spend })
    const gain = Math.max(0, asCredit.totalTax - asCheck.totalTax)
    let detail: string
    if (core.card.used + spend <= core.card.threshold) {
      detail = '아직 총급여 25% 문턱을 넘지 않아 어느 카드로 써도 공제가 같습니다. 문턱을 넘긴 뒤부터 체크카드가 유리합니다.'
    } else if (core.card.limitLeft <= 0) {
      detail = '카드 소득공제 한도를 이미 채워 추가 공제가 없습니다. 전통시장·대중교통 지출만 추가 한도에 들어갑니다.'
    } else {
      detail = `체크카드·현금영수증 30% − 신용카드 15% = 차액 15%가 소득공제로 늘어납니다(한도 ${manwon(core.card.baseLimit + core.card.addLimit)}).`
    }
    actions.push({
      key: 'card',
      title: `12월 남은 지출 ${manwon(spend)}을 체크카드·현금영수증으로`,
      detail,
      saving: gain,
    })
  }

  // 3) 고향사랑기부금
  const target = Math.max(100000, Math.min(200000, Math.round(input.hometown || 0) || 0))
  if ((input.hometown || 0) < 200000) {
    const withDonation = computeYearEnd({ ...input, hometown: target })
    const gain = Math.max(0, core.totalTax - withDonation.totalTax)
    actions.push({
      key: 'hometown',
      title: `고향사랑기부 ${manwon(target)} (12월 31일까지)`,
      detail: `세액공제 ${won(calcHometownCredit(target))} + 답례품 ${manwon(target * 0.3)} 상당 · 결정세액이 0원이면 공제 효과가 없습니다.`,
      saving: gain,
    })
  }

  // 4) 부양가족 추가
  if ((input.dependents || 0) < 10) {
    const withDependent = computeYearEnd({ ...input, dependents: (input.dependents || 0) + 1 })
    const gain = Math.max(0, core.totalTax - withDependent.totalTax)
    actions.push({
      key: 'dependent',
      title: '부양가족 1명 추가 등록',
      detail: '기본공제 150만 원이 늘어납니다. 나이·소득 요건(연 소득금액 100만 원 이하)을 확인하세요.',
      saving: gain,
    })
  }

  // 5) 월세
  if (core.rentCredit > 0) {
    actions.push({
      key: 'rent',
      title: '월세 세액공제 서류 챙기기',
      detail: '주민등록표등본·임대차계약서·계좌이체 내역을 회사에 제출하면 위 금액이 결정세액에서 빠집니다.',
      saving: Math.round(core.rentCredit * (1 + YEAR_END.localRate)),
    })
  }

  // 6) 의료비·교육비
  if (core.medicalCredit > 0 || core.educationCredit > 0) {
    actions.push({
      key: 'medical',
      title: '연말정산 간소화에서 의료비·교육비 누락 확인',
      detail: `지금 반영된 세액공제 — 의료비 ${won(core.medicalCredit)} · 교육비 ${won(core.educationCredit)}`,
      saving: Math.round((core.medicalCredit + core.educationCredit) * (1 + YEAR_END.localRate)),
    })
  }

  actions.sort((a, b) => b.saving - a.saving)

  return {
    gross: core.gross,
    earnedDeduction: core.earnedDeduction,
    earnedIncome: core.earnedIncome,
    personalDeduction: core.personalDeduction,
    insuranceDeduction: core.insuranceDeduction,
    insuranceEstimated: core.insuranceEstimated,
    cardDeduction: core.card.deduction,
    taxableBase: core.taxableBase,
    grossTax: core.grossTax,
    laborCredit: core.laborCredit,
    childCredit: core.childCredit,
    pensionCredit: core.pensionCredit,
    pensionBase: core.pensionBase,
    pensionRate: core.pensionRate,
    pensionLeft: core.pensionLeft,
    medicalCredit: core.medicalCredit,
    educationCredit: core.educationCredit,
    hometownCredit: core.hometownCredit,
    rentCredit: core.rentCredit,
    specialCredit: core.specialCredit,
    standardApplied: core.standardApplied,
    standardCredit: core.standardCredit,
    creditsTotal: core.creditsTotal,
    decisionTax: core.decisionTax,
    localTax: core.localTax,
    totalTax: core.totalTax,
    baseTotalTax: bare.totalTax,
    saving,
    refund: paidTax > 0 ? paidTax - core.decisionTax : null,
    headroom: core.headroom,
    card: core.card,
    actions,
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

/** 0.165 같은 비율을 16.5% 로 표시한다 */
export function rateLabel(rate: number): string {
  return `${(Math.round((rate || 0) * 1000) / 10).toFixed(1)}%`
}

export function percent(value: number): string {
  return `${(Math.round((value || 0) * 10) / 10).toFixed(1)}%`
}
