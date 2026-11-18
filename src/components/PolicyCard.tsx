import { ddayText } from '../lib/data'
import { domainLabel, sourceLabel } from '../lib/labels'
import type { Judgement, Policy } from '../lib/types'

interface Props {
  policy: Policy
  judgement: Judgement
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
  showMatch?: boolean
}

export function DdayBadge({ policy }: { policy: Policy }) {
  const text = ddayText(policy)
  const dday = policy.dday
  const tone =
    typeof dday === 'number' && dday <= 3
      ? 'bg-rose-50 text-rose-600 ring-rose-100'
      : typeof dday === 'number' && dday <= 7
        ? 'bg-amber-50 text-amber-700 ring-amber-100'
        : 'bg-slate-50 text-ink-400 ring-slate-200'
  return <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold ring-1 ${tone}`}>{text}</span>
}

export function VerdictBadge({ judgement, showScore = true }: { judgement: Judgement; showScore?: boolean }) {
  const map = {
    perfect: { label: '완벽 일치', cls: 'bg-brand-600 text-white' },
    check: { label: '조건 확인', cls: 'bg-amber-500 text-white' },
    low: { label: '가능성 낮음', cls: 'bg-slate-300 text-ink-700' },
  } as const
  const item = map[judgement.verdict]
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-extrabold ${item.cls}`}>
      {item.label}
      {showScore ? <span className="font-black opacity-90">{judgement.score}%</span> : null}
    </span>
  )
}

export default function PolicyCard({ policy, judgement, saved, onOpen, onToggleSave, showMatch = true }: Props) {
  const reasons = judgement.reasons.slice(0, 2)
  const domain = policy.match.domains?.[0]

  return (
    <article
      className="group flex cursor-pointer flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:ring-brand-200"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-500">{sourceLabel(policy.source)}</span>
          {domain ? (
            <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-700">{domainLabel(domain)}</span>
          ) : null}
          {judgement.urgent ? (
            <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[10.5px] font-bold text-white">마감 임박</span>
          ) : null}
        </div>
        <DdayBadge policy={policy} />
      </div>

      <h3 className="line-clamp-2 text-[15px] font-extrabold leading-[1.4] tracking-tight text-ink-900 group-hover:text-brand-800">
        {policy.title}
      </h3>

      {policy.org ? <p className="truncate text-[12px] font-medium text-ink-400">{policy.org}</p> : null}
      {policy.summary ? <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">{policy.summary}</p> : null}

      {showMatch && reasons.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {reasons.map((reason) => (
            <span key={reason} className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-500">
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        {showMatch ? <VerdictBadge judgement={judgement} /> : <span className="text-[11px] font-semibold text-ink-300">조건 맞춤 안내</span>}
        <button
          type="button"
          aria-label={saved ? '저장 해제' : '저장'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleSave()
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-full ring-1 transition ${
            saved ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-300 ring-slate-200 hover:text-brand-700'
          }`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9">
            <path d="M6.5 4.5h11a1 1 0 0 1 1 1V20l-6.5-4L5.5 20V5.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </article>
  )
}
