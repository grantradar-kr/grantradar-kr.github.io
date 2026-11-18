import { useMemo, useState } from 'react'
import PolicyCard from './PolicyCard'
import AdSlot from './AdSlot'
import GuideTeaser from './GuideTeaser'
import { DOMAINS, LIFE_STAGES } from '../lib/labels'
import { deadlineText } from '../lib/data'
import type { DomainKey, Judgement, LifeStage, Meta, Policy } from '../lib/types'

interface Props {
  policies: Policy[]
  meta: Meta | null
  loading: boolean
  savedIds: Set<string>
  onOpenPolicy: (policyId: string) => void
  onToggleSave: (policyId: string) => void
  onOpenGuides: () => void
  onOpenGuide: (slug: string) => void
}

const NEUTRAL: Judgement = { score: 0, verdict: 'low', urgent: false, reasons: [], gaps: [] }

function urgencyOf(policy: Policy): Judgement {
  const urgent = typeof policy.dday === 'number' && policy.dday >= 0 && policy.dday <= 7
  return { ...NEUTRAL, urgent }
}

export default function PublicDirectory({
  policies,
  meta,
  loading,
  savedIds,
  onOpenPolicy,
  onToggleSave,
  onOpenGuides,
  onOpenGuide,
}: Props) {
  const [domain, setDomain] = useState<DomainKey | 'all'>('all')
  const [life, setLife] = useState<LifeStage | 'all'>('all')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(24)

  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const policy of policies) {
      for (const key of policy.match.domains ?? []) counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [policies])

  const lifeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const policy of policies) {
      for (const key of policy.match.life_stages ?? []) counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [policies])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = policies.filter((policy) => {
      if (domain !== 'all' && !(policy.match.domains ?? []).includes(domain)) return false
      if (life !== 'all' && !(policy.match.life_stages ?? []).includes(life)) return false
      if (q) {
        const haystack = `${policy.title} ${policy.summary ?? ''} ${policy.org ?? ''} ${policy.category ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    list.sort((a, b) => {
      const da = typeof a.dday === 'number' ? a.dday : 99999
      const db = typeof b.dday === 'number' ? b.dday : 99999
      if (da !== db) return da - db
      return (b.posted_at ?? '').localeCompare(a.posted_at ?? '')
    })
    return list
  }, [policies, domain, life, query])

  const shown = results.slice(0, visible)
  const activeDomain = DOMAINS.find((item) => item.key === domain)

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white px-5 py-5 shadow-card ring-1 ring-slate-100">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-brand-700">전체 보기 · 회원가입 없이</p>
        <h1 className="mt-1.5 text-[21px] font-extrabold leading-snug tracking-tight text-ink-900">
          분야별 · 생애주기별 보조금 전체 목록
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
          주거·의료·생활금융·보육·교육·취업·창업·노인복지까지, 지금 모집 중인 전국 보조금{' '}
          <b className="text-ink-800">{meta ? meta.total.toLocaleString() : policies.length.toLocaleString()}건</b>을 한 번에
          볼 수 있어요. 로그인하지 않아도 모두 열람할 수 있습니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {meta
            ? Object.entries(meta.by_source).map(([source, count]) => (
                <span key={source} className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-ink-500 ring-1 ring-slate-200">
                  {meta.source_labels?.[source] ?? source} {count.toLocaleString()}
                </span>
              ))
            : null}
        </div>
      </section>

      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setVisible(24)
          }}
          placeholder="전체 검색 · 예: 전세, 산후조리, 국민취업지원, 소상공인"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-[13.5px] font-medium outline-none focus:border-brand-500"
        />
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setDomain('all')
              setVisible(24)
            }}
            className={`chip shrink-0 ${domain === 'all' ? 'chip-active' : 'chip-idle'}`}
          >
            전체 분야
          </button>
          {DOMAINS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setDomain(item.key as DomainKey)
                setVisible(24)
              }}
              className={`chip shrink-0 ${domain === item.key ? 'chip-active' : 'chip-idle'}`}
            >
              {item.emoji} {item.short}
              <span className="text-[10.5px] font-bold opacity-60">{(domainCounts[item.key] ?? 0).toLocaleString()}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setLife('all')
              setVisible(24)
            }}
            className={`chip shrink-0 ${life === 'all' ? 'chip-active' : 'chip-idle'}`}
          >
            전 연령
          </button>
          {LIFE_STAGES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setLife(item.key as LifeStage)
                setVisible(24)
              }}
              className={`chip shrink-0 ${life === item.key ? 'chip-active' : 'chip-idle'}`}
            >
              {item.emoji} {item.short}
              <span className="text-[10.5px] font-bold opacity-60">{(lifeCounts[item.key] ?? 0).toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <h2 className="text-[14px] font-extrabold text-ink-900">
          {activeDomain ? `${activeDomain.label} ` : ''}
          {results.length.toLocaleString()}
          <span className="text-[12px] font-semibold text-ink-300">건</span>
        </h2>
        <span className="text-[11.5px] font-medium text-ink-300">마감 임박순</span>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card p-4">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton mt-3 h-4 w-full" />
              <div className="skeleton mt-2 h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((policy, index) => (
              <div key={policy.id} className="contents">
                <PolicyCard
                  policy={policy}
                  judgement={urgencyOf(policy)}
                  saved={savedIds.has(policy.id)}
                  showMatch={false}
                  onOpen={() => onOpenPolicy(policy.id)}
                  onToggleSave={() => onToggleSave(policy.id)}
                />
                {index === 8 ? (
                  <div className="sm:col-span-2 xl:col-span-3">
                    <AdSlot label="광고" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {visible < results.length ? (
            <button type="button" onClick={() => setVisible((v) => v + 24)} className="btn-ghost w-full">
              더 보기 ({results.length - visible}건 남음)
            </button>
          ) : null}
        </>
      )}

      <GuideTeaser onOpenGuides={onOpenGuides} onOpenGuide={onOpenGuide} />

      <section className="rounded-2xl bg-white px-4 py-4 text-[11.5px] leading-relaxed text-ink-400 ring-1 ring-slate-100">
        <h3 className="mb-1 text-[12.5px] font-extrabold text-ink-700">보조금 레이더는 이렇게 데이터를 모읍니다</h3>
        <p>
          온통청년(청년정책), 복지로(중앙부처·지자체·민간 복지서비스), 기업마당(중소기업·소상공인), K-Startup(창업지원)의 공개
          공고를 하루 두 번(오전 6시·오후 6시) 자동으로 수집합니다. 마감이 지난 공고는 목록에서 제외하고, 제목·요약·대상 조건을
          바탕으로 생애주기·직군·가구 상황·관심 분야 태그를 붙입니다. 태그는 자동 분류이므로 세부 자격은 공고 원문을 확인해 주세요.
        </p>
        <p className="mt-2">
          최종 갱신 {meta ? new Date(meta.generated_at).toLocaleString('ko-KR') : '—'} · 수집 {meta ? meta.total.toLocaleString() : '—'}건
        </p>
      </section>
    </div>
  )
}
