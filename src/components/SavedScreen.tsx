import { useMemo } from 'react'
import { DdayBadge } from './PolicyCard'
import AdSlot from './AdSlot'
import { deadlineText } from '../lib/data'
import { sourceLabel } from '../lib/labels'
import type { Policy, SavedEntry } from '../lib/types'

interface Props {
  saved: SavedEntry[]
  policiesById: Map<string, Policy>
  onOpenPolicy: (id: string) => void
  onRemove: (id: string) => void
  onGoHome: () => void
  onOpenProfile: () => void
}

export default function SavedScreen({ saved, policiesById, onOpenPolicy, onRemove, onGoHome, onOpenProfile }: Props) {
  const rows = useMemo(
    () =>
      saved
        .map((entry) => ({ entry, policy: policiesById.get(entry.id) }))
        .filter((row): row is { entry: SavedEntry; policy: Policy } => Boolean(row.policy)),
    [saved, policiesById],
  )

  if (!saved.length) {
    return (
      <div className="card mt-6 px-6 py-12 text-center">
        <p className="text-[34px]">🔖</p>
        <h1 className="mt-2 text-[17px] font-extrabold text-ink-900">아직 저장한 보조금이 없어요</h1>
        <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-ink-400">
          관심 가는 공고를 저장해 두면 마감일과 준비 서류 체크리스트를 한 곳에서 관리할 수 있어요.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={onGoHome} className="btn-primary">
            추천 보조금 보기
          </button>
          <button type="button" onClick={onOpenProfile} className="btn-ghost">
            내 조건 설정
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[19px] font-extrabold tracking-tight text-ink-900">저장한 보조금</h1>
        <span className="text-[12px] font-semibold text-ink-400">{rows.length}건</span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-ink-300">
        체크리스트는 상세 화면에서 진행할 수 있어요. 로그인하면 기기를 바꿔도 그대로 유지됩니다.
      </p>

      <ul className="space-y-2.5">
        {rows.map(({ entry, policy }) => {
          const checks = entry.checklist ?? {}
          const total = Math.max(4, Object.keys(checks).length)
          const done = Object.values(checks).filter(Boolean).length
          const percent = Math.round((done / total) * 100)
          return (
            <li key={policy.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-500">
                      {sourceLabel(policy.source)}
                    </span>
                    <span className="text-[11px] font-medium text-ink-300">{deadlineText(policy)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenPolicy(policy.id)}
                    className="mt-1 block text-left text-[14.5px] font-bold leading-snug text-ink-900 hover:text-brand-800"
                  >
                    {policy.title}
                  </button>
                  {policy.org ? <p className="mt-0.5 truncate text-[11.5px] text-ink-400">{policy.org}</p> : null}
                </div>
                <DdayBadge policy={policy} />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
                </div>
                <span className="shrink-0 text-[11px] font-bold text-brand-700">준비 {percent}%</span>
                <button
                  type="button"
                  onClick={() => onRemove(policy.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-ink-300 hover:bg-slate-50 hover:text-rose-500"
                >
                  삭제
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* 저장한 공고가 2건 이상일 때만 목록 하단에 광고 1개 */}
      {rows.length >= 2 ? (
        <div className="pt-1">
          <AdSlot label="광고" variant="banner" />
        </div>
      ) : null}
    </div>
  )
}
