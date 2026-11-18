/**
 * 렌더 스모크 테스트 (jsdom) — 실제 빌드 산출물을 DOM에 마운트해 런타임 오류를 잡는다.
 *   npm run build
 *   node pipeline/smoke_test.mjs
 */
import { JSDOM } from 'jsdom'
import fs from 'node:fs'
import path from 'node:path'

const distDir = path.resolve('dist')
const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')

const dom = new JSDOM(html, {
  url: 'https://example.com/grant-radar/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
})

const { window } = dom
global.window = window
global.document = window.document
global.navigator = window.navigator
global.HTMLElement = window.HTMLElement
global.Element = window.Element
global.Node = window.Node
global.Event = window.Event
global.CustomEvent = window.CustomEvent
global.getComputedStyle = window.getComputedStyle
global.MutationObserver = window.MutationObserver
global.localStorage = window.localStorage
global.location = window.location
global.HTMLInputElement = window.HTMLInputElement
global.SVGElement = window.SVGElement
global.DocumentFragment = window.DocumentFragment
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)
global.IS_REACT_ACT_ENVIRONMENT = false

// fetch 스텁: public/data 파일을 실제로 읽어 응답
global.fetch = async (input) => {
  const url = String(input)
  const file = path.join(distDir, url.replace(/^https?:\/\/[^/]+\//, '').replace(/^\.\//, ''))
  if (!fs.existsSync(file)) return { ok: false, status: 404, json: async () => null }
  const text = fs.readFileSync(file, 'utf8')
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(text),
    text: async () => text,
  }
}
window.fetch = global.fetch

const errors = []
window.addEventListener('error', (event) => errors.push(event.error ?? event.message))

const bundleDir = path.join(distDir, 'assets')
const entry = fs.readdirSync(bundleDir).find((file) => file.startsWith('index-') && file.endsWith('.js'))
if (!entry) {
  console.error('빌드 산출물에서 index-*.js 를 찾지 못했습니다. npm run build 를 먼저 실행하세요.')
  process.exit(1)
}

await import(pathToFileURL(path.join(bundleDir, entry)).href)

function pathToFileURL(p) {
  return new URL(`file://${path.resolve(p)}`)
}

// 렌더가 끝날 때까지 대기
await new Promise((resolve) => setTimeout(resolve, 2500))

const root = window.document.getElementById('root')
const text = root ? root.textContent ?? '' : ''
const html2 = root ? root.innerHTML : ''

console.log('--- 렌더 스모크 테스트 ---')
console.log('root 자식 노드 수:', root ? root.children.length : 0)
console.log('본문 길이:', text.length)
console.log('브랜드 노출:', text.includes('보조금 레이더'))
console.log('히어로 노출:', text.includes('30초면 찾습니다') || text.includes('내 조건에 맞는'))
console.log('카드 개수(article):', (html2.match(/<article/g) ?? []).length)
console.log('하단 고지 노출:', text.includes('민간 정보 매칭 플랫폼'))
console.log('탭 노출:', ['추천', '둘러보기', '저장함', '설정'].every((label) => text.includes(label)))
console.log('온보딩 모달 노출:', text.includes('30초 만에 내 보조금 찾기'))
if (errors.length) {
  console.error('런타임 오류:', errors)
  process.exit(2)
}
if (!text.includes('보조금 레이더') || text.length < 500) {
  console.error('화면이 충분히 렌더되지 않았습니다.')
  process.exit(3)
}
console.log('OK — 런타임 오류 없이 렌더되었습니다.')
