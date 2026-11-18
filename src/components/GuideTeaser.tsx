import { GUIDES } from '../lib/guides'

interface Props {
  onOpenGuides: () => void
  onOpenGuide: (slug: string) => void
}

/** 홈·둘러보기에서 가이드로 이어지는 짧은 진입 블록 */
export default function GuideTeaser({ onOpenGuides, onOpenGuide }: Props) {
  const picks = GUIDES.slice(0, 3)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13.5px] font-extrabold text-ink-900">신청 전에 읽어보세요</h2>
        <button type="button" onClick={onOpenGuides} className="text-[11.5px] font-bold text-brand-700 hover:underline">
          가이드 {GUIDES.length}편 전체보기 →
        </button>
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
        {picks.map((guide) => (
          <button
            key={guide.slug}
            type="button"
            onClick={() => onOpenGuide(guide.slug)}
            className="rounded-xl bg-slate-50 px-3 py-2.5 text-left transition hover:bg-brand-50"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">{guide.category}</p>
            <p className="mt-0.5 line-clamp-2 text-[12px] font-bold leading-snug text-ink-800">{guide.title}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
