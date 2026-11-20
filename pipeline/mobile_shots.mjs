#!/usr/bin/env node
/** 390x844 뷰포트 단위 스크린샷(눈으로 확인용) — qa-mobile/view/ */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const EXEC = process.env.CHROMIUM_PATH || `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`
const SITE = 'https://grantradar-kr.github.io'
const OUT = path.resolve('qa-mobile/view')
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const page = await ctx.newPage()

const pages = [
  { name: 'home', url: `${SITE}/` },
  { name: 'app-calculators', url: `${SITE}/#/calculators` },
  { name: 'app-guides', url: `${SITE}/#/guides` },
  { name: 'calculators-hub', url: `${SITE}/calculators/` },
  { name: 'calc-median', url: `${SITE}/calculators/median-income.html` },
  { name: 'calc-unemployment', url: `${SITE}/calculators/unemployment-benefit.html` },
  { name: 'calc-eitc', url: `${SITE}/calculators/eitc.html` },
]

for (const p of pages) {
  await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2200)
  // 첫 방문 온보딩 모달은 '30초' 화면 자체를 남긴다 (홈)
  await page.screenshot({ path: path.join(OUT, `${p.name}-1.png`) })
  await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 0.9)))
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(OUT, `${p.name}-2.png`) })
  await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 2.2)))
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(OUT, `${p.name}-3.png`) })
  console.log(`✓ ${p.name}`)
}

await browser.close()
console.log(`뷰포트 스크린샷 → ${OUT}`)
