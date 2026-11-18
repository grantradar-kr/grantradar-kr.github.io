/**
 * 일치율 엔진 실데이터 검증 스크립트
 *   npx esbuild src/lib/matcher.ts --bundle --format=esm --outfile=pipeline/.cache/matcher.bundle.mjs
 *   node pipeline/verify_matcher.mjs
 *
 * - 7개 페르소나(영유아 부모·청년 구직자·중장년 자영업·노인·임산부 프리랜서·예술인·장애인)로
 *   완벽 일치/조건 확인/마감 임박 건수를 실측한다.
 * - 성별·지역 하드 필터가 새는지(오탐) 확인한다.
 */
import { judge } from './.cache/matcher.bundle.mjs'
import fs from 'node:fs'

const policies = JSON.parse(fs.readFileSync(new URL('../public/data/policies.json', import.meta.url), 'utf8'))
const year = new Date().getFullYear()

const personas = [
  {
    name: '34세 여성 · 경기 · 직장인 · 기혼 · 무주택',
    p: { gender: 'female', birthYear: year - 34, region: '경기', jobs: ['employee'], households: ['married', 'homeless'], domains: ['housing', 'finance'], income: 'unknown', done: true },
  },
  {
    name: '28세 남성 · 서울 · 구직자 · 1인가구',
    p: { gender: 'male', birthYear: year - 28, region: '서울', jobs: ['jobseeker'], households: ['single'], domains: ['employment', 'finance'], income: 'unknown', done: true },
  },
  {
    name: '45세 여성 · 부산 · 자영업 · 한부모',
    p: { gender: 'female', birthYear: year - 45, region: '부산', jobs: ['self_employed'], households: ['single_parent'], domains: ['business', 'childcare'], income: 'middle', done: true },
  },
  {
    name: '67세 남성 · 전남 · 노인 · 저소득',
    p: { gender: 'male', birthYear: year - 67, region: '전남', jobs: [], households: ['low_income'], domains: ['senior_welfare', 'medical'], income: 'low', done: true },
  },
  {
    name: '32세 여성 · 서울 · 프리랜서 · 임산부',
    p: { gender: 'female', birthYear: year - 32, region: '서울', jobs: ['freelancer'], households: ['pregnant'], domains: ['childcare', 'medical'], income: 'middle', done: true },
  },
  {
    name: '41세 남성 · 인천 · 예술인 · 저소득',
    p: { gender: 'male', birthYear: year - 41, region: '인천', jobs: ['artist'], households: ['low_income'], domains: ['finance'], income: 'low', done: true },
  },
  {
    name: '52세 여성 · 대구 · 장애인',
    p: { gender: 'female', birthYear: year - 52, region: '대구', jobs: [], households: ['disabled'], domains: ['medical', 'housing'], income: 'low', done: true },
  },
]

for (const { name, p } of personas) {
  const scored = policies.map((policy) => ({ policy, j: judge(policy, p) }))
  const perfect = scored.filter((s) => s.j.verdict === 'perfect')
  const check = scored.filter((s) => s.j.verdict === 'check')
  const urgent = scored.filter((s) => s.j.urgent)
  perfect.sort((a, b) => b.j.score - a.j.score)
  console.log(`\n=== ${name} : 완벽일치 ${perfect.length} / 확인필요 ${check.length} / 마감임박 ${urgent.length}`)
  for (const s of perfect.slice(0, 4)) {
    console.log(`  [${s.j.score}%] ${s.policy.title.slice(0, 44)} | ${s.policy.source} | ${s.j.reasons.slice(0, 2).join(' / ')}`)
  }
}

const femaleOnly = policies.filter((p) => p.match.gender === 'female')
const maleLeak = femaleOnly.filter((p) => judge(p, personas[1].p).verdict === 'perfect')
console.log(`\n[검증] 여성 전용 ${femaleOnly.length}건 → 남성 프로필 '완벽일치' 오탐: ${maleLeak.length}건`)

const otherRegion = policies.filter((p) => p.match.regions && !p.match.regions.includes('전국') && !p.match.regions.includes('서울'))
const regionLeak = otherRegion.filter((p) => judge(p, personas[1].p).verdict === 'perfect')
console.log(`[검증] 타지역 전용 ${otherRegion.length}건 → 서울 프로필 '완벽일치' 오탐: ${regionLeak.length}건`)

const seniorTop = policies
  .map((policy) => ({ policy, j: judge(policy, personas[3].p) }))
  .filter((s) => s.j.verdict === 'perfect')
  .sort((a, b) => b.j.score - a.j.score)
  .slice(0, 5)
console.log(`[검증] 67세 노인 프로필 상위 5건:`)
seniorTop.forEach((s) => console.log(`   - ${s.policy.title.slice(0, 40)} (${s.policy.source})`))
console.log(`\n총 정책 ${policies.length}건 로드 완료`)
