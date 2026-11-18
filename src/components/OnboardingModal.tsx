import { useEffect, useMemo, useState } from 'react'
import Modal, { ModalHeader } from './Modal'
import { DOMAINS, HOUSEHOLDS, JOBS, REGIONS } from '../lib/labels'
import { DEFAULT_PROFILE, ageFromBirthYear, lifeStageOfAge } from '../lib/matcher'
import type { DomainKey, HouseholdKey, JobKey, Profile } from '../lib/types'
import { lifeLabel } from '../lib/labels'

interface Props {
  open: boolean
  initial: Profile
  onClose: () => void
  onSave: (profile: Profile) => void
  firstRun?: boolean
}

const STEPS = ['기본 정보', '직군', '가구·상황', '관심 분야'] as const

export default function OnboardingModal({ open, initial, onClose, onSave, firstRun = false }: Props) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Profile>(initial)

  useEffect(() => {
    if (open) {
      setDraft({ ...DEFAULT_PROFILE, ...initial })
      setStep(0)
    }
  }, [open, initial])

  const age = ageFromBirthYear(draft.birthYear)
  const stage = lifeStageOfAge(age)

  const toggle = <K extends 'jobs' | 'households' | 'domains'>(field: K, value: string) => {
    setDraft((prev) => {
      const list = prev[field] as string[]
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      return { ...prev, [field]: next } as Profile
    })
  }

  const canNext = step > 0 || draft.birthYear !== null
  const isLast = step === STEPS.length - 1

  const summary = useMemo(() => {
    const parts: string[] = []
    if (age !== null) parts.push(`만 ${age}세`)
    if (stage) parts.push(lifeLabel(stage))
    if (draft.region !== '전국') parts.push(draft.region)
    if (draft.jobs.length) parts.push(`${draft.jobs.length}개 직군`)
    if (draft.households.length) parts.push(`${draft.households.length}개 상황`)
    if (draft.domains.length) parts.push(`${draft.domains.length}개 분야`)
    return parts.join(' · ')
  }, [draft, age, stage])

  const finish = () => {
    onSave({ ...draft, done: true, updatedAt: new Date().toISOString() })
  }

  return (
    <Modal open={open} onClose={firstRun ? () => undefined : onClose} size="md" label="내 조건 설정">
      <ModalHeader
        title={firstRun ? '30초 만에 내 보조금 찾기' : '내 조건 수정'}
        subtitle={firstRun ? '4가지만 알려주시면 받을 수 있는 보조금만 골라 드려요.' : '조건을 바꾸면 추천이 즉시 다시 계산됩니다.'}
        onClose={firstRun ? () => undefined : onClose}
        right={!firstRun ? undefined : <span className="text-[11px] font-bold text-ink-300">필수</span>}
      />

      <div className="px-5 pt-3">
        <div className="flex items-center gap-1.5">
          {STEPS.map((label, index) => (
            <div key={label} className="flex-1">
              <div className={`h-1.5 rounded-full ${index <= step ? 'bg-brand-600' : 'bg-slate-200'}`} />
              <div className={`mt-1.5 text-[10.5px] font-bold ${index === step ? 'text-brand-700' : 'text-ink-300'}`}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-h-[58vh] overflow-y-auto px-5 py-4">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[13px] font-bold text-ink-700">성별</p>
              <div className="flex gap-2">
                {[
                  { key: 'female', label: '여성' },
                  { key: 'male', label: '남성' },
                  { key: 'all', label: '선택 안 함' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setDraft({ ...draft, gender: option.key as Profile['gender'] })}
                    className={`chip ${draft.gender === option.key ? 'chip-active' : 'chip-idle'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] text-ink-300">여성 전용·남성 전용 사업을 걸러내는 데만 씁니다.</p>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-bold text-ink-700">출생연도</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1920}
                  max={new Date().getFullYear()}
                  placeholder="예: 1994"
                  value={draft.birthYear ?? ''}
                  onChange={(event) => {
                    const value = event.target.value === '' ? null : Number(event.target.value)
                    setDraft({ ...draft, birthYear: Number.isFinite(value as number) ? value : null })
                  }}
                  className="w-32 rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] font-semibold outline-none focus:border-brand-500"
                />
                <span className="text-[13px] text-ink-400">
                  {age !== null ? `만 ${age}세 · ${stage ? lifeLabel(stage) : ''}` : '나이에 맞는 제도만 추려 드려요'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[19, 25, 30, 35, 40, 50, 60, 70].map((unitAge) => {
                  const year = new Date().getFullYear() - unitAge
                  return (
                    <button
                      key={unitAge}
                      type="button"
                      onClick={() => setDraft({ ...draft, birthYear: year })}
                      className={`chip ${draft.birthYear === year ? 'chip-active' : 'chip-idle'}`}
                    >
                      만 {unitAge}세
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-bold text-ink-700">거주 지역</p>
              <div className="flex flex-wrap gap-1.5">
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setDraft({ ...draft, region })}
                    className={`chip ${draft.region === region ? 'chip-active' : 'chip-idle'}`}
                  >
                    {region}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] text-ink-300">지자체 사업은 거주지 조건이 있어요. '전국'은 지역 무관 사업만 보여줍니다.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-[13px] font-bold text-ink-700">지금 어떤 상황인가요? (여러 개 선택 가능)</p>
            <div className="grid grid-cols-2 gap-2">
              {JOBS.map((job) => {
                const active = draft.jobs.includes(job.key as JobKey)
                return (
                  <button
                    key={job.key}
                    type="button"
                    onClick={() => toggle('jobs', job.key)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-[13.5px] font-semibold transition ${
                      active ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-ink-700'
                    }`}
                  >
                    <span className="text-lg">{job.emoji}</span>
                    <span className="leading-tight">{job.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-[13px] font-bold text-ink-700">해당되는 가구·상황을 모두 골라 주세요</p>
            <div className="grid grid-cols-2 gap-2">
              {HOUSEHOLDS.map((item) => {
                const active = draft.households.includes(item.key as HouseholdKey)
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggle('households', item.key)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-[13.5px] font-semibold transition ${
                      active ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-ink-700'
                    }`}
                  >
                    <span className="text-lg">{item.emoji}</span>
                    <span className="leading-tight">{item.label}</span>
                  </button>
                )
              })}
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-400">
              임산부·난임, 장애인·보훈, 저소득·차상위는 별도 증빙이 필요한 사업이 많아요. 해당될 때만 선택해 주세요.
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[13px] font-bold text-ink-700">관심 분야 (복수 선택)</p>
              <div className="grid grid-cols-2 gap-2">
                {DOMAINS.map((domain) => {
                  const active = draft.domains.includes(domain.key as DomainKey)
                  return (
                    <button
                      key={domain.key}
                      type="button"
                      onClick={() => toggle('domains', domain.key)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-[13.5px] font-semibold transition ${
                        active ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-ink-700'
                      }`}
                    >
                      <span className="text-lg">{domain.emoji}</span>
                      {domain.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-bold text-ink-700">소득 수준 (선택)</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'unknown', label: '잘 모르겠어요' },
                  { key: 'low', label: '저소득·수급' },
                  { key: 'middle', label: '중간' },
                  { key: 'high', label: '높음' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setDraft({ ...draft, income: option.key as Profile['income'] })}
                    className={`chip ${draft.income === option.key ? 'chip-active' : 'chip-idle'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3.5">
        <div className="mb-2 truncate text-[11.5px] font-semibold text-brand-700">{summary || '조건을 선택해 주세요'}</div>
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" className="btn-ghost flex-1" onClick={() => setStep((s) => s - 1)}>
              이전
            </button>
          )}
          {!isLast ? (
            <button
              type="button"
              className="btn-primary flex-[2]"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
            >
              다음
            </button>
          ) : (
            <button type="button" className="btn-primary flex-[2]" onClick={finish}>
              내 보조금 보기
            </button>
          )}
        </div>
        {firstRun && (
          <button type="button" onClick={onClose} className="mt-2 w-full text-center text-[11.5px] font-medium text-ink-300">
            나중에 할게요 (전체 둘러보기)
          </button>
        )}
      </div>
    </Modal>
  )
}
