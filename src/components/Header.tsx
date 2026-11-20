import type { CloudStatus } from '../lib/supabase'
import type { Profile, Route } from '../lib/types'
import { ageFromBirthYear } from '../lib/matcher'

interface HeaderProps {
  profile: Profile
  cloud: CloudStatus
  route: Route
  onOpenProfile: () => void
  onOpenAuth: (mode: 'signin' | 'signup') => void
  updatedLabel?: string
}

const NAV: { key: Route; label: string }[] = [
  { key: 'home', label: '추천' },
  { key: 'browse', label: '둘러보기' },
  { key: 'guides', label: '가이드' },
  { key: 'calculators', label: '계산기' },
  { key: 'saved', label: '저장함' },
  { key: 'settings', label: '설정' },
]

export default function Header({ profile, cloud, route, onOpenProfile, onOpenAuth, updatedLabel }: HeaderProps) {
  const age = ageFromBirthYear(profile.birthYear)
  const signedIn = cloud.state === 'signed-in'
  // 비로그인(guest)일 때만 로그인·회원가입을 나란히 노출한다.
  // 서버 미연결(disabled)·오류(error) 상태는 '기기 저장'/'확인 필요' 배지로만 알린다.
  const showAuthButtons = cloud.state === 'guest'
  const statusLabel = signedIn ? '동기화 중' : cloud.state === 'disabled' ? '기기 저장' : '확인 필요'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-100/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <a href="#/home" className="flex min-w-0 items-center gap-2 sm:gap-2.5" aria-label="보조금 레이더 홈">
          <img
            src="./icons/icon-192.png"
            alt=""
            className="h-8 w-8 shrink-0 rounded-[10px] shadow-sm sm:h-9 sm:w-9 sm:rounded-[11px]"
            width={36}
            height={36}
          />
          <div className="hidden min-w-0 leading-tight min-[360px]:block">
            <div className="truncate text-[14.5px] font-extrabold tracking-tight text-ink-900 sm:text-[15.5px]">
              보조금 레이더
            </div>
            <div className="hidden text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-700 sm:block">
              GrantRadar KR
            </div>
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

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {updatedLabel ? <span className="hidden text-[11.5px] font-medium text-ink-300 lg:inline">{updatedLabel}</span> : null}

          {showAuthButtons ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                aria-label="로그인"
                onClick={() => onOpenAuth('signin')}
                className="rounded-full px-2 py-1.5 text-[12.5px] font-bold text-ink-600 transition hover:bg-slate-50 hover:text-ink-900 sm:px-3 sm:text-[13px]"
              >
                로그인
              </button>
              <button
                type="button"
                aria-label="회원가입"
                onClick={() => onOpenAuth('signup')}
                className="whitespace-nowrap rounded-full bg-brand-700 px-2.5 py-1.5 text-[12.5px] font-bold text-white shadow-sm ring-1 ring-brand-700/20 transition hover:bg-brand-800 active:scale-[0.98] sm:px-3.5 sm:text-[13px]"
              >
                회원가입
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('signin')}
              className={`chip ring-1 ${signedIn ? 'bg-brand-50 text-brand-800 ring-brand-100' : 'bg-white text-ink-500 ring-slate-200'}`}
              title="계정·클라우드 동기화 상태"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${signedIn ? 'bg-brand-500' : 'bg-slate-300'}`} />
              {statusLabel}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenProfile}
            aria-label={age !== null ? `내 조건 (만 ${age}세)` : '내 조건'}
            className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-900 px-2.5 text-[12px] font-bold text-white transition hover:bg-ink-700 sm:h-auto sm:px-3 sm:py-1.5 sm:text-[12.5px]"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="hidden sm:block"
            >
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
            </svg>
            {/* 좁은 화면에서는 글자 폭을 줄여 로고·로그인·회원가입이 한 줄에 들어가게 한다. */}
            <span className="sm:hidden">{age !== null ? `만 ${age}세` : '조건'}</span>
            <span className="hidden sm:inline">{age !== null ? `만 ${age}세` : '내 조건'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
