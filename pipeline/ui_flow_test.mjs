/**
 * 사용자 흐름 테스트 (jsdom) — 카드 열기 · 저장 · 저장함 · 둘러보기 · 설정 이동을 실제 DOM 클릭으로 확인한다.
 *   npm run build && node pipeline/ui_flow_test.mjs
 */
import { JSDOM } from 'jsdom'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const distDir = path.resolve('dist')
const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
const dom = new JSDOM(html, { url: 'https://example.com/grant-radar/', pretendToBeVisual: true })
const { window } = dom

Object.assign(global, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  Element: window.Element,
  Node: window.Node,
  SVGElement: window.SVGElement,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  MutationObserver: window.MutationObserver,
  localStorage: window.localStorage,
  location: window.location,
  getComputedStyle: window.getComputedStyle,
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
})

// jsdom 은 scrollTo 를 구현하지 않아 콘솔 경고가 난다 — 앱 동작과 무관하므로 대체한다.
window.scrollTo = () => {}

global.fetch = async (input) => {
  const url = String(input)
  const file = path.join(distDir, url.replace(/^https?:\/\/[^/]+\//, '').replace(/^\.\//, ''))
  if (!fs.existsSync(file)) return { ok: false, status: 404, json: async () => null }
  const text = fs.readFileSync(file, 'utf8')
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text }
}
window.fetch = global.fetch

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const bodyText = () => window.document.body.textContent ?? ''
const errors = []
window.addEventListener('error', (event) => errors.push(String(event.error ?? event.message)))

const entry = fs.readdirSync(path.join(distDir, 'assets')).find((f) => f.startsWith('index-') && f.endsWith('.js'))
await import(pathToFileURL(path.join(distDir, 'assets', entry)).href)
await sleep(2000)

const findButton = (label) =>
  [...window.document.querySelectorAll('button, a')].find((el) => (el.textContent ?? '').trim().includes(label))

let failures = 0
const check = (name, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failures += 1
}

// 1) 첫 화면
check('홈 렌더', bodyText().includes('보조금 레이더'))
check('온보딩 자동 노출', bodyText().includes('30초 만에 내 보조금 찾기'))

// 2) 온보딩에서 조건 선택 → 완료
const startBtn = findButton('다음')
if (startBtn) {
  const yearInput = window.document.querySelector('input[type="number"]')
  if (yearInput) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(yearInput, String(new Date().getFullYear() - 34))
    yearInput.dispatchEvent(new window.Event('input', { bubbles: true }))
    await sleep(120)
  }
  findButton('다음')?.click()
  await sleep(200)
  findButton('다음')?.click()
  await sleep(200)
  findButton('다음')?.click()
  await sleep(200)
  findButton('내 보조금 보기')?.click()
  await sleep(600)
}
check('조건 저장 후 추천 화면', bodyText().includes('완벽 일치') || bodyText().includes('내 조건 추천'))
check('온보딩 닫힘', !bodyText().includes('내 보조금 보기'))

// 3) 카드 열기 → 상세 모달
const card = window.document.querySelector('article')
card?.click()
await sleep(500)
check('상세 모달 열림', bodyText().includes('신청 전 체크리스트'))
check('일치율 근거 표시', bodyText().includes('내 조건 일치율'))

// 4) 체크리스트 토글 → 저장
const checkItem = [...window.document.querySelectorAll('button')].find((el) => (el.textContent ?? '').includes('신청서 작성'))
checkItem?.click()
await sleep(400)
const saved = JSON.parse(window.localStorage.getItem('grantradar.saved.v1') ?? '[]')
check('체크리스트 저장', saved.length > 0 && Object.values(saved[0].checklist ?? {}).some(Boolean))

// 5) 모달 닫기 → 저장함
const closeBtn = window.document.querySelector('button[aria-label="닫기"]')
closeBtn?.click()
await sleep(400)
window.location.hash = '#/saved'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(500)
check('저장함에 항목 표시', bodyText().includes('저장한 보조금') && bodyText().includes('준비'))

// 6) 둘러보기
window.location.hash = '#/browse'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(600)
check('둘러보기 화면', bodyText().includes('분야별 · 생애주기별 보조금 전체 목록'))

// 7) 설정
window.location.hash = '#/settings'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(500)
check('설정 화면', bodyText().includes('내 조건') && bodyText().includes('개인정보처리방침'))

// 8) 프로필 저장 여부
const profile = JSON.parse(window.localStorage.getItem('grantradar.profile.v1') ?? 'null')
check('프로필 로컬 저장', Boolean(profile && profile.done && profile.birthYear))

// 9) 가이드 목록
window.location.hash = '#/guides'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(600)
check('가이드 목록', bodyText().includes('신청 전에 읽는 보조금 가이드') && bodyText().includes('기준중위소득'))

// 10) 가이드 상세
const guideCard = [...window.document.querySelectorAll('button')].find((el) =>
  (el.textContent ?? '').includes('기준중위소득·소득분위'),
)
guideCard?.click()
await sleep(700)
check('가이드 상세 본문', bodyText().includes('기준중위소득은 ‘중간 사람의 소득’이다') && bodyText().includes('2027년'))
check('가이드 표·출처 노출', bodyText().includes('가구원 수별 기준중위소득') && bodyText().includes('출처와 확인일'))

// 11) 서비스 소개
window.location.hash = '#/about'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(600)
check('서비스 소개', bodyText().includes('보조금 레이더는 이렇게 만들어집니다') && bodyText().includes('sasolution.edu@gmail.com'))

// 12) 광고: 설정 토글 없음 / 슬롯 ID 미설정 시 <ins> 미렌더
window.location.hash = '#/settings'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(400)
check('광고 끄기 토글 제거', !bodyText().includes('광고 표시'))
check('광고 슬롯 미설정 시 빈 ins 없음', window.document.querySelectorAll('ins.adsbygoogle').length === 0)

console.log(errors.length ? `런타임 오류 ${errors.length}건: ${errors[0]}` : '런타임 오류 없음')
if (errors.length || failures) process.exit(1)
console.log('모든 사용자 흐름 통과')
