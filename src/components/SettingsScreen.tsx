import { useState } from 'react'
import type { CloudStatus } from '../lib/supabase'
import { supabaseEnabled } from '../lib/supabase'
import type { Meta, Profile } from '../lib/types'
import { ageFromBirthYear, lifeStageOfAge, profileSummary } from '../lib/matcher'
import { lifeLabel, sourceLabel } from '../lib/labels'
import { exportLocalData } from '../lib/storage'
import type { LegalKind } from './LegalModal'

interface Props {
  profile: Profile
  meta: Meta | null
  cloud: CloudStatus
  savedCount: number
  canInstall: boolean
  onEditProfile: () => void
  onOpenAuth: (mode?: 'signin' | 'signup') => void
  onOpenGuides: () => void
  onOpenAbout: () => void
  onOpenLegal: (kind: LegalKind) => void
  onClearData: () => void
  onInstall: () => void
  onToast: (message: string) => void
}

function Row({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold text-ink-700">{label}</p>
        <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink-400">{value}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export default function SettingsScreen({
  profile,
  meta,
  cloud,
  savedCount,
  canInstall,
  onEditProfile,
  onOpenAuth,
  onOpenGuides,
  onOpenAbout,
  onOpenLegal,
  onClearData,
  onInstall,
  onToast,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false)
  const age = ageFromBirthYear(profile.birthYear)
  const stage = lifeStageOfAge(age)

  const download = () => {
    const blob = new Blob([exportLocalData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `grantradar-내데이터-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    onToast('내 데이터를 파일로 내려받았어요.')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[19px] font-extrabold tracking-tight text-ink-900">설정</h1>

      <section className="card px-4 py-2">
        <Row
          label="내 조건"
          value={
            profile.done
              ? profileSummary(profile).join(' · ') || '설정됨'
              : '아직 설정하지 않았어요 — 30초면 끝나요'
          }
          action={
            <button type="button" onClick={onEditProfile} className="btn-soft px-3 py-1.5 text-[12px]">
              수정
            </button>
          }
        />
        <Row
          label="생애주기 자동 판정"
          value={stage ? `${lifeLabel(stage)} · 만 ${age}세 기준` : '출생연도를 입력하면 자동으로 계산합니다'}
        />
        <Row label="저장한 보조금" value={`${savedCount}건`} />
      </section>

      <section className="card px-4 py-2">
        <Row
          label="계정·클라우드 동기화"
          value={
            cloud.state === 'signed-in'
              ? `${cloud.email} · 로그인됨`
              : supabaseEnabled
                ? '가입은 선택이에요 — 로그인하면 기기를 바꿔도 조건·저장 목록이 유지됩니다'
                : '현재는 이 기기에만 저장됩니다 (서버 미연결). 로그인 없이 모든 기능 사용 가능'
          }
          action={
            cloud.state === 'signed-in' ? (
              <button type="button" onClick={() => onOpenAuth('signin')} className="btn-soft px-3 py-1.5 text-[12px]">
                계정
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="설정에서 로그인"
                  onClick={() => onOpenAuth('signin')}
                  className="btn-ghost px-2.5 py-1.5 text-[12px]"
                >
                  로그인
                </button>
                <button
                  type="button"
                  aria-label="설정에서 회원가입"
                  onClick={() => onOpenAuth('signup')}
                  className="btn-primary px-2.5 py-1.5 text-[12px]"
                  disabled={!supabaseEnabled}
                  title={supabaseEnabled ? undefined : '서버 연결 후 사용할 수 있습니다'}
                >
                  회원가입
                </button>
              </div>
            )
          }
        />
        {canInstall ? (
          <Row
            label="홈 화면에 앱으로 추가"
            value="브라우저 주소창 없이 앱처럼 열 수 있어요"
            action={
              <button type="button" onClick={onInstall} className="btn-soft px-3 py-1.5 text-[12px]">
                추가
              </button>
            }
          />
        ) : null}
        <Row
          label="가이드·도움말"
          value="소득기준 계산법, 서류 체크리스트, 신청 순서를 직접 정리한 글"
          action={
            <button type="button" onClick={onOpenGuides} className="text-[12px] font-bold text-brand-700">
              보기
            </button>
          }
        />
        <Row
          label="서비스 소개"
          value="데이터 출처·수집 주기·추천 계산 방식·운영 문의"
          action={
            <button type="button" onClick={onOpenAbout} className="text-[12px] font-bold text-brand-700">
              보기
            </button>
          }
        />
      </section>

      <section className="card px-4 py-2">
        <Row
          label="데이터 기준"
          value={
            meta
              ? `최종 수집 ${new Date(meta.generated_at).toLocaleString('ko-KR')} · ${meta.total.toLocaleString()}건`
              : '데이터를 불러오는 중입니다'
          }
        />
        {meta ? (
          <div className="border-b border-slate-100 py-3">
            <p className="text-[12.5px] font-bold text-ink-700">수집 소스</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(meta.by_source).map(([source, count]) => (
                <span key={source} className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-ink-500 ring-1 ring-slate-200">
                  {sourceLabel(source)} {count.toLocaleString()}건
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-300">
              하루 2회(06:00·18:00 KST) 자동 갱신 · 마감 지난 공고 {meta.expired_filtered?.toLocaleString() ?? 0}건은 목록에서 제외
            </p>
          </div>
        ) : null}
        <Row
          label="내 데이터 내보내기"
          value="내 조건과 저장 목록을 JSON 파일로 받습니다"
          action={
            <button type="button" onClick={download} className="btn-soft px-3 py-1.5 text-[12px]">
              내보내기
            </button>
          }
        />
        <Row
          label="내 데이터 삭제"
          value={confirmClear ? '한 번 더 누르면 이 기기의 모든 데이터가 지워집니다' : '이 기기에 저장된 조건·저장 목록을 지웁니다'}
          action={
            <button
              type="button"
              onClick={() => {
                if (!confirmClear) {
                  setConfirmClear(true)
                  return
                }
                onClearData()
                setConfirmClear(false)
              }}
              className={`btn px-3 py-1.5 text-[12px] ${confirmClear ? 'bg-rose-500 text-white' : 'bg-white text-rose-500 ring-1 ring-rose-200'}`}
            >
              {confirmClear ? '정말 삭제' : '삭제'}
            </button>
          }
        />
      </section>

      <section className="card px-4 py-2">
        <Row
          label="개인정보처리방침"
          value="수집 항목·보관·광고·위탁 안내"
          action={
            <button type="button" onClick={() => onOpenLegal('privacy')} className="text-[12px] font-bold text-brand-700">
              보기
            </button>
          }
        />
        <Row
          label="이용약관"
          value="서비스 성격과 책임 범위"
          action={
            <button type="button" onClick={() => onOpenLegal('terms')} className="text-[12px] font-bold text-brand-700">
              보기
            </button>
          }
        />
        <Row label="앱 버전" value={`보조금 레이더 ${import.meta.env.VITE_APP_VERSION ?? 'v1.0.0'} · GrantRadar KR`} />
      </section>

      <p className="px-1 pb-2 text-[11px] leading-relaxed text-ink-300">
        본 서비스는 정부·공공기관 공식 앱이 아닌 민간 정보 매칭 플랫폼이며, 공공데이터 및 각 기관 공개 공고를 기반으로 제공합니다. 최종
        자격·신청은 공식 사이트에서 확인하세요.
      </p>
    </div>
  )
}
