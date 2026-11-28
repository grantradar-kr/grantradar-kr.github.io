import { useMemo, useState, type ReactNode } from 'react'
import AdSlot from './AdSlot'
import {
  ASSET_BAND_LABEL,
  BASE_PROPERTY,
  CALC_DISCLAIMER,
  CALC_UPDATED,
  CHILD_CREDIT,
  EITC_PARAM,
  INSURED_BANDS,
  MEDIAN_THRESHOLDS,
  REGION_LABEL,
  RENT_CREDIT,
  calcEitc,
  calcMedianIncome,
  calcRentCredit,
  calcUnemployment,
  calcYearEndTax,
  manwon,
  percent,
  rateLabel,
  won,
  YEAR_END,
  YEAR_END_UPDATED,
  type AssetBand,
  type EitcHousehold,
  type InsuredBand,
  type RegionKey,
} from '../lib/calculators'

export type CalcKey = 'year-end-tax' | 'median-income' | 'unemployment-benefit' | 'eitc' | 'monthly-rent'

export const CALCULATORS: { key: CalcKey; title: string; short: string; emoji: string; summary: string }[] = [
  {
    key: 'year-end-tax',
    title: '2026 연말정산 절세 시뮬레이터',
    short: '연말정산',
    emoji: '🎄',
    summary:
      '총급여와 카드·연금·월세·의료비 내역을 넣으면 2026년 귀속 예상 결정세액과 환급액, 12월까지 챙길 막판 절세 액션을 금액과 함께 보여 줍니다.',
  },
  {
    key: 'median-income',
    title: '기준중위소득 % & 복지자격 판정기',
    short: '중위소득',
    emoji: '📊',
    summary: '가구원 수와 소득·재산으로 2026·2027 기준중위소득 대비 비율과 생계·의료·주거·교육급여 기준선을 한 번에 봅니다.',
  },
  {
    key: 'unemployment-benefit',
    title: '2026 실업급여(구직급여) 계산기',
    short: '실업급여',
    emoji: '🧾',
    summary: '퇴직 전 3개월 평균 월급과 나이·고용보험 가입기간으로 1일 구직급여(상·하한 적용)와 소정급여일수, 예상 총액을 계산합니다.',
  },
  {
    key: 'eitc',
    title: '2026 근로장려금·자녀장려금 계산기',
    short: '근로장려금',
    emoji: '💸',
    summary: '가구 유형과 부부합산 총급여, 부양자녀 수, 재산 구간으로 근로·자녀장려금 예상액과 재산 감액·기한 후 5% 감액을 비교합니다.',
  },
  {
    key: 'monthly-rent',
    title: '월세 세액공제 계산기 (2026년 귀속)',
    short: '월세 공제',
    emoji: '🏠',
    summary: '총급여와 월세로 연말정산 세액공제액을 17%·15% 함께 계산하고, 표준세액공제 13만 원과 비교해 유리한 쪽을 보여 줍니다.',
  },
]

const SOURCES: Record<CalcKey, { label: string; url: string }[]> = {
  'median-income': [
    { label: '보건복지부 — 2026년 기준 중위소득 고시', url: 'https://www.mohw.go.kr/board.es?act=view&bid=0026&list_no=1487112&mid=a10409020000' },
    { label: '보건복지부 — 수급자 선정기준(급여별 기준선)', url: 'https://www.mohw.go.kr/menu.es?mid=a10708010300' },
    { label: '복지로 — 복지서비스 모의계산', url: 'https://www.bokjiro.go.kr/' },
  ],
  'unemployment-benefit': [
    { label: '고용노동부 — 2026년 구직급여 상·하한 안내(1350 상담)', url: 'https://1350.moel.go.kr/rtmview.do?id=1000324861' },
    { label: '고용24 — 실업급여 제도 안내', url: 'https://www.work24.go.kr/' },
    { label: '고용보험 — 구직급여 모의계산', url: 'https://www.ei.go.kr/' },
  ],
  eitc: [
    { label: '국세청 — 근로·자녀장려금 제도 안내', url: 'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7783&mi=2224' },
    { label: '국세청 보도자료 — 2025년 귀속 신청·기한 후 신청', url: 'https://www.nts.go.kr/nts/na/ntt/selectNttInfo.do?mi=2201&nttSn=1355806' },
    { label: '국세청 홈택스 — 근로·자녀장려금', url: 'https://www.hometax.go.kr/' },
  ],
  'year-end-tax': [
    { label: '국세청 — 연말정산 종합 안내(소득공제·세액공제)', url: 'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7874&mi=2304' },
    { label: '국세청 — 과세표준 및 세율(근로소득공제)', url: 'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7871&mi=6503' },
    { label: '국세청 홈택스 — 연말정산 간소화 서비스', url: 'https://www.hometax.go.kr/' },
    { label: '정부24 — 고향사랑기부제 안내', url: 'https://www.gov.kr/' },
  ],
  'monthly-rent': [
    { label: '국세청 — 월세액 세액공제 안내', url: 'https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239025' },
    { label: '국세청 상담사례 — 월세세액공제 Q&A', url: 'https://call.nts.go.kr/call/qna/selectQnaInfo.do?ctgId=CTG11906&mi=1318' },
    { label: '국세청 — 연말정산 종합 안내', url: 'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7874&mi=2304' },
  ],
}

const RELATED: Record<CalcKey, { slug: string; title: string }[]> = {
  'median-income': [
    { slug: 'median-income', title: '기준중위소득·소득분위 계산법 (2026~2027)' },
    { slug: 'housing-benefits', title: '주거급여·청년월세·전세자금 비교' },
  ],
  'unemployment-benefit': [
    { slug: 'unemployment-benefit', title: '2026 실업급여 조건·수령액·신청 절차' },
    { slug: 'national-employment-support', title: '2026 국민취업지원제도 구직촉진수당' },
  ],
  eitc: [
    { slug: 'earned-income-tax-credit', title: '2026 근로장려금·자녀장려금 총정리' },
    { slug: 'rejection-reasons', title: '지원금 신청이 탈락하는 10가지 이유' },
  ],
  'monthly-rent': [
    { slug: 'monthly-rent-tax-credit', title: '월세 세액공제 17%·15% 조건' },
    { slug: 'year-end-tax-refund', title: '연말정산 환급금 언제 들어오나' },
  ],
  'year-end-tax': [
    { slug: 'year-end-tax-checklist', title: '12월 막판 절세 체크리스트' },
    { slug: 'card-deduction-guide', title: '신용카드 vs 체크카드 공제 황금비율' },
    { slug: 'year-end-tax-refund', title: '연말정산 환급금 언제 들어오나' },
  ],
}

interface Props {
  initial?: CalcKey
  onSelect: (key: CalcKey | null) => void
  onOpenGuide: (slug: string) => void
  onGoHome: () => void
  onToast?: (message: string) => void
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-bold text-ink-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10.5px] leading-snug text-ink-300">{hint}</span> : null}
    </label>
  )
}

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] font-semibold text-ink-900 outline-none transition focus:border-brand-500'

function NumberInput({
  value,
  onChange,
  placeholder,
  suffix,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  suffix?: string
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ''))}
        className={`${inputClass} ${suffix ? 'pr-10' : ''}`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-bold text-ink-300">
          {suffix}
        </span>
      ) : null}
    </div>
  )
}

function ResultBox({ children }: { children: ReactNode }) {
  return <div className="mt-3 rounded-2xl bg-brand-50/70 px-4 py-3.5 ring-1 ring-brand-100">{children}</div>
}

function Disclaimer({ calc }: { calc: CalcKey }) {
  return (
    <div className="mt-3 space-y-1.5">
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500">{CALC_DISCLAIMER}</p>
      <ul className="space-y-0.5 text-[10.5px] leading-relaxed text-ink-400">
        {SOURCES[calc].map((source) => (
          <li key={source.url}>
            ·{' '}
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-300 hover:text-brand-700">
              {source.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Links({ calc, onOpenGuide, onGoHome }: { calc: CalcKey; onOpenGuide: (slug: string) => void; onGoHome: () => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {RELATED[calc].map((item) => (
        <button
          key={item.slug}
          type="button"
          onClick={() => onOpenGuide(item.slug)}
          className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50"
        >
          {item.title} →
        </button>
      ))}
      <button
        type="button"
        onClick={onGoHome}
        className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold text-ink-600 ring-1 ring-slate-200 hover:bg-slate-50"
      >
        내 조건으로 공고 보기 →
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ 1) 기준중위소득 */
function MedianCalculator({ onOpenGuide, onGoHome }: { onOpenGuide: (slug: string) => void; onGoHome: () => void }) {
  const [household, setHousehold] = useState('3')
  const [income, setIncome] = useState('3000000')
  const [asset, setAsset] = useState('')
  const [region, setRegion] = useState<RegionKey>('metro')

  const result = useMemo(
    () =>
      calcMedianIncome({
        household: Number(household || 0),
        monthlyIncome: Number(income || 0),
        asset: Number(asset || 0),
        region,
      }),
    [household, income, asset, region],
  )

  const verdict = result.rows.filter((row) => row.pct <= 100).filter((row) => row.pass)

  return (
    <section className="card px-4 py-4">
      <h2 className="text-[16px] font-extrabold tracking-tight text-ink-900">📊 기준중위소득 % & 복지자격 판정기</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
        공고의 ‘중위소득 60% 이하’가 내 소득과 어떻게 대응하는지 계산합니다. 재산을 넣으면 소득인정액(간이)으로 판정합니다.
      </p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Field label="가구원 수" hint="주민등록등본상 생계·주거를 함께 하는 사람">
          <select value={household} onChange={(event) => setHousehold(event.target.value)} className={inputClass}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
              <option key={size} value={String(size)}>
                {size}인 가구
              </option>
            ))}
          </select>
        </Field>
        <Field label="월 세전소득 (원)" hint="근로·사업소득 합계. 4대보험·세금 떼기 전 금액">
          <NumberInput value={income} onChange={setIncome} placeholder="예: 3000000" suffix="원" />
        </Field>
        <Field label="일반재산 (원, 선택)" hint="전세보증금·집·토지 등. 모르면 비워 두세요">
          <NumberInput value={asset} onChange={setAsset} placeholder="예: 50000000" suffix="원" />
        </Field>
        <Field label="지역 구분" hint={`기본재산액 공제: ${REGION_LABEL.metro} ${manwon(BASE_PROPERTY.metro)}`}>
          <select value={region} onChange={(event) => setRegion(event.target.value as RegionKey)} className={inputClass}>
            <option value="metro">{REGION_LABEL.metro} (특별시·광역시 구, 특례시)</option>
            <option value="city">{REGION_LABEL.city} (도의 시, 세종)</option>
            <option value="rural">{REGION_LABEL.rural} (도의 군)</option>
          </select>
        </Field>
      </div>

      <ResultBox>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[11.5px] font-bold text-brand-800">2026년 기준 {Number(household) || 1}인 가구</p>
          <p className="text-[20px] font-black leading-none text-brand-900">{won(result.median2026)}</p>
          <p className="text-[11px] font-semibold text-brand-800/70">/월 (2027년 {won(result.median2027)})</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">소득인정액(간이)</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink-900">{won(result.recognized)}</p>
            <p className="mt-0.5 text-[10px] text-ink-300">재산 환산 {won(result.assetIncome)} 포함</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">2026 기준중위소득 대비</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-brand-800">{percent(result.ratio2026)}</p>
            <p className="mt-0.5 text-[10px] text-ink-300">2027년 기준으로는 {percent(result.ratio2027)}</p>
          </div>
        </div>

        <p className="mt-3 text-[11.5px] font-extrabold text-ink-700">급여별 기준선 통과 여부</p>
        <ul className="mt-1.5 space-y-1">
          {result.rows.map((row) => (
            <li key={row.label} className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-100">
              <span className={`w-[52px] shrink-0 text-[10.5px] font-black ${row.pass ? 'text-brand-700' : 'text-ink-300'}`}>
                {row.pass ? '통과' : '미달'}
              </span>
              <span className="min-w-0 flex-1 text-[11.5px] font-bold text-ink-800">
                {row.label}
                <span className="ml-1 text-[10.5px] font-semibold text-ink-400">중위 {row.pct}%</span>
              </span>
              <span className="shrink-0 text-[11px] font-bold text-ink-600">{won(row.limit)}</span>
              <span className="w-[52px] shrink-0 text-right text-[10px] font-semibold text-ink-300">
                {row.pass ? `−${won(Math.abs(row.gap)).replace('원', '')}` : `+${won(row.gap).replace('원', '')}`}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-2.5 text-[11.5px] leading-relaxed text-brand-900/90">
          {verdict.length
            ? `이 소득·재산이면 ${verdict.map((row) => row.label).join(' · ')} 기준선 안에 들어옵니다. 실제 판정은 소득인정액을 정밀 계산해 이뤄집니다.`
            : '중위 100% 기준선도 넘습니다. 청년·다자녀·사업자용 완화 기준이 있는지 공고문에서 확인해 보세요.'}
        </p>
      </ResultBox>

      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
        소득인정액(간이) = 월 소득 + max(0, 일반재산 − 기본재산액) × 4% ÷ 12 입니다. 실제 기초생활보장 심사에서는 근로소득공제(30%)와
        가구특성별 지출비용이 추가로 차감되어 소득인정액이 더 낮게 나오는 경우가 많습니다. 금융재산 2,000만 원 공제·부채 차감·자동차
        환산은 반영하지 않았습니다.
      </p>

      <Disclaimer calc="median-income" />
      <Links calc="median-income" onOpenGuide={onOpenGuide} onGoHome={onGoHome} />
    </section>
  )
}

/* ------------------------------------------------------------------ 2) 실업급여 */
function UnemploymentCalculator({ onOpenGuide, onGoHome }: { onOpenGuide: (slug: string) => void; onGoHome: () => void }) {
  const [wage, setWage] = useState('3000000')
  const [age, setAge] = useState('34')
  const [band, setBand] = useState<InsuredBand>('3to5')
  const [disabled, setDisabled] = useState(false)
  const [hours, setHours] = useState('8')

  const result = useMemo(
    () =>
      calcUnemployment({
        monthlyWage: Number(wage || 0),
        age: Number(age || 0),
        band,
        disabled,
        hoursPerDay: Number(hours || 8),
      }),
    [wage, age, band, disabled, hours],
  )

  const limitText =
    result.limit === 'max'
      ? `상한액 적용 (1일 ${won(result.limitValue)})`
      : result.limit === 'min'
        ? `하한액 적용 (1일 ${won(result.limitValue)})`
        : '상·하한 안쪽 (평균임금의 60%)'

  return (
    <section className="card px-4 py-4">
      <h2 className="text-[16px] font-extrabold tracking-tight text-ink-900">🧾 2026 실업급여(구직급여) 계산기</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
        2026년 1월 1일 이후 이직자 기준입니다(상한 1일 68,100원 · 하한 최저임금의 80%). 2025년 12월 31일 이전 이직자는 상한이
        66,000원이었습니다.
      </p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Field label="퇴직 전 3개월 평균 월급 (원)" hint="세전 기준. 상여금이 포함된 임금총액">
          <NumberInput value={wage} onChange={setWage} placeholder="예: 3000000" suffix="원" />
        </Field>
        <Field label="만 나이" hint="이직일(마지막 근로일) 기준 만 나이">
          <NumberInput value={age} onChange={setAge} placeholder="예: 34" suffix="세" />
        </Field>
        <Field label="고용보험 가입기간">
          <select value={band} onChange={(event) => setBand(event.target.value as InsuredBand)} className={inputClass}>
            {INSURED_BANDS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="1일 소정근로시간" hint="마지막 사업장 기준. 하한액이 시간에 비례합니다">
          <select value={hours} onChange={(event) => setHours(event.target.value)} className={inputClass}>
            {[8, 7, 6, 5, 4].map((hour) => (
              <option key={hour} value={String(hour)}>
                하루 {hour}시간
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="mt-2.5 flex items-center gap-2 text-[12px] font-bold text-ink-600">
        <input
          type="checkbox"
          checked={disabled}
          onChange={(event) => setDisabled(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-700"
        />
        장애인 (50세 이상과 같은 소정급여일수 적용)
      </label>

      <ResultBox>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[11.5px] font-bold text-brand-800">1일 구직급여</p>
          <p className="text-[20px] font-black leading-none text-brand-900">{won(result.daily)}</p>
          <p className="text-[11px] font-semibold text-brand-800/70">{limitText}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">소정급여일수</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink-900">{result.days}일</p>
            <p className="mt-0.5 text-[10px] text-ink-300">{result.highAge ? '50세 이상·장애인 기준' : '50세 미만 기준'}</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">예상 총 수령액</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-brand-800">{won(result.total)}</p>
            <p className="mt-0.5 text-[10px] text-ink-300">월 환산(30일) {won(result.monthly)}</p>
          </div>
        </div>

        <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-ink-600">
          <p>· 기초일액(평균임금 일액) {won(result.baseDaily)} × 60% = {won(result.rawDaily)}</p>
          <p>· 실제 지급은 실업인정(1~4주 단위)마다 이뤄지고, 7일 대기기간과 미인정일은 빠집니다.</p>
          <p>· 수급기간은 이직일 다음 날부터 12개월입니다. 남은 일수가 있어도 12개월이 지나면 지급되지 않습니다.</p>
        </div>
      </ResultBox>

      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
        기초일액은 편의상 ‘월평균임금 ÷ 30’으로 계산했습니다. 실제로는 이직 전 3개월 임금총액을 그 기간 총일수(89~92일)로 나누므로
        하루 1,000~2,000원 차이가 날 수 있습니다. 정확한 금액은 고용24의 ‘구직급여 모의계산’과 고용센터 심사로 확정됩니다.
      </p>

      <Disclaimer calc="unemployment-benefit" />
      <Links calc="unemployment-benefit" onOpenGuide={onOpenGuide} onGoHome={onGoHome} />
    </section>
  )
}

/* ------------------------------------------------------------------ 3) 근로·자녀장려금 */
function EitcCalculator({ onOpenGuide, onGoHome }: { onOpenGuide: (slug: string) => void; onGoHome: () => void }) {
  const [household, setHousehold] = useState<EitcHousehold>('singleEarner')
  const [income, setIncome] = useState('20000000')
  const [children, setChildren] = useState('1')
  const [assetBand, setAssetBand] = useState<AssetBand>('under')

  const result = useMemo(
    () =>
      calcEitc({
        household,
        totalIncome: Number(income || 0),
        children: Number(children || 0),
        assetBand,
      }),
    [household, income, children, assetBand],
  )

  const param = EITC_PARAM[household]

  return (
    <section className="card px-4 py-4">
      <h2 className="text-[16px] font-extrabold tracking-tight text-ink-900">💸 2026 근로장려금·자녀장려금 계산기</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
        2025년 귀속분(2026년 신청) 기준입니다. 기한 후 신청은 2026년 12월 1일까지이며 산정액의 95%가 지급됩니다.
      </p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Field label="가구 유형" hint={`${param.label} 소득상한 ${manwon(param.incomeCap)} 미만`}>
          <select value={household} onChange={(event) => setHousehold(event.target.value as EitcHousehold)} className={inputClass}>
            <option value="single">단독가구 (배우자·부양자녀 없음)</option>
            <option value="singleEarner">홑벌이가구</option>
            <option value="dual">맞벌이가구</option>
          </select>
        </Field>
        <Field label="부부합산 연간 총급여 (원)" hint="근로·사업소득 합계(비과세 제외)">
          <NumberInput value={income} onChange={setIncome} placeholder="예: 20000000" suffix="원" />
        </Field>
        <Field label="18세 미만 부양자녀 수" hint="자녀장려금은 1인당 50만~100만 원">
          <NumberInput value={children} onChange={setChildren} placeholder="예: 1" suffix="명" />
        </Field>
        <Field label="가구원 합산 재산" hint="2025년 6월 1일 기준 · 부채는 차감하지 않음">
          <select value={assetBand} onChange={(event) => setAssetBand(event.target.value as AssetBand)} className={inputClass}>
            <option value="under">{ASSET_BAND_LABEL.under}</option>
            <option value="mid">{ASSET_BAND_LABEL.mid} (50% 감액)</option>
            <option value="over">{ASSET_BAND_LABEL.over} (대상 제외)</option>
          </select>
        </Field>
      </div>

      <ResultBox>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[11.5px] font-bold text-brand-800">정기신청 예상 합계</p>
          <p className="text-[20px] font-black leading-none text-brand-900">{won(result.regularTotal)}</p>
          {result.assetFactor === 0.5 ? <p className="text-[11px] font-semibold text-rose-600">재산 50% 감액 반영</p> : null}
          {result.assetFactor === 0 ? <p className="text-[11px] font-semibold text-rose-600">재산 2.4억 이상 — 대상 제외</p> : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">근로장려금</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink-900">{won(result.regularEitc)}</p>
            <p className="mt-0.5 text-[10px] text-ink-300">산정액 {won(result.eitcBase)}</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">자녀장려금</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink-900">{won(result.regularChild)}</p>
            <p className="mt-0.5 text-[10px] text-ink-300">
              {household === 'single'
                ? '단독가구는 대상 아님'
                : `산정액 ${won(result.childBase)} (${Math.max(0, Number(children) || 0)}명)`}
            </p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-200">
            <p className="text-[10.5px] font-bold text-ink-400">정기신청 (5.1~6.1)</p>
            <p className="mt-0.5 text-[13.5px] font-extrabold text-ink-800">{won(result.regularTotal)}</p>
            <p className="text-[10px] text-ink-300">8월 지급</p>
          </div>
          <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-200">
            <p className="text-[10.5px] font-bold text-ink-400">기한 후 신청 (12.1까지)</p>
            <p className="mt-0.5 text-[13.5px] font-extrabold text-ink-800">{won(result.lateTotal)}</p>
            <p className="text-[10px] text-ink-300">5% 감액 · 다음 해 1월 지급</p>
          </div>
        </div>

        <p className="mt-2.5 text-[11.5px] leading-relaxed text-brand-900/90">
          {result.assetFactor === 0
            ? '재산 합계가 2억 4,000만 원 이상이면 근로·자녀장려금 대상에서 제외됩니다.'
            : result.regularTotal === 0
              ? `총급여가 소득상한(${manwon(result.incomeCap)})을 넘어 근로장려금은 0원입니다. 자녀장려금은 총소득 7,000만 원 미만이면 별도로 받을 수 있습니다.`
              : `자녀장려금은 총소득 7,000만 원 미만이면 근로장려금과 별개로 지급됩니다(자녀 1인당 ${won(CHILD_CREDIT.minPerChild)}~${won(CHILD_CREDIT.maxPerChild)}).`}
        </p>
      </ResultBox>

      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
        근로장려금은 점증·평탄·점감 구간으로 계산합니다. 2025년 귀속 기준 최대 지급액은 단독 165만·홑벌이 285만·맞벌이 330만 원이고,
        맞벌이 최대 지급 구간은 800만~1,700만 원입니다. 2027년 귀속분(2027년 신청)부터 소득상한과 최대 지급액을 올리는 세법개정안이
        추진 중입니다.
      </p>

      <Disclaimer calc="eitc" />
      <Links calc="eitc" onOpenGuide={onOpenGuide} onGoHome={onGoHome} />
    </section>
  )
}

/* ------------------------------------------------------------------ 4) 월세 세액공제 */
function RentCalculator({ onOpenGuide, onGoHome }: { onOpenGuide: (slug: string) => void; onGoHome: () => void }) {
  const [salary, setSalary] = useState('48000000')
  const [rent, setRent] = useState('700000')
  const [months, setMonths] = useState('12')
  const [highOtherIncome, setHighOtherIncome] = useState(false)

  const result = useMemo(
    () =>
      calcRentCredit({
        totalSalary: Number(salary || 0),
        monthlyRent: Number(rent || 0),
        months: Number(months || 0),
        highOtherIncome,
      }),
    [salary, rent, months, highOtherIncome],
  )

  const rateLabel = result.rate === RENT_CREDIT.rateHigh ? '17%' : '15%'

  return (
    <section className="card px-4 py-4">
      <h2 className="text-[16px] font-extrabold tracking-tight text-ink-900">🏠 월세 세액공제 계산기</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
        2026년 귀속(2027년 초 연말정산) 기준입니다. 총급여 8,000만 원 이하 무주택 세대주와 요건을 갖춘 세대원이 대상이고,
        공제 대상 월세는 연 1,000만 원까지입니다.
      </p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Field label="총급여 (연, 원)" hint="비과세 소득을 뺀 금액 · 5,500만 원 이하면 17%">
          <NumberInput value={salary} onChange={setSalary} placeholder="예: 48000000" suffix="원" />
        </Field>
        <Field label="월세 (월, 원)" hint="관리비·보증금 제외, 실제로 지급한 월세">
          <NumberInput value={rent} onChange={setRent} placeholder="예: 700000" suffix="원" />
        </Field>
        <Field label="납부 개월 수" hint="그해 실제로 월세를 낸 달만 계산합니다(최대 12개월)">
          <NumberInput value={months} onChange={setMonths} placeholder="예: 12" suffix="개월" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-1 text-[12px] font-bold text-ink-600">
          <input
            type="checkbox"
            checked={highOtherIncome}
            onChange={(event) => setHighOtherIncome(event.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          종합소득금액 4,500만 원 초과
        </label>
      </div>

      <ResultBox>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[11.5px] font-bold text-brand-800">예상 세액공제액</p>
          <p className="text-[20px] font-black leading-none text-brand-900">{won(result.credit)}</p>
          <p className="text-[11px] font-semibold text-brand-700">
            {result.overIncome ? '총급여 8,000만 원 초과 — 대상 아님' : `월세의 ${rateLabel}`}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">공제 대상 월세</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink-900">{won(result.rentBase)}</p>
            <p className="mt-0.5 text-[10px] text-ink-300">실제 납부 {won(result.rentPaid)}</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">지방소득세 포함</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink-900">{won(result.creditWithLocal)}</p>
            <p className="mt-0.5 text-[10px] text-ink-300">소득세의 10% 함께 감소</p>
          </div>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-brand-900/90">
          {result.overIncome
            ? '총급여가 8,000만 원을 넘으면 월세 세액공제 대상이 아닙니다. 부양가족 공제와 카드 소득공제를 먼저 확인하세요.'
            : result.beatsStandard
              ? `표준세액공제(13만 원)보다 ${won(result.credit - RENT_CREDIT.standardCredit)} 유리합니다. 다만 결정세액이 ${won(result.credit)}보다 적으면 그만큼만 공제됩니다.`
              : '공제액이 표준세액공제 13만 원보다 적습니다. 특별세액공제를 포기하고 표준세액공제를 받는 편이 유리할 수 있습니다.'}
        </p>
      </ResultBox>

      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
        공제 대상 월세는 연 1,000만 원까지이며, 납부 개월 수가 12개월을 넘으면 12개월로 계산합니다.
        2026년 지급분부터 무주택 주말부부는 부부 합산 1,000만 원 한도 안에서 각자 공제받을 수 있습니다.
      </p>

      <Disclaimer calc="monthly-rent" />
      <Links calc="monthly-rent" onOpenGuide={onOpenGuide} onGoHome={onGoHome} />
    </section>
  )
}

/* ------------------------------------------------------------------ 5) 연말정산 절세 시뮬레이터 */
function YearEndSimulator({ onOpenGuide, onGoHome }: { onOpenGuide: (slug: string) => void; onGoHome: () => void }) {
  const [gross, setGross] = useState('48000000')
  const [dependents, setDependents] = useState('0')
  const [children, setChildren] = useState('0')
  const [insurance, setInsurance] = useState('')
  const [cardCredit, setCardCredit] = useState('12000000')
  const [cardCheck, setCardCheck] = useState('3000000')
  const [cardMarket, setCardMarket] = useState('0')
  const [cardTransit, setCardTransit] = useState('600000')
  const [remainingSpend, setRemainingSpend] = useState('1000000')
  const [pensionSavings, setPensionSavings] = useState('2000000')
  const [pensionIrp, setPensionIrp] = useState('0')
  const [hometown, setHometown] = useState('0')
  const [rentMonthly, setRentMonthly] = useState('0')
  const [rentMonths, setRentMonths] = useState('12')
  const [medical, setMedical] = useState('0')
  const [education, setEducation] = useState('0')
  const [paidTax, setPaidTax] = useState('')

  const num = (value: string) => Number(value || 0)
  const result = useMemo(
    () =>
      calcYearEndTax({
        gross: num(gross),
        dependents: num(dependents),
        children: num(children),
        insurance: num(insurance),
        cardCredit: num(cardCredit),
        cardCheck: num(cardCheck),
        cardMarket: num(cardMarket),
        cardTransit: num(cardTransit),
        remainingSpend: num(remainingSpend),
        pensionSavings: num(pensionSavings),
        pensionIrp: num(pensionIrp),
        hometown: num(hometown),
        rentMonthly: num(rentMonthly),
        rentMonths: num(rentMonths),
        medical: num(medical),
        education: num(education),
        paidTax: num(paidTax),
      }),
    [
      gross,
      dependents,
      children,
      insurance,
      cardCredit,
      cardCheck,
      cardMarket,
      cardTransit,
      remainingSpend,
      pensionSavings,
      pensionIrp,
      hometown,
      rentMonthly,
      rentMonths,
      medical,
      education,
      paidTax,
    ],
  )

  const card = result.card
  const thresholdRate = card.threshold > 0 ? Math.min(100, Math.round((card.used / card.threshold) * 100)) : 0
  const topActions = result.actions.slice(0, 5)
  const sectionTitle = 'mt-4 text-[11.5px] font-extrabold text-brand-800'

  return (
    <section className="card px-4 py-4">
      <h2 className="text-[16px] font-extrabold tracking-tight text-ink-900">🎄 2026 연말정산 절세 시뮬레이터</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
        2026년 1~12월 소득·지출 기준(2027년 1~2월 연말정산)입니다. 총급여와 카드·연금·월세·의료비를 넣으면 예상 결정세액과
        환급액, 그리고 12월 31일 전에 챙겨야 할 항목을 금액과 함께 정리합니다.
      </p>

      <p className={sectionTitle}>1. 소득과 가족</p>
      <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
        <Field label="총급여 (연, 원)" hint="비과세(식대 등)를 뺀 금액. 원천징수영수증의 총급여">
          <NumberInput value={gross} onChange={setGross} placeholder="예: 48000000" suffix="원" />
        </Field>
        <Field label="부양가족 수 (본인 제외)" hint="기본공제 1인당 150만 원. 나이·소득 요건 확인">
          <NumberInput value={dependents} onChange={setDependents} placeholder="0" suffix="명" />
        </Field>
        <Field label="그중 9세 이상 자녀 수" hint="2026년 귀속은 9세 이상(2017년생 제외) · 1명 25만·2명 55만·3명 이상 95만 원">
          <NumberInput value={children} onChange={setChildren} placeholder="0" suffix="명" />
        </Field>
        <Field label="4대보험료 (연, 원)" hint="비우면 총급여의 9.4%로 추정합니다">
          <NumberInput value={insurance} onChange={setInsurance} placeholder="자동 추정" suffix="원" />
        </Field>
      </div>

      <p className={sectionTitle}>2. 카드 사용액 (올해 1~12월)</p>
      <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
        <Field label="신용카드" hint="전통시장·대중교통 사용분은 아래에 따로 넣으세요">
          <NumberInput value={cardCredit} onChange={setCardCredit} placeholder="예: 12000000" suffix="원" />
        </Field>
        <Field label="체크카드·현금영수증" hint="공제율 30%">
          <NumberInput value={cardCheck} onChange={setCardCheck} placeholder="예: 3000000" suffix="원" />
        </Field>
        <Field label="전통시장" hint="카드 종류와 관계없이 40%">
          <NumberInput value={cardMarket} onChange={setCardMarket} placeholder="0" suffix="원" />
        </Field>
        <Field label="대중교통" hint="버스·지하철·기차 40% (항공·택시 제외)">
          <NumberInput value={cardTransit} onChange={setCardTransit} placeholder="예: 600000" suffix="원" />
        </Field>
        <Field label="12월 남은 지출 예상액" hint="신용카드 대신 체크카드로 돌릴 수 있는 금액">
          <NumberInput value={remainingSpend} onChange={setRemainingSpend} placeholder="예: 1000000" suffix="원" />
        </Field>
      </div>

      <p className={sectionTitle}>3. 연금저축·IRP·고향사랑기부</p>
      <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
        <Field label="연금저축 납입액 (연, 원)" hint="한도 600만 원">
          <NumberInput value={pensionSavings} onChange={setPensionSavings} placeholder="예: 2000000" suffix="원" />
        </Field>
        <Field label="IRP 납입액 (연, 원)" hint="연금저축과 합산 900만 원 한도">
          <NumberInput value={pensionIrp} onChange={setPensionIrp} placeholder="예: 3000000" suffix="원" />
        </Field>
        <Field label="고향사랑기부금 (연, 원)" hint="10만 원까지 100% 세액공제 + 답례품 30%">
          <NumberInput value={hometown} onChange={setHometown} placeholder="예: 100000" suffix="원" />
        </Field>
      </div>

      <p className={sectionTitle}>4. 월세·의료비·교육비</p>
      <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
        <Field label="월세 (월, 원)" hint="무주택 세대주·세대원. 관리비 제외">
          <NumberInput value={rentMonthly} onChange={setRentMonthly} placeholder="예: 700000" suffix="원" />
        </Field>
        <Field label="월세 납부 개월 수" hint="최대 12개월">
          <NumberInput value={rentMonths} onChange={setRentMonths} placeholder="12" suffix="개월" />
        </Field>
        <Field label="의료비 지출액 (연, 원)" hint="총급여 3% 초과분의 15%. 일반 부양가족은 700만 원 한도">
          <NumberInput value={medical} onChange={setMedical} placeholder="예: 1500000" suffix="원" />
        </Field>
        <Field label="교육비 지출액 (연, 원)" hint="15%. 취학전·초중고 1인 300만 · 대학생 1인 900만 원 한도">
          <NumberInput value={education} onChange={setEducation} placeholder="예: 3000000" suffix="원" />
        </Field>
        <Field label="기납부 소득세 (연, 원, 선택)" hint="원천징수영수증의 기납부세액. 넣으면 환급액을 계산합니다">
          <NumberInput value={paidTax} onChange={setPaidTax} placeholder="모르면 비워 두세요" suffix="원" />
        </Field>
      </div>

      <ResultBox>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[11.5px] font-bold text-brand-800">지금 챙기면 세금이</p>
          <p className="text-[20px] font-black leading-none text-brand-900">{won(result.saving)}</p>
          <p className="text-[11px] font-semibold text-brand-800/70">줄어듭니다 (지방소득세 포함)</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">예상 결정세액 (소득세)</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink-900">{won(result.decisionTax)}</p>
            <p className="mt-0.5 text-[10px] text-ink-300">지방소득세 포함 {won(result.totalTax)}</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-brand-100">
            <p className="text-[10.5px] font-bold text-ink-400">
              {result.refund === null ? '공제를 하나도 못 챙겼다면' : '예상 환급액'}
            </p>
            <p className="mt-0.5 text-[15px] font-extrabold text-brand-800">
              {result.refund === null ? won(result.baseTotalTax) : won(Math.abs(result.refund))}
            </p>
            <p className="mt-0.5 text-[10px] text-ink-300">
              {result.refund === null
                ? '지방소득세 포함 세금'
                : result.refund >= 0
                  ? '기납부 − 결정세액 · 2월 급여 반영'
                  : '추가 납부 예상'}
            </p>
          </div>
        </div>

        <ul className="mt-2.5 space-y-0.5 text-[11px] leading-relaxed text-ink-700">
          <li className="flex justify-between gap-2"><span>근로소득공제</span><b>{won(result.earnedDeduction)}</b></li>
          <li className="flex justify-between gap-2"><span>인적공제 (본인 포함 {1 + num(dependents)}명)</span><b>{won(result.personalDeduction)}</b></li>
          <li className="flex justify-between gap-2">
            <span>
              4대보험료{result.insuranceEstimated ? ' (총급여 9.4% 추정)' : ''}
            </span>
            <b>{won(result.insuranceDeduction)}</b>
          </li>
          <li className="flex justify-between gap-2"><span>카드 등 소득공제</span><b>{won(result.cardDeduction)}</b></li>
          <li className="flex justify-between gap-2"><span>과세표준</span><b>{won(result.taxableBase)}</b></li>
          <li className="flex justify-between gap-2"><span>산출세액</span><b>{won(result.grossTax)}</b></li>
          <li className="flex justify-between gap-2"><span>세액공제 합계</span><b>−{won(result.creditsTotal)}</b></li>
          <li className="flex justify-between gap-2"><span>결정세액 (소득세)</span><b>{won(result.decisionTax)}</b></li>
        </ul>

        <div className="mt-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-brand-100">
          <p className="text-[11px] font-extrabold text-ink-800">💳 카드 소득공제 현황</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-600">
            총급여 25% 문턱 {won(card.threshold)} 중 {won(card.used)} 사용 ({thresholdRate}%) · 공제 {won(card.deduction)} · 남은 한도{' '}
            {won(card.limitLeft)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-600">
            {card.thresholdLeft > 0
              ? `문턱까지 ${won(card.thresholdLeft)} 남았습니다. 그 전까지는 어떤 카드로 써도 공제가 같고, 넘긴 뒤부터 공제율 30%인 체크카드·현금영수증이 유리합니다.`
              : card.limitLeft <= 0
                ? '공제 한도를 이미 채웠습니다. 추가 지출은 전통시장·대중교통만 추가 한도에 반영됩니다.'
                : '문턱을 넘었습니다. 남은 결제는 체크카드·현금영수증(30%), 전통시장·대중교통(40%)이 신용카드(15%)보다 공제가 큽니다.'}
          </p>
          <p className="mt-1 text-[10.5px] text-ink-300">
            기본 한도 {won(card.baseLimit)} (자녀 {num(children)}명 반영) · 추가 한도 {won(card.addLimit)}
          </p>
        </div>

        <div className="mt-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-brand-100">
          <p className="text-[11px] font-extrabold text-ink-800">🏦 연금계좌·월세</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-600">
            연금저축·IRP {won(result.pensionBase)} / 900만 원 · {rateLabel(result.pensionRate)} 세액공제 {won(result.pensionCredit)}
            {result.pensionLeft > 0 ? ` · 남은 한도 ${won(result.pensionLeft)}` : ' · 한도 소진'}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-600">
            월세 세액공제 {won(result.rentCredit)} · 의료비 {won(result.medicalCredit)} · 교육비 {won(result.educationCredit)} · 고향사랑기부{' '}
            {won(result.hometownCredit)}
          </p>
          {result.standardApplied ? (
            <p className="mt-1 text-[10.5px] text-ink-400">
              특별세액공제 합계가 13만 원보다 적어 표준세액공제 13만 원을 적용했습니다.
            </p>
          ) : null}
        </div>

        {result.headroom === 0 ? (
          <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] font-bold text-rose-700 ring-1 ring-rose-100">
            결정세액이 이미 0원입니다. 이 상태에서 공제를 더 챙겨도 환급액은 늘지 않으니, 연금 납입은 노후 목적으로만 판단하세요.
          </p>
        ) : null}

        <p className="mt-3 text-[11.5px] font-extrabold text-ink-700">12월 31일 전에 챙기면 이득인 막판 절세 TOP 액션</p>
        <ul className="mt-1.5 space-y-1">
          {topActions.map((action, index) => (
            <li key={action.key} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0 text-[10.5px] font-black text-brand-700">{index + 1}</span>
                <span className="min-w-0 flex-1 text-[11.5px] font-bold leading-snug text-ink-800">{action.title}</span>
                <span className="shrink-0 text-[11.5px] font-extrabold text-brand-800">
                  {action.saving > 0 ? `+${won(action.saving)}` : '—'}
                </span>
              </div>
              <p className="mt-0.5 pl-4 text-[10.5px] leading-relaxed text-ink-400">{action.detail}</p>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-[10.5px] leading-relaxed text-brand-900/80">
          절세액은 공제를 하나도 챙기지 않았을 때와 비교한 소득세 + 지방소득세 감소분입니다. 실제 환급액은 회사가 원천징수한
          세액과 최종 결정세액의 차이로 확정됩니다.
        </p>
      </ResultBox>

      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
        4대보험료를 비우면 총급여의 {rateLabel(YEAR_END.insuranceRate)}로 추정합니다. 보장성 보험료(연 100만 원 한도·12%), 기부금,
        주택자금 공제는 반영하지 않았으니 원천징수영수증과 차이가 날 수 있습니다. 기준일 {YEAR_END_UPDATED}.
      </p>

      <Disclaimer calc="year-end-tax" />
      <Links calc="year-end-tax" onOpenGuide={onOpenGuide} onGoHome={onGoHome} />
    </section>
  )
}

/* ------------------------------------------------------------------ 목록·라우팅 */
export default function CalculatorsScreen({ initial, onSelect, onOpenGuide, onGoHome }: Props) {
  const active: CalcKey | null = initial ?? null

  if (active) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => onSelect(null)} className="text-[12.5px] font-bold text-brand-700 hover:underline">
          ← 계산기 5종
        </button>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {CALCULATORS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`chip shrink-0 ${active === item.key ? 'chip-active' : 'chip-idle'}`}
            >
              {item.emoji} {item.short}
            </button>
          ))}
        </div>
        {active === 'median-income' ? <MedianCalculator onOpenGuide={onOpenGuide} onGoHome={onGoHome} /> : null}
        {active === 'year-end-tax' ? <YearEndSimulator onOpenGuide={onOpenGuide} onGoHome={onGoHome} /> : null}
        {active === 'unemployment-benefit' ? <UnemploymentCalculator onOpenGuide={onOpenGuide} onGoHome={onGoHome} /> : null}
        {active === 'eitc' ? <EitcCalculator onOpenGuide={onOpenGuide} onGoHome={onGoHome} /> : null}
        {active === 'monthly-rent' ? <RentCalculator onOpenGuide={onOpenGuide} onGoHome={onGoHome} /> : null}
        <p className="text-[10.5px] text-ink-300">기준 확인일 {CALC_UPDATED} · 보조금 레이더 편집</p>
        <AdSlot label="광고" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-brand-800 px-5 py-5 text-white shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-100">Calculators · 기준일 {YEAR_END_UPDATED}</p>
        <h1 className="mt-1.5 text-[21px] font-extrabold leading-snug tracking-tight">내 숫자로 먼저 확인하는 모의계산기</h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/75">
          로그인 없이 바로 계산합니다. 입력값은 기기에 저장하지 않고 서버로 보내지도 않습니다.
        </p>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-3.5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber-700">2026 연말정산 시즌</p>
        <h2 className="mt-0.5 text-[14px] font-extrabold leading-snug text-ink-900">
          🎄 연말정산 절세 시뮬레이터 &amp; 12월 막판 체크리스트
        </h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
          12월 31일까지 챙겨야 하는 연금저축·IRP 납입, 고향사랑기부, 카드 결제수단 전환을 내 숫자로 확인하세요.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSelect('year-end-tax')}
            className="rounded-full bg-ink-900 px-3.5 py-1.5 text-[11.5px] font-extrabold text-white hover:bg-ink-800"
          >
            절세 시뮬레이터 열기 →
          </button>
          <button
            type="button"
            onClick={() => onOpenGuide('year-end-tax-checklist')}
            className="rounded-full bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-ink-700 ring-1 ring-amber-200 hover:bg-amber-50"
          >
            12월 체크리스트
          </button>
          <button
            type="button"
            onClick={() => onOpenGuide('card-deduction-guide')}
            className="rounded-full bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-ink-700 ring-1 ring-amber-200 hover:bg-amber-50"
          >
            카드 공제 황금비율
          </button>
        </div>
      </section>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {CALCULATORS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className="card flex h-full flex-col px-4 py-3.5 text-left transition hover:ring-brand-200"
          >
            <span className="text-[20px]">{item.emoji}</span>
            <p className="mt-1.5 text-[13.5px] font-extrabold leading-snug text-ink-900">{item.title}</p>
            <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-ink-500">{item.summary}</p>
            <span className="mt-2.5 text-[11.5px] font-bold text-brand-700">계산하기 →</span>
          </button>
        ))}
      </div>

      <section className="card px-4 py-3.5">
        <h2 className="text-[13.5px] font-extrabold text-ink-900">계산에 쓴 2026년 기준값</h2>
        <ul className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-ink-600">
          <li>· 기준중위소득 3인 {won(5359036)} · 4인 {won(6494738)} (2027년 4인 {won(6929885)})</li>
          <li>· 기본재산액 대도시 1억 3,500만 원 · 중소도시 8,500만 원 · 농어촌 7,250만 원</li>
          <li>· 구직급여 상한 1일 {won(68100)} · 하한 최저임금 {won(10320)}의 80%</li>
          <li>· 근로장려금 최대 단독 165만 · 홑벌이 285만 · 맞벌이 330만 원</li>
          <li>· 월세 세액공제 한도 연 1,000만 원 · 17%(총급여 5,500만 원 이하) 또는 15%</li>
          <li>· 연말정산 연금계좌 900만 원 · 16.5%·13.2% / 카드 소득공제 신용 15%·체크 30%·전통시장·대중교통 40%</li>
        </ul>
        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500">{CALC_DISCLAIMER}</p>
      </section>

      <section className="card px-4 py-3.5">
        <h2 className="text-[13.5px] font-extrabold text-ink-900">계산기별 기준선 요약</h2>
        <div className="mt-2 space-y-2">
          <div>
            <p className="text-[11.5px] font-bold text-ink-700">기준중위소득 비율</p>
            <p className="text-[11px] text-ink-500">
              {MEDIAN_THRESHOLDS.map((item) => `${item.label} ${item.pct}%`).join(' · ')}
            </p>
          </div>
          <div>
            <p className="text-[11.5px] font-bold text-ink-700">가구별 근로장려금 소득상한</p>
            <p className="text-[11px] text-ink-500">
              {Object.values(EITC_PARAM)
                .map((item) => `${item.label} ${manwon(item.incomeCap)}`)
                .join(' · ')}
            </p>
          </div>
        </div>
      </section>

      <AdSlot label="광고" />
    </div>
  )
}
