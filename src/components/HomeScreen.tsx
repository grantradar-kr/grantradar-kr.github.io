import { useMemo, useState } from 'react'
import PolicyCard from './PolicyCard'
import AdSlot from './AdSlot'
import { DOMAINS } from '../lib/labels'
import { filterScored, sortScored, summarize, type SortKey } from '../lib/matcher'
import type { DomainKey, Meta, Profile, ScoredPolicy, Verdict } from '../lib/types'
import { profileSummary } from '../lib/matcher'

interface Props {
  scored: ScoredPolicy[]
  meta: Meta | null
  profile: Profile
  savedIds: Set<string>
  loading: boolean
  adsEnabled: boolean
  onOpenPolicy: (policyId: string) => void
  onToggleSave: (policyId: string) => void
  onEditProfile: () => void
}

const VERDICT_TABS: { key: Verdict | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'perfect', label: '완벽 일치' },
  { key: 'check', label: '조건 확인' },
]

export default function HomeScreen({
  scored,
  meta,
  profile,
  savedIds,
  loading,
  adsEnabled,
  onOpenPolicy,
  onToggleSave,
  onEditProfile,
}: Props) {
  const [query, setQuery] = useState('')
  const [verdict, setVerdict] = useState<Verdict | 'all'>('all')
  const [domain, setDomain] = useState<DomainKey | 'all'>('all')
  const [onlyUrgent, setOnlyUrgent] = useState(false)
  const [sort, setSort] = useState<SortKey>('match')
  const [visible, setVisible] = useState(24)

  const stats = useMemo(() => summarize(scored), [scored])

  const results = useMemo(() => {
    const filtered = filterScored(scored, {
      query,
      domains: domain === 'all' ? [] : [domain],
      verdicts: verdict === 'all' ? [] : [verdict],
      onlyUrgent,
    })
    return sortScored(filtered, sort)
  }, [scored, query, domain, verdict, onlyUrgent, sort])

  const shown = results.slice(0, visible)
  const summaryChips = profileSummary(profile).slice(0, 6)

  return (
    <div className="space-y-4">
      {/* 히어로 */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 px-5 py-5 text-white shadow-card">
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute -right-4 -top-10 h-32 w-32 rounded-full border border-white/10" />
        <p className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-brand-100">Live · 매일 자동 업데이트</p>
        <h1 className="mt-1.5 text-[21px] font-extrabold leading-snug tracking-tight">
          {profile.done ? '내 조건에 맞는 보조금을 찾았어요' : '내가 받을 수 있는 보조금, 30초면 찾습니다'}
        </h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-brand-50/90">
          온통청년 · 복지로 · 기업마당 · K-Startup 공고 {meta ? meta.total.toLocaleString() : '—'}건을 실시간으로 비교했어요.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
            <p className="text-[19px] font-black leading-none">{loading ? '—' : stats.perfect.toLocaleString()}</p>
            <p className="mt-1 text-[10.5px] font-semibold text-brand-50/80">완벽 일치</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
            <p className="text-[19px] font-black leading-none">{loading ? '—' : stats.check.toLocaleString()}</p>
            <p className="mt-1 text-[10.5px] font-semibold text-brand-50/80">조건 확인 필요</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
            <p className="text-[19px] font-black leading-none">{loading ? '—' : stats.urgent.toLocaleString()}</p>
            <p className="mt-1 text-[10.5px] font-semibold text-brand-50/80">마감 임박(D-7)</p>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          {summaryChips.length > 0 ? (
            summaryChips.map((chip) => (
              <span key={chip} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                {chip}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">조건 미설정</span>
          )}
          <button
            type="button"
            onClick={onEditProfile}
            className="ml-auto rounded-full bg-white px-3 py-1.5 text-[11.5px] font-extrabold text-brand-800 transition hover:bg-brand-50"
          >
            조건 수정
          </button>
        </div>
      </section>

      {/* 검색 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
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
            placeholder="예: 월세, 한부모, 예술인, 전세자금, 다자녀"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-[13.5px] font-medium outline-none transition placeholder:text-ink-300 focus:border-brand-500"
          />
        </div>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          className="rounded-2xl border border-slate-200 bg-white px-3 text-[12.5px] font-bold text-ink-600 outline-none focus:border-brand-500"
          aria-label="정렬"
        >
          <option value="match">추천순</option>
          <option value="deadline">마감 임박순</option>
          <option value="recent">최신 등록순</option>
        </select>
      </div>

      {/* 판정 탭 */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {VERDICT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setVerdict(tab.key as Verdict | 'all')
              setVisible(24)
            }}
            className={`chip shrink-0 ${verdict === tab.key ? 'chip-active' : 'chip-idle'}`}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setOnlyUrgent((v) => !v)
            setVisible(24)
          }}
          className={`chip shrink-0 ${onlyUrgent ? 'bg-rose-500 text-white ring-rose-500' : 'chip-idle'}`}
        >
          🔥 마감 임박
        </button>
      </div>

      {/* 분야 */}
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
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="flex items-baseline justify-between pt-1">
        <h2 className="text-[14px] font-extrabold text-ink-900">
          {profile.done ? '내 조건 추천' : '전체 보조금'}{' '}
          <span className="text-brand-700">{results.length.toLocaleString()}</span>
          <span className="text-[12px] font-semibold text-ink-300">건</span>
        </h2>
        <span className="text-[11.5px] font-medium text-ink-300">조건에 맞을수록 위에 표시됩니다</span>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card p-4">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton mt-3 h-4 w-full" />
              <div className="skeleton mt-2 h-4 w-3/4" />
              <div className="skeleton mt-3 h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <p className="text-[30px]">🔍</p>
          <p className="mt-2 text-[14px] font-bold text-ink-700">조건에 맞는 보조금이 없어요</p>
          <p className="mt-1 text-[12.5px] text-ink-400">검색어를 줄이거나 필터를 초기화해 보세요.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setDomain('all')
              setVerdict('all')
              setOnlyUrgent(false)
            }}
            className="btn-soft mt-3"
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((item, index) => (
              <div key={item.policy.id} className="contents">
                <PolicyCard
                  policy={item.policy}
                  judgement={item.judgement}
                  saved={savedIds.has(item.policy.id)}
                  onOpen={() => onOpenPolicy(item.policy.id)}
                  onToggleSave={() => onToggleSave(item.policy.id)}
                />
                {index === 5 ? (
                  <div className="sm:col-span-2 xl:col-span-3">
                    <AdSlot enabled={adsEnabled} label="광고" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {visible < results.length ? (
            <button type="button" onClick={() => setVisible((v) => v + 24)} className="btn-ghost w-full">
              더 보기 ({results.length - visible}건 남음)
            </button>
          ) : (
            <p className="py-4 text-center text-[11.5px] text-ink-300">
              {results.length.toLocaleString()}건을 모두 확인했어요 · 데이터는 하루 2회 자동 갱신됩니다
            </p>
          )}
        </>
      )}
    </div>
  )
}
