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

console.log(failures ? `\n실패 ${failures}건` : '\n모든 계산 검증 통과')
process.exit(failures ? 1 : 0)
