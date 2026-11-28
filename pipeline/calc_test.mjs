/**
 * 모의계산기 검증 — (1) TS 계산 로직 단위 검증, (2) 정적 HTML 인라인 계산기 실측(jsdom).
 *   npx esbuild src/lib/calculators.ts --bundle --format=esm --outfile=pipeline/.cache/calculators.bundle.mjs
 *   node pipeline/calc_test.mjs
 *
 * 값은 2026-11-21 확인한 공식 기준(기준중위소득·구직급여 상하한·근로장려금 구간)으로 손계산한 기대값이다.
 */
import { JSDOM } from 'jsdom'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const calc = await import(pathToFileURL(path.resolve('pipeline/.cache/calculators.bundle.mjs')).href)

let failures = 0
const check = (name, actual, expected) => {
  const ok = String(actual) === String(expected)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — 기대 ${expected} / 실제 ${actual}`}`)
  if (!ok) failures += 1
}
const near = (name, actual, expected, tol = 1) => {
  const ok = Math.abs(Number(actual) - Number(expected)) <= tol
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — 기대 ${expected} / 실제 ${actual}`}`)
  if (!ok) failures += 1
}

console.log('=== 1) 기준중위소득 ===')
check('2026 4인 6,494,738', calc.medianIncome(2026, 4), 6494738)
check('2027 4인 6,929,885', calc.medianIncome(2027, 4), 6929885)
check('2026 7인 9,515,150', calc.medianIncome(2026, 7), 9515150)
check('2026 8인 = 7인 + (7인-6인)', calc.medianIncome(2026, 8), 9515150 + (9515150 - 8555952))

const m1 = calc.calcMedianIncome({ household: 3, monthlyIncome: 3000000, asset: 0, region: 'metro' })
check('3인 기준중위소득', m1.median2026, 5359036)
check('소득인정액(재산 없음)', m1.recognized, 3000000)
near('중위 대비 %', m1.ratio2026.toFixed(1), '56.0')
check('60% 기준선', m1.rows.find((r) => r.pct === 60).limit, Math.round(5359036 * 0.6))
check('60% 통과', m1.rows.find((r) => r.pct === 60).pass, true)
check('50% 미달', m1.rows.find((r) => r.pct === 50).pass, false)
check('통과 항목 수(60/100/120/150/180)', m1.passedLabels.length, 5)

const m2 = calc.calcMedianIncome({ household: 4, monthlyIncome: 6000000, asset: 20000000, region: 'metro' })
check('대도시 기본재산액 안 재산은 환산 0', m2.assetIncome, 0)
const m3 = calc.calcMedianIncome({ household: 1, monthlyIncome: 1000000, asset: 200000000, region: 'metro' })
check('초과 재산 월 환산 (2억-1.35억)×4%÷12', m3.assetIncome, Math.round(((200000000 - 135000000) * 0.04) / 12))

console.log('\n=== 2) 실업급여 ===')
const u1 = calc.calcUnemployment({ monthlyWage: 3000000, age: 34, band: '3to5', disabled: false, hoursPerDay: 8 })
check('기초일액 100,000', u1.baseDaily, 100000)
check('60% = 60,000', u1.rawDaily, 60000)
check('하한 66,048 적용', u1.daily, 66048)
check('하한 판정', u1.limit, 'min')
check('소정급여일수 180', u1.days, 180)
check('총액 11,888,640', u1.total, 11888640)
check('월 환산 1,981,440', u1.monthly, 1981440)

const u2 = calc.calcUnemployment({ monthlyWage: 4500000, age: 34, band: '3to5', disabled: false, hoursPerDay: 8 })
check('상한 68,100 적용', u2.daily, 68100)
check('상한 판정', u2.limit, 'max')
check('총액 12,258,000', u2.total, 12258000)

const u3 = calc.calcUnemployment({ monthlyWage: 4500000, age: 52, band: 'gte10', disabled: false, hoursPerDay: 8 })
check('50세 이상 10년 이상 270일', u3.days, 270)
check('장애인 없이 50세 이상 판정', u3.highAge, true)

const u4 = calc.calcUnemployment({ monthlyWage: 1200000, age: 40, band: 'lt1', disabled: true, hoursPerDay: 4 })
check('4시간 하한 33,024', u4.daily, 33024)
check('장애인 → 50세 이상 표', u4.days, 120)

console.log('\n=== 3) 근로·자녀장려금 ===')
const e1 = calc.calcEitc({ household: 'singleEarner', totalIncome: 20000000, children: 1, assetBand: 'under' })
check('홑벌이 2,000만 근로장려금 산정', e1.eitcBase, 1900000)
check('자녀 1명 100만', e1.childBase, 1000000)
check('정기 합계 2,900,000', e1.regularTotal, 2900000)
check('기한 후 5% 감액', e1.lateTotal, Math.round(2900000 * 0.95))

const e2 = calc.calcEitc({ household: 'single', totalIncome: 8000000, children: 0, assetBand: 'under' })
check('단독 800만 = 평탄구간 최대', e2.regularEitc, 1650000)
const e2b = calc.calcEitc({ household: 'single', totalIncome: 10000000, children: 0, assetBand: 'under' })
check('단독 1,000만은 점감구간(평탄 900만 초과)', e2b.regularEitc, Math.round(1650000 * (1 - (10000000 - 9000000) / (22000000 - 9000000))))

const e3 = calc.calcEitc({ household: 'singleEarner', totalIncome: 32000000, children: 0, assetBand: 'under' })
check('홑벌이 소득상한 도달 → 0원', e3.regularEitc, 0)

const e4 = calc.calcEitc({ household: 'dual', totalIncome: 20000000, children: 2, assetBand: 'mid' })
const e5 = calc.calcEitc({ household: 'dual', totalIncome: 20000000, children: 2, assetBand: 'under' })
check('재산 1.7~2.4억은 50% 감액', e4.regularTotal, Math.round(e5.regularTotal * 0.5))
check('재산 2.4억 이상 제외', calc.calcEitc({ household: 'dual', totalIncome: 20000000, children: 2, assetBand: 'over' }).regularTotal, 0)
check('단독가구 자녀장려금 0', calc.calcEitc({ household: 'single', totalIncome: 10000000, children: 2, assetBand: 'under' }).regularChild, 0)
check('자녀장려금 총소득 7,000만 이상 0', calc.calcEitc({ household: 'dual', totalIncome: 70000000, children: 2, assetBand: 'under' }).regularChild, 0)

console.log('\n=== 4) 월세 세액공제 ===')
const r1 = calc.calcRentCredit({ totalSalary: 48000000, monthlyRent: 700000, months: 12 })
check('17% 구간 판정', r1.rate, 0.17)
check('연간 월세 840만', r1.rentPaid, 8400000)
check('공제액 1,428,000', r1.credit, 1428000)
check('지방소득세 포함 1,570,800', r1.creditWithLocal, 1570800)
check('표준세액공제보다 유리', r1.beatsStandard, true)

const r2 = calc.calcRentCredit({ totalSalary: 65000000, monthlyRent: 700000, months: 12 })
check('6,500만은 15%', r2.rate, 0.15)
check('공제액 1,260,000', r2.credit, 1260000)

const r3 = calc.calcRentCredit({ totalSalary: 50000000, monthlyRent: 1000000, months: 12 })
check('한도 1,000만 적용', r3.rentBase, 10000000)
check('최대 공제 1,700,000', r3.credit, 1700000)

const r4 = calc.calcRentCredit({ totalSalary: 50000000, monthlyRent: 300000, months: 6 })
check('납부 6개월만 계산', r4.rentPaid, 1800000)
check('18만의 17% = 306,000', r4.credit, 306000)

const r5 = calc.calcRentCredit({ totalSalary: 90000000, monthlyRent: 700000, months: 12 })
check('총급여 8,000만 초과 → 0원', r5.credit, 0)
check('초과 판정', r5.overIncome, true)

const r6 = calc.calcRentCredit({ totalSalary: 50000000, monthlyRent: 400000, months: 12, highOtherIncome: true })
check('종합소득 4,500만 초과 → 15%', r6.rate, 0.15)

const r7 = calc.calcRentCredit({ totalSalary: 40000000, monthlyRent: 50000, months: 12 })
check('공제액 10만 2천은 표준세액공제보다 불리', r7.beatsStandard, false)

console.log('\n=== 4-b) 연말정산 절세 시뮬레이터 (2026년 귀속) ===')
check('근로소득공제 4,800만 → 12,150,000', calc.earnedIncomeDeduction(48000000), 12150000)
check('근로소득공제 3,000만 → 9,750,000', calc.earnedIncomeDeduction(30000000), 9750000)
check('근로소득공제 1억 5,000만 → 15,750,000', calc.earnedIncomeDeduction(150000000), 15750000)
check('근로소득공제 한도 2,000만', calc.earnedIncomeDeduction(500000000), 20000000)
check('기본세율 2,869.8만 산출세액', calc.grossIncomeTax(28698000), 3044700)
check('근로소득세액공제 한도 66만(총급여 4,800만)', calc.laborIncomeTaxCredit(48000000, 3044700), 660000)
check('자녀세액공제 1명 25만', calc.childTaxCredit(1), 250000)
check('자녀세액공제 2명 55만', calc.childTaxCredit(2), 550000)
check('자녀세액공제 3명 95만', calc.childTaxCredit(3), 950000)
check('자녀세액공제 4명 135만', calc.childTaxCredit(4), 1350000)

const cardA = calc.calcCardDeduction({ gross: 48000000, children: 0, credit: 12000000, check: 3000000, market: 0, transit: 600000 })
check('카드 문턱 1,200만', cardA.threshold, 12000000)
check('카드 소득공제 1,140,000', cardA.deduction, 1140000)
check('카드 기본 한도 300만', cardA.baseLimit, 3000000)
const cardB = calc.calcCardDeduction({ gross: 48000000, children: 2, credit: 12000000, check: 3000000, market: 0, transit: 600000 })
check('자녀 2명 기본 한도 400만', cardB.baseLimit, 4000000)
const cardC = calc.calcCardDeduction({ gross: 50000000, children: 0, credit: 12500000, check: 0, market: 0, transit: 0 })
check('문턱과 정확히 같으면 공제 0', cardC.deduction, 0)
const cardD = calc.calcCardDeduction({ gross: 80000000, children: 0, credit: 40000000, check: 0, market: 0, transit: 0 })
check('7,000만 초과 기본 한도 250만', cardD.baseLimit, 2500000)
check('한도 초과분은 우대 사용분 없으면 더해지지 않음', cardD.deduction, 2500000)
const cardE = calc.calcCardDeduction({ gross: 80000000, children: 0, credit: 40000000, check: 0, market: 1000000, transit: 0 })
check('전통시장 추가 한도 반영', cardE.deduction, 2500000 + 400000)

check('연금저축만 900만 → 600만 인정', calc.calcPensionCredit(48000000, 9000000, 0).base, 6000000)
check('IRP 900만 → 900만 인정', calc.calcPensionCredit(48000000, 0, 9000000).base, 9000000)
check('연금 900만 16.5% = 1,485,000', calc.calcPensionCredit(48000000, 6000000, 3000000).credit, 1485000)
check('총급여 6,000만은 13.2% = 1,188,000', calc.calcPensionCredit(60000000, 6000000, 3000000).credit, 1188000)

check('고향사랑 10만 → 100,000', calc.calcHometownCredit(100000), 100000)
check('고향사랑 20만 → 144,000', calc.calcHometownCredit(200000), 144000)
check('고향사랑 30만 → 160,500', calc.calcHometownCredit(300000), 160500)
check('고향사랑 100만 → 276,000', calc.calcHometownCredit(1000000), 276000)

const y1 = calc.calcYearEndTax({
  gross: 48000000, dependents: 0, children: 0, insurance: 0,
  cardCredit: 12000000, cardCheck: 3000000, cardMarket: 0, cardTransit: 600000,
  remainingSpend: 1000000, pensionSavings: 2000000, pensionIrp: 0, hometown: 0,
  rentMonthly: 700000, rentMonths: 12, medical: 1500000, education: 0, paidTax: 2400000,
})
check('4,800만 4대보험 추정 4,512,000', y1.insuranceDeduction, 4512000)
check('과세표준 28,698,000', y1.taxableBase, 28698000)
check('산출세액 3,044,700', y1.grossTax, 3044700)
check('월세 세액공제 1,428,000', y1.rentCredit, 1428000)
check('의료비 3% 초과분 15% = 9,000', y1.medicalCredit, 9000)
check('결정세액 617,700', y1.decisionTax, 617700)
check('지방소득세 포함 679,470', y1.totalTax, 679470)
check('공제 미적용 대비 절세 1,988,800', y1.saving, 1988800)
check('기납부 2,400,000 → 환급 1,782,300', y1.refund, 1782300)
check('연금 남은 한도 700만', y1.pensionLeft, 7000000)
check('TOP 액션 첫 항목은 월세', y1.actions[0].key, 'rent')

const y2 = calc.calcYearEndTax({
  gross: 30000000, dependents: 2, children: 1, insurance: 2400000,
  cardCredit: 6000000, cardCheck: 4000000, cardMarket: 1200000, cardTransit: 300000,
  remainingSpend: 800000, pensionSavings: 6000000, pensionIrp: 3000000, hometown: 100000,
  rentMonthly: 0, rentMonths: 0, medical: 400000, education: 3000000, paidTax: 0,
})
check('세액공제가 산출세액을 넘으면 결정세액 0', y2.decisionTax, 0)
check('결정세액 0이면 추가 절세 여력 0', y2.headroom, 0)
check('환급 미입력이면 null', y2.refund, null)

const y3 = calc.calcYearEndTax({
  gross: 20000000, dependents: 0, children: 0, insurance: 0,
  cardCredit: 0, cardCheck: 0, cardMarket: 0, cardTransit: 0,
  remainingSpend: 0, pensionSavings: 0, pensionIrp: 0, hometown: 0,
  rentMonthly: 0, rentMonths: 0, medical: 0, education: 0, paidTax: 0,
})
check('공제 없는 경우 표준세액공제 13만 적용', y3.standardApplied, true)
check('표준세액공제 반영 금액', y3.creditsTotal, y3.laborCredit + 130000)

console.log('\n=== 5) 정적 HTML 인라인 계산기 실측 ===')
const setValue = (window, id, value) => {
  const el = window.document.getElementById(id)
  if (!el) throw new Error(`#${id} 없음`)
  el.value = String(value)
  el.dispatchEvent(new window.Event('input', { bubbles: true }))
  el.dispatchEvent(new window.Event('change', { bubbles: true }))
}
const text = (window, id) => (window.document.getElementById(id)?.textContent ?? '').replace(/\s+/g, ' ').trim()

const open = (file) => {
  const html = fs.readFileSync(file, 'utf8')
  const dom = new JSDOM(html, { url: `https://grantradar-kr.github.io/calculators/${path.basename(file)}`, runScripts: 'dangerously', pretendToBeVisual: true })
  return dom.window
}

{
  const w = open('public/calculators/median-income.html')
  setValue(w, 'mn-house', 3)
  setValue(w, 'mn-income', 3000000)
  setValue(w, 'mn-asset', '')
  const out = text(w, 'mn-out')
  check('정적 중위소득: 5,359,036원 표시', out.includes('5,359,036원'), true)
  check('정적 중위소득: 56.0% 표시', out.includes('56.0%'), true)
  check('정적 중위소득: 60% 기준선 3,215,422원', out.includes('3,215,422원'), true)
  setValue(w, 'mn-house', 4)
  setValue(w, 'mn-income', 6500000)
  check('정적 중위소득 4인 전환', text(w, 'mn-out').includes('6,494,738원'), true)
  w.close()
}

{
  const w = open('public/calculators/unemployment-benefit.html')
  setValue(w, 'ub-wage', 3000000)
  setValue(w, 'ub-age', 34)
  const out = text(w, 'ub-out')
  check('정적 실업급여: 1일 66,048원', out.includes('66,048원'), true)
  check('정적 실업급여: 180일', out.includes('180일'), true)
  check('정적 실업급여: 총 11,888,640원', out.includes('11,888,640원'), true)
  setValue(w, 'ub-wage', 4500000)
  check('정적 실업급여 상한 68,100원', text(w, 'ub-out').includes('68,100원'), true)
  setValue(w, 'ub-age', 52)
  check('정적 실업급여 50세 이상 270일 아님(3~5년→210일)',
    text(w, 'ub-out').includes('210일'), true)
  w.close()
}

{
  const w = open('public/calculators/eitc.html')
  setValue(w, 'et-type', 'singleEarner')
  setValue(w, 'et-income', 20000000)
  setValue(w, 'et-children', 1)
  const out = text(w, 'et-out')
  check('정적 근로장려금: 합계 2,900,000원', out.includes('2,900,000원'), true)
  check('정적 근로장려금: 기한 후 2,755,000원', out.includes('2,755,000원'), true)
  setValue(w, 'et-asset', 'over')
  check('정적 근로장려금: 재산 초과 0원 안내', text(w, 'et-out').includes('0원'), true)
  w.close()
}

{
  const w = open('public/calculators/monthly-rent.html')
  setValue(w, 'mr-salary', 48000000)
  setValue(w, 'mr-rent', 700000)
  setValue(w, 'mr-months', 12)
  const out = text(w, 'mr-out')
  check('정적 월세: 17% 적용', out.includes('17%'), true)
  check('정적 월세: 1,428,000원', out.includes('1,428,000원'), true)
  check('정적 월세: 지방세 포함 1,570,800원', out.includes('1,570,800원'), true)
  setValue(w, 'mr-salary', 65000000)
  check('정적 월세: 15% 전환 1,260,000원', text(w, 'mr-out').includes('1,260,000원'), true)
  setValue(w, 'mr-salary', 90000000)
  check('정적 월세: 총급여 초과 안내', text(w, 'mr-out').includes('대상이 아닙니다'), true)
  w.close()
}

{
  const w = open('public/calculators/year-end-tax.html')
  setValue(w, 'ye-gross', 48000000)
  setValue(w, 'ye-dependents', 0)
  setValue(w, 'ye-children', 0)
  setValue(w, 'ye-insurance', '')
  setValue(w, 'ye-card-credit', 12000000)
  setValue(w, 'ye-card-check', 3000000)
  setValue(w, 'ye-card-market', 0)
  setValue(w, 'ye-card-transit', 600000)
  setValue(w, 'ye-remaining', 1000000)
  setValue(w, 'ye-pension-savings', 2000000)
  setValue(w, 'ye-pension-irp', 0)
  setValue(w, 'ye-hometown', 0)
  setValue(w, 'ye-rent', 700000)
  setValue(w, 'ye-months', 12)
  setValue(w, 'ye-medical', 1500000)
  setValue(w, 'ye-education', 0)
  setValue(w, 'ye-paid', 2400000)
  const out = text(w, 'ye-out')
  check('정적 연말정산: 절세 1,988,800원', out.includes('1,988,800원'), true)
  check('정적 연말정산: 결정세액 617,700원', out.includes('617,700원'), true)
  check('정적 연말정산: 환급 1,782,300원', out.includes('1,782,300원'), true)
  check('정적 연말정산: 카드 공제 1,140,000원', out.includes('1,140,000원'), true)
  check('정적 연말정산: 연금 세액공제 330,000원', out.includes('330,000원'), true)
  check('정적 연말정산: TOP 액션 노출', out.includes('막판 절세 TOP 액션'), true)
  setValue(w, 'ye-hometown', 100000)
  check('정적 연말정산: 고향사랑 10만 공제', text(w, 'ye-out').includes('고향사랑기부 100,000원'), true)
  setValue(w, 'ye-children', 2)
  check('정적 연말정산: 자녀 2명 반영', text(w, 'ye-out').includes('자녀 2명'), true)
  w.close()
}

console.log(failures ? `\n실패 ${failures}건` : '\n모든 계산 검증 통과')
process.exit(failures ? 1 : 0)
