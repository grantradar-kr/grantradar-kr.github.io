/**
 * 사용자 흐름 테스트 (jsdom) — 카드 열기 · 저장 · 저장함 · 둘러보기 · 설정 이동을 실제 DOM 클릭으로 확인한다.
 *   npm run build && node pipeline/ui_flow_test.mjs
 *
 * 상단 로그인·회원가입 노출은 비로그인(guest) 상태에서만 검사하므로,
 * Supabase 설정이 들어간 빌드로 돌려야 한다(운영 빌드와 동일한 조건).
 *   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=test-anon-key npm run build
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
  // Supabase 실시간 클라이언트가 생성 시 WebSocket 생성자를 찾는다 — jsdom 의 것을 넘긴다(연결은 하지 않음).
  WebSocket: window.WebSocket,
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

// 2-b) 상단 로그인 · 회원가입 버튼 (비로그인 게스트 상태)
const header = window.document.querySelector('header')
const headerSignin = header?.querySelector('[aria-label="로그인"]')
const headerSignup = header?.querySelector('[aria-label="회원가입"]')
check('상단에 로그인·회원가입 버튼 동시 노출', Boolean(headerSignin && headerSignup))
check('회원가입 버튼 강조 스타일(brand 배경)', (headerSignup?.getAttribute('class') ?? '').includes('bg-brand-700'))

// 모달의 제출 버튼 라벨 = 현재 탭 (btn-primary)
const submitLabel = () => {
  const btn = [...window.document.querySelectorAll('button')].find((el) =>
    (el.getAttribute('class') ?? '').includes('btn-primary'),
  )
  return btn ? (btn.textContent ?? '').trim() : null
}
const closeModal = () => window.document.querySelector('button[aria-label="닫기"]')?.click()

headerSignup?.click()
await sleep(350)
check('회원가입 클릭 → 회원가입 탭으로 열림', submitLabel() === '회원가입')
check('가입 선택 안내 문구 유지', bodyText().includes('가입은 선택이에요') && bodyText().includes('로그인 없이도'))
closeModal()
await sleep(300)
check('계정 모달 닫힘(가입 강제 없음)', submitLabel() === null)
check('닫은 뒤에도 추천 화면 유지', bodyText().includes('완벽 일치') || bodyText().includes('내 조건 추천'))

headerSignin?.click()
await sleep(350)
check('로그인 클릭 → 로그인 탭으로 열림', submitLabel() === '로그인')
const signupTab = [...window.document.querySelectorAll('button')].find(
  (el) => (el.getAttribute('class') ?? '').includes('flex-1') && (el.textContent ?? '').trim() === '회원가입',
)
signupTab?.click()
await sleep(250)
check('탭 전환으로 회원가입 모드 진입', submitLabel() === '회원가입')
closeModal()
await sleep(300)

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
check('설정 계정카드에 로그인·회원가입 병렬 노출', Boolean(window.document.querySelector('[aria-label="설정에서 로그인"]') && window.document.querySelector('[aria-label="설정에서 회원가입"]')))

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
check('서비스 소개', bodyText().includes('보조금 레이더는 이렇게 만들어집니다') && bodyText().includes('eldbs9180@gmail.com'))

// 12) 광고: 설정 토글 없음 / 슬롯 ID 미설정 시 <ins> 미렌더
window.location.hash = '#/settings'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(400)
check('광고 끄기 토글 제거', !bodyText().includes('광고 표시'))
check('광고 슬롯 미설정 시 빈 ins 없음', window.document.querySelectorAll('ins.adsbygoogle').length === 0)

// 13) 모의계산기 4종 (로그인 없이 동작)
window.location.hash = '#/calculators'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(500)
check('계산기 허브', bodyText().includes('내 숫자로 먼저 확인하는 모의계산기'))

const calcCard = findButton('기준중위소득 %')
calcCard?.click()
await sleep(500)
check('중위소득 계산기 열림', bodyText().includes('소득인정액(간이)') && bodyText().includes('급여별 기준선 통과 여부'))
check('중위소득 기본 결과(56.0%)', bodyText().includes('56.0%'))
const incomeInput = window.document.querySelector('input[type="number"]')
if (incomeInput) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(incomeInput, '5000000')
  incomeInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  await sleep(300)
}
check('소득 변경 시 재계산(93.3%)', bodyText().includes('93.3%'))
check('모의계산 고지 노출', bodyText().includes('참고용 모의계산'))

const unempTab = findButton('실업급여')
unempTab?.click()
await sleep(400)
check('실업급여 계산기 열림', bodyText().includes('소정급여일수') && bodyText().includes('1일 구직급여'))
check('실업급여 기본 결과(66,048원)', bodyText().includes('66,048원'))

const eitcTab = findButton('근로장려금')
eitcTab?.click()
await sleep(400)
check('근로장려금 계산기 열림', bodyText().includes('정기신청 예상 합계'))
check('기한 후 신청 비교 노출', bodyText().includes('기한 후 신청'))

const rentTab = findButton('월세 공제')
rentTab?.click()
await sleep(400)
check('월세 세액공제 계산기 열림', bodyText().includes('공제 대상 월세') && bodyText().includes('표준세액공제'))
check('월세 기본 결과(1,428,000원)', bodyText().includes('1,428,000원'))

// 14) 가이드 화면의 계산기 바로가기
window.location.hash = '#/guides'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(500)
check('가이드 화면 계산기 진입점', bodyText().includes('읽기 전에 계산부터'))
check('새 가이드 5편 목록 노출', bodyText().includes('2026 실업급여') && bodyText().includes('본인부담상한제'))

// 15) #/onboarding 딥링크 — 정적 페이지의 '보조금 찾기'가 조건 선택 창을 바로 띄운다
//     (이미 프로필을 저장한 상태 = 첫 실행 온보딩이 숨겨진 상태에서도 열려야 한다)
window.location.hash = '#/settings'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(300)
const onboardingDialog = () => window.document.querySelector('[role="dialog"][aria-label="내 조건 설정"]')
check('#/onboarding 전에는 조건 창 닫혀 있음', !onboardingDialog())
window.location.hash = '#/onboarding'
window.dispatchEvent(new window.Event('hashchange'))
await sleep(400)
check('#/onboarding 해시로 조건 선택 창 즉시 열림', Boolean(onboardingDialog()))
check('딥링크 진입 시 기본 정보 단계부터', bodyText().includes('기본 정보') && bodyText().includes('출생연도'))
onboardingDialog()?.querySelector('button[aria-label="닫기"]')?.click()
await sleep(400)
check('#/onboarding 닫으면 해시 #/home 정리', window.location.hash === '#/home')
check('#/onboarding 닫은 뒤 재열림 없음', !onboardingDialog())

console.log(errors.length ? `런타임 오류 ${errors.length}건: ${errors[0]}` : '런타임 오류 없음')
if (errors.length || failures) process.exit(1)
console.log('모든 사용자 흐름 통과')
// Supabase 자동 갱신·리얼타임 타이머가 남으면 프로세스가 끝나지 않으므로 명시적으로 종료한다.
process.exit(0)
