import type { Route } from '../lib/types'

const ITEMS: { key: Route; label: string; icon: JSX.Element }[] = [
  {
    key: 'home',
    label: '추천',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6l-1.9-5.8L4.3 10.9 10.1 9 12 3.2Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'browse',
    label: '둘러보기',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'saved',
    label: '저장함',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M6.5 4.5h11a1 1 0 0 1 1 1V20l-6.5-4L5.5 20V5.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: '설정',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function BottomNav({ route, onChange }: { route: Route; onChange: (route: Route) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-100 bg-white/95 backdrop-blur-md sm:hidden">
      <div className="safe-bottom mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
        {ITEMS.map((item) => {
          const active = route === item.key
          return (
            <a
              key={item.key}
              href={`#/${item.key}`}
              onClick={() => onChange(item.key)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-bold transition ${
                active ? 'text-brand-700' : 'text-ink-300'
              }`}
            >
              <span className={active ? 'text-brand-700' : 'text-ink-300'}>{item.icon}</span>
              {item.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
