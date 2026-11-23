import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import AdSlot from './AdSlot'
import { DdayBadge, VerdictBadge } from './PolicyCard'
import { deadlineText, formatDate, relativeUpdated } from '../lib/data'
import { domainLabel, householdLabel, jobLabel, lifeLabel, sourceLabel } from '../lib/labels'
import { openExternal, sharePolicy } from '../lib/share'
import type { Judgement, Policy, SavedEntry } from '../lib/types'

interface Props {
  policy: Policy | null
  judgement: Judgement | null
  savedEntry?: SavedEntry
  onClose: () => void
  onToggleSave: (id: string) => void
  onChecklistChange: (id: string, checklist: Record<string, boolean>) => void
  onToast: (message: string) => void
}

const BASE_CHECKS = ['신청서 작성', '신분증 사본 준비', '주민등록등본·가족관계증명서', '소득·재산 증빙서류']

function splitDocuments(text?: string): string[] {
  if (!text) return []
  return text
    .split(/[\n,·•ㆍ]/)
    .map((item) => item.replace(/^[-–\s*]+/, '').trim())
    .filter((item) => item.length > 1 && item.length <= 40)
    .slice(0, 4)
}

export default function PolicyDetailModal({
  policy,
  judgement,
  savedEntry,
  onClose,
  onToggleSave,
  onChecklistChange,
  onToast,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setExpanded(false)
    setLocalChecks(savedEntry?.checklist ?? {})
  }, [policy?.id, savedEntry?.checklist])

  const checks = useMemo(() => {
    if (!policy) return [] as string[]
    const docs = splitDocuments(policy.documents)
    const merged = [...BASE_CHECKS, ...docs.filter((doc) => !BASE_CHECKS.includes(doc))]
    return Array.from(new Set(merged)).slice(0, 7)
  }, [policy])

  if (!policy) return null

  const m = policy.match
  const done = checks.filter((item) => localChecks[item]).length
  const percent = checks.length ? Math.round((done / checks.length) * 100) : 0
  const targetUrl = policy.apply_url || policy.url
  const saved = Boolean(savedEntry)

  const toggleCheck = (item: string) => {
    const next = { ...localChecks, [item]: !localChecks[item] }
    setLocalChecks(next)
    onChecklistChange(policy.id, next)
  }

  const onShare = async () => {
    const result = await sharePolicy(policy)
    if (result === 'copied') onToast('공고 링크를 복사했어요. 카톡으로 붙여넣기 하세요.')
    if (result === 'failed') onToast('공유를 취소했어요.')
  }

  return (
    <Modal open={Boolean(policy)} onClose={onClose} size="lg" label="보조금 상세">
      <div className="flex max-h-[92vh] flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-ink-500">{sourceLabel(policy.source)}</span>
            {policy.category ? (
              <span className="max-w-[160px] truncate rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                {policy.category}
              </span>
            ) : null}
            <DdayBadge policy={policy} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink-500 hover:bg-slate-200"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <h2 className="text-[19px] font-extrabold leading-snug tracking-tight text-ink-900">{policy.title}</h2>
          <p className="mt-1 text-[12.5px] font-medium text-ink-400">
            {policy.org ?? '주관 기관 정보 없음'} · 접수 {deadlineText(policy)}
            {policy.posted_at ? ` · 등록 ${formatDate(policy.posted_at)}` : ''}
          </p>

          {judgement ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <VerdictBadge judgement={judgement} />
                  <span className="text-[11.5px] font-semibold text-ink-400">내 조건 일치율</span>
                </div>
                <span className="text-[15px] font-black text-ink-900">{judgement.score}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${
                    judgement.verdict === 'perfect' ? 'bg-brand-600' : judgement.verdict === 'check' ? 'bg-amber-500' : 'bg-slate-400'
                  }`}
                  style={{ width: `${judgement.score}%` }}
                />
              </div>
              {judgement.reasons.length > 0 ? (
                <ul className="mt-2.5 space-y-1">
                  {judgement.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-1.5 text-[12px] font-medium text-ink-600">
                      <span className="mt-[3px] text-brand-600">✓</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {judgement.gaps.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {judgement.gaps.map((gap) => (
                    <li key={gap} className="flex items-start gap-1.5 text-[12px] font-medium text-amber-700">
                      <span className="mt-[3px]">!</span>
                      {gap}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <section className="mt-4">
            <h3 className="section-title">대상 조건</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(m.life_stages ?? []).map((stage) => (
                <span key={stage} className="chip bg-brand-50 text-brand-800 ring-brand-100">
                  {lifeLabel(stage)}
                </span>
              ))}
              {(m.jobs ?? []).map((job) => (
                <span key={job} className="chip bg-slate-50 text-ink-600 ring-slate-200">
                  {jobLabel(job)}
                </span>
              ))}
              {(m.households ?? []).map((household) => (
                <span key={household} className="chip bg-amber-50 text-amber-800 ring-amber-100">
                  {householdLabel(household)}
                </span>
              ))}
              {(m.domains ?? []).map((domain) => (
                <span key={domain} className="chip bg-sky-50 text-sky-800 ring-sky-100">
                  {domainLabel(domain)}
                </span>
              ))}
              {(m.regions ?? ['전국']).map((region) => (
                <span key={region} className="chip bg-white text-ink-500 ring-slate-200">
                  {region}
                </span>
              ))}
              {typeof m.age_min === 'number' || typeof m.age_max === 'number' ? (
                <span className="chip bg-white text-ink-500 ring-slate-200">
                  만 {m.age_min ?? 0}~{m.age_max ?? 120}세
                </span>
              ) : null}
              {m.gender && m.gender !== 'all' ? (
                <span className="chip bg-white text-ink-500 ring-slate-200">{m.gender === 'female' ? '여성' : '남성'} 대상</span>
              ) : null}
            </div>
            {m.income_note ? <p className="mt-2 text-[11.5px] text-ink-400">소득 조건 · {m.income_note}</p> : null}
          </section>

          {policy.support || policy.summary ? (
            <section className="mt-4">
              <h3 className="section-title">지원 내용</h3>
              <p className={`mt-1.5 whitespace-pre-line text-[13px] leading-[1.75] text-ink-600 ${expanded ? '' : 'line-clamp-[8]'}`}>
                {policy.support || policy.summary}
              </p>
              {(policy.support ?? policy.summary ?? '').length > 240 ? (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-[12px] font-bold text-brand-700 hover:underline"
                >
                  {expanded ? '접기' : '더 보기'}
                </button>
              ) : null}
            </section>
          ) : null}

          <section className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title">신청 전 체크리스트</h3>
              <span className="text-[11.5px] font-bold text-brand-700">
                {done}/{checks.length} 완료 · {percent}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {checks.map((item) => {
                const checked = Boolean(localChecks[item])
                return (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => toggleCheck(item)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-semibold transition ${
                        checked ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-100' : 'bg-slate-50 text-ink-600 ring-1 ring-slate-100'
                      }`}
                    >
                      <span
                        className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border ${
                          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked ? (
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </span>
                      <span className={checked ? 'line-through opacity-70' : ''}>{item}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-300">
              체크리스트는 내 기기(또는 로그인 시 내 계정)에만 저장됩니다. 실제 제출 서류는 공고 원문을 꼭 확인하세요.
            </p>
          </section>

          {policy.documents ? (
            <section className="mt-4">
              <h3 className="section-title">공고에 적힌 제출 서류</h3>
              <p className="mt-1.5 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-ink-500">
                {policy.documents}
              </p>
            </section>
          ) : null}

          <section className="mt-4 rounded-2xl border border-dashed border-slate-200 px-3.5 py-3">
            <p className="text-[11.5px] leading-relaxed text-ink-400">
              본 서비스는 정부·공공기관 공식 앱이 아닌 민간 정보 매칭 플랫폼이며, 공공데이터 및 각 기관 공개 공고를 기반으로
              제공합니다. 최종 자격·신청은 공식 사이트에서 확인하세요.
              <br />
              정보 기준 {relativeUpdated(policy.posted_at) || '공고 원문 참조'} · 출처 {sourceLabel(policy.source)}
            </p>
            <a
              href={`mailto:eldbs9180@gmail.com?subject=${encodeURIComponent(`[보조금 레이더] 정보 오류 제보 - ${policy.title}`)}&body=${encodeURIComponent(`공고: ${policy.title}\n링크: ${policy.url}\n\n수정이 필요한 내용: `)}`}
              className="mt-2 inline-block text-[11.5px] font-bold text-brand-700 hover:underline"
            >
              정보가 달라요 · 오류 제보하기
            </a>
          </section>

          {/* 광고 — 신청 버튼과 충분한 간격을 두고 본문 하단에 1개만 배치(오클릭 방지) */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <AdSlot label="광고" variant="banner" />
          </div>
        </div>

        <div className="safe-bottom border-t border-slate-100 bg-white px-5 pt-3">
          <div className="flex gap-2 pb-2">
            <button
              type="button"
              onClick={() => onToggleSave(policy.id)}
              className={`btn ${saved ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200' : 'btn-ghost'} flex-1`}
            >
              {saved ? '저장됨' : '저장하기'}
            </button>
            <button type="button" onClick={onShare} className="btn-ghost flex-1">
              공유
            </button>
            <button
              type="button"
              onClick={() => openExternal(targetUrl)}
              className="btn-primary flex-[1.5] whitespace-nowrap px-3 text-[13px]"
            >
              신청하러 가기
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
