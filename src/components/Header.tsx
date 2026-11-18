import type { CloudStatus } from '../lib/supabase'
import type { Profile, Route } from '../lib/types'
import { ageFromBirthYear } from '../lib/matcher'

interface HeaderProps {
  profile: Profile
  cloud: CloudStatus
  route: Route
  onOpenProfile: () => void
  onOpenAuth: () => void
  updatedLabel?: string
}

const NAV: { key: Route; label: string }[] = [
  { key: 'home', label: '추천' },
  { key: 'browse', label: '둘러보기' },
  { key: 'saved', label: '저장함' },
  { key: 'settings', label: '설정' },
]

export default function Header({ profile, cloud, route, onOpenProfile, onOpenAuth, updatedLabel }: HeaderProps) {
  const age = ageFromBirthYear(profile.birthYear)
  const cloudLabel =
    cloud.state === 'signed-in' ? '동기화 중' : cloud.state === 'disabled' ? '기기 저장' : cloud.state === 'guest' ? '로그인' : '확인 필요'
  const cloudTone =
    cloud.state === 'signed-in' ? 'bg-brand-50 text-brand-800 ring-brand-100' : 'bg-white text-ink-500 ring-slate-200'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-100/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <a href="#/home" className="flex items-center gap-2.5" aria-label="보조금 레이더 홈">
          <img src="./icons/icon-192.png" alt="" className="h-9 w-9 rounded-[11px] shadow-sm" width={36} height={36} />
          <div className="leading-tight">
            <div className="text-[15.5px] font-extrabold tracking-tight text-ink-900">보조금 레이더</div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-700">GrantRadar KR</div>
          </div>
        </a>

        <nav className="ml-4 hidden items-center gap-0.5 sm:flex" aria-label="주요 메뉴">
          {NAV.map((item) => {
            const active = route === item.key
            return (
              <a
                key={item.key}
                href={`#/${item.key}`}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] font-bold transition ${
                  active ? 'bg-brand-50 text-brand-800' : 'text-ink-400 hover:bg-slate-50 hover:text-ink-700'
                }`}
              >
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {updatedLabel ? <span className="hidden text-[11.5px] font-medium text-ink-300 lg:inline">{updatedLabel}</span> : null}
          <button type="button" onClick={onOpenAuth} className={`chip ring-1 ${cloudTone}`} title="계정·클라우드 동기화 상태">
            <span className={`h-1.5 w-1.5 rounded-full ${cloud.state === 'signed-in' ? 'bg-brand-500' : 'bg-slate-300'}`} />
            {cloudLabel}
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-ink-700"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
            </svg>
            {age !== null ? `만 ${age}세` : '내 조건'}
          </button>
        </div>
      </div>
    </header>
  )
}
