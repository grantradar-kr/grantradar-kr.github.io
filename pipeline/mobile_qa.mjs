#!/usr/bin/env node
/**
 * 모바일 390x844 실측 검수 (라이브 사이트)
 *  - 가로 넘침(documentElement.scrollWidth <= innerWidth) 및 넘치는 요소 수집
 *  - 텍스트 잘림/겹침 휴리스틱, 주요 요소 노출 확인
 *  - 정적/앱 계산기 입력→결과 동작 확인
 *  - 정적 페이지 상단 '보조금 찾기' → #/onboarding 조건 선택 창 확인
 *  - 스크린샷 → work/grant_radar_app/qa-mobile/
 *
 * 실행: PATH=<node> node pipeline/mobile_qa.mjs
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const EXEC = process.env.CHROMIUM_PATH ||
  `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`
const SITE = process.env.SITE || 'https://grantradar-kr.github.io'
const OUT = path.resolve('qa-mobile')
fs.mkdirSync(OUT, { recursive: true })

const VIEWPORT = { width: 390, height: 844 }
const results = []
let failures = 0
const check = (pageName, label, ok, detail = '') => {
  if (!ok) failures += 1
  results.push(`${ok ? '✓' : '✗'} [${pageName}] ${label}${detail ? ` — ${detail}` : ''}`)
  console.log(`${ok ? '✓' : '✗'} [${pageName}] ${label}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const page = await context.newPage()
const consoleErrors = []
const failedRequests = []
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} (${r.failure()?.errorText})`))
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`)
})
page.on('pageerror', (e) => consoleErrors.push(`${page.name}: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
})

const measure = () =>
  page.evaluate(() => {
    const vw = window.innerWidth
    const doc = document.documentElement
    const offenders = []
    const all = document.querySelectorAll('body *')
    for (const el of all) {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') continue
      // 장식용(클릭 불가) 요소와 부모가 넘침을 잘라내는 요소는 실제로 화면 밖으로 새지 않는다
      if (style.pointerEvents === 'none') continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.right > vw + 1 || rect.left < -1) {
        // 부모가 가로 스크롤 컨테이너면 정상
        let p = el.parentElement
        let inScroller = false
        while (p && p !== document.body) {
          const ps = getComputedStyle(p)
          if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') {
            inScroller = true
            break
          }
          if (ps.overflow !== 'visible') {
            const pr = p.getBoundingClientRect()
            if (pr.right <= vw + 1) {
              inScroller = true // 조상이 잘라내고 있음 → 화면 밖으로 새지 않음
              break
            }
          }
          p = p.parentElement
        }
        if (inScroller) continue
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 60),
          right: Math.round(rect.right),
          left: Math.round(rect.left),
          text: (el.textContent || '').trim().slice(0, 40),
        })
      }
    }
    // 잘림 휴리스틱: overflow hidden 인데 내용이 넘치는 요소
    const clipped = []
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el)
      if ((el.className || '').toString().includes('line-clamp')) continue // 2줄 클램프는 의도된 디자인
      if (style.overflow === 'hidden' || style.overflowY === 'hidden') {
        if (el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0) {
          clipped.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 50),
            scrollH: el.scrollHeight,
            clientH: el.clientHeight,
            text: (el.textContent || '').trim().slice(0, 30),
          })
        }
      }
    }
    return {
      vw,
      docScrollWidth: doc.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders: offenders.slice(0, 6),
      offenderCount: offenders.length,
      clipped: clipped.slice(0, 6),
      textLen: (document.body.innerText || '').trim().length,
    }
  })

const shot = async (name, fullPage = true) => {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage })
  return file
}

const visit = async (url, waitMs = 2500) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(waitMs)
}

const auditLayout = async (name) => {
  const m = await measure()
  check(name, '가로 넘침 없음 (scrollWidth <= innerWidth)', m.docScrollWidth <= m.vw,
    `scrollWidth=${m.docScrollWidth} vw=${m.vw}`)
  check(name, '뷰포트 밖으로 나간 요소 없음', m.offenderCount === 0,
    m.offenderCount ? JSON.stringify(m.offenders) : '')
  check(name, 'overflow 잘림 요소 없음', m.clipped.length === 0,
    m.clipped.length ? JSON.stringify(m.clipped) : '')
  check(name, '본문 텍스트 렌더', m.textLen > 200, `textLen=${m.textLen}`)
  return m
}

const shots = []

// ---------------------------------------------------------------- 1) 홈
await visit(`${SITE}/`, 3500)
await shot('01-home-onboarding')
const onboardingVisible = await page.locator('[role="dialog"][aria-label="내 조건 설정"]').count()
check('home', '첫 방문 조건 선택 창 노출', onboardingVisible > 0)
check('home', '조건 선택 창 제목 문구', (await page.locator('[role="dialog"]').first().innerText()).includes('30초 만에 내 보조금 찾기'))

// 조건 입력 → 저장 (모바일 키패드/스크롤 동작 확인 겸)
const yearInput = page.locator('[role="dialog"] input[type="number"]').first()
await yearInput.fill('1994')
await page.waitForTimeout(300)
for (let i = 0; i < 3; i += 1) {
  const next = page.locator('[role="dialog"] button', { hasText: '다음' }).last()
  if (await next.count()) await next.click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(350)
}
const finish = page.locator('[role="dialog"] button', { hasText: '내 보조금 보기' }).last()
if (await finish.count()) await finish.click().catch(() => {})
await page.waitForTimeout(1500)
check('home', '조건 저장 후 모달 닫힘', (await page.locator('[role="dialog"][aria-label="내 조건 설정"]').count()) === 0)
shots.push(await shot('02-home'))
await auditLayout('home')

// ---------------------------------------------------------------- 2) 앱 계산기 허브
await visit(`${SITE}/#/calculators`, 2500)
check('app-calculators', '계산기 허브 제목 노출', (await page.locator('body').innerText()).includes('모의계산기'))
shots.push(await shot('03-app-calculators'))
await auditLayout('app-calculators')

// ---------------------------------------------------------------- 2-b) 앱 연말정산 시뮬레이터
await visit(`${SITE}/#/calculators/year-end-tax`, 2800)
{
  const appText = await page.locator('body').innerText()
  check('app-year-end', '절세 시뮬레이터 결과 노출', appText.includes('지금 챙기면 세금이'), '')
  check('app-year-end', '결정세액·카드 현황 노출', appText.includes('예상 결정세액') && appText.includes('총급여 25% 문턱'))
  check('app-year-end', '막판 절세 액션 노출', appText.includes('막판 절세 TOP 액션'))
  shots.push(await shot('09-app-year-end'))
  await auditLayout('app-year-end')
}

// ---------------------------------------------------------------- 3) 앱 가이드
await visit(`${SITE}/#/guides`, 2500)
check('app-guides', '가이드 목록 제목 노출', (await page.locator('body').innerText()).includes('신청 전에 읽는 보조금 가이드'))
shots.push(await shot('04-app-guides'))
await auditLayout('app-guides')

// ---------------------------------------------------------------- 4) 정적 계산기 허브 + 상단 '보조금 찾기' → #/onboarding
await visit(`${SITE}/calculators/`, 2000)
check('calculators-hub', '정적 허브 제목 노출', (await page.locator('body').innerText()).includes('모의계산기'))
shots.push(await shot('05-calculators-hub'))
await auditLayout('calculators-hub')

const navLink = page.locator('nav.top a', { hasText: '보조금 찾기' }).first()
check('calculators-hub', "상단 '보조금 찾기' 링크 존재", (await navLink.count()) > 0)
await navLink.click()
await page.waitForTimeout(2500)
check('calculators-hub', "'보조금 찾기' 클릭 → #/onboarding 진입", page.url().includes('#/onboarding'), page.url())
const deepDialog = page.locator('[role="dialog"][aria-label="내 조건 설정"]')
check('calculators-hub', '조건 선택 창이 바로 열림', (await deepDialog.count()) > 0)
const dialogText = (await deepDialog.count()) ? await deepDialog.innerText() : ''
// 이미 조건을 저장한 브라우저에서는 제목이 '내 조건 수정' 이다(첫 방문 문구는 fresh-visitor 검사에서 확인)
check('calculators-hub', "조건 창 제목 노출('내 조건 수정')", dialogText.includes('내 조건 수정'))
check('calculators-hub', '기본 정보 단계부터 시작', dialogText.includes('기본 정보') && dialogText.includes('출생연도'))
shots.push(await shot('06-onboarding-from-calculators'))
await auditLayout('onboarding-from-calculators')

// ---------------------------------------------------------------- 4-b) 신규 방문자: 정적 계산기 → '보조금 찾기' → 첫 조건 선택 창
{
  const fresh = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const freshPage = await fresh.newPage()
  await freshPage.goto(`${SITE}/calculators/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await freshPage.waitForTimeout(1500)
  await freshPage.locator('nav.top a', { hasText: '보조금 찾기' }).first().click()
  await freshPage.waitForTimeout(2500)
  const dlg = freshPage.locator('[role="dialog"][aria-label="내 조건 설정"]')
  const dlgText = (await dlg.count()) ? await dlg.innerText() : ''
  check('fresh-visitor', "'보조금 찾기' → #/onboarding", freshPage.url().includes('#/onboarding'), freshPage.url())
  check('fresh-visitor', '첫 조건 선택 창(30초 만에 내 보조금 찾기) 즉시 노출', dlgText.includes('30초 만에 내 보조금 찾기'))
  check('fresh-visitor', '기본 정보 단계 시작', dlgText.includes('출생연도'))
  const file = path.join(OUT, '08-fresh-onboarding-from-calculators.png')
  await freshPage.screenshot({ path: file, fullPage: false })
  shots.push(file)
  await fresh.close()
}

// ---------------------------------------------------------------- 5) 정적 계산기 3종 (입력 → 결과)
const calcCases = [
  { slug: 'year-end-tax', name: 'calc-year-end', marker: '막판 절세 TOP 액션' },
  { slug: 'median-income', name: 'calc-median', marker: '56.0%', after: '93.3%' },
  { slug: 'unemployment-benefit', name: 'calc-unemployment', marker: '66,048원' },
  { slug: 'eitc', name: 'calc-eitc', marker: '2,900,000원' },
]
for (const c of calcCases) {
  await visit(`${SITE}/calculators/${c.slug}.html`, 1800)
  const text = await page.locator('body').innerText()
  check(c.name, '기본 계산 결과 표시', text.includes(c.marker), `기대값 ${c.marker}`)
  check(c.name, "상단 '보조금 찾기' 링크 유지", (await page.locator('nav.top a', { hasText: '보조금 찾기' }).count()) > 0)
  const inputs = page.locator('input[type="number"]')
  if ((await inputs.count()) > 0) {
    await inputs.first().fill('5000000')
    await page.waitForTimeout(600)
    const after = await page.locator('body').innerText()
    if (c.after) {
      check(c.name, '입력 변경 → 재계산', after.includes(c.after), `기대값 ${c.after}`)
    } else {
      check(c.name, '입력 변경 → 결과 영역 갱신', after.replace(/\s/g, '') !== text.replace(/\s/g, ''))
    }
  }
  shots.push(await shot(`07-${c.name}`))
  await auditLayout(c.name)
}

// ---------------------------------------------------------------- 마무리
await browser.close()

const report = {
  viewport: VIEWPORT,
  takenAt: new Date().toISOString(),
  site: SITE,
  failures,
  consoleErrors: [...new Set(consoleErrors)].slice(0, 10),
  failedRequests: [...new Set(failedRequests)].slice(0, 10),
  screenshots: shots,
  results,
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1), 'utf8')
console.log(`\n스크린샷 ${shots.length}장 → ${OUT}`)
console.log(report.consoleErrors.length ? `콘솔 오류 ${report.consoleErrors.length}건: ${report.consoleErrors[0]}` : '콘솔 오류 없음')
if (failures) {
  console.log(`실패 ${failures}건`)
  process.exit(1)
}
console.log('모바일 390x844 검수 통과')
