import { CONTENT_UPDATED, SITE_CONTENT, GUIDE_CATEGORIES, GUIDES, updatedLabel } from '../lib/guides'

interface Props {
  onOpenGuides: () => void
  onOpenGuide: (slug: string) => void
}

const FACTS = [
  { label: '수집 채널', value: '온통청년 · 복지로 · 기업마당 · K-Startup · 보조금24' },
  { label: '갱신 주기', value: '매일 06:00 · 18:00 (한국시간) 자동 수집' },
  { label: '이용 요금', value: '무료 (회원가입 없이 둘러보기 가능)' },
  { label: '운영 방식', value: '민간 운영 · 광고 수익으로 서버·수집 비용 충당' },
]

const HUB_LINKS = [
  { slug: 'housing', label: '주거·월세' },
  { slug: 'finance', label: '생활·금융' },
  { slug: 'employment', label: '취업·구직' },
  { slug: 'business', label: '창업·소상공인' },
  { slug: 'childcare', label: '출산·육아' },
  { slug: 'education', label: '교육·장학금' },
  { slug: 'medical', label: '의료비' },
  { slug: 'senior-welfare', label: '노인·기초연금' },
  { slug: 'youth', label: '청년' },
  { slug: 'single', label: '1인가구' },
  { slug: 'low-income', label: '저소득' },
  { slug: 'disabled', label: '장애인' },
  { slug: 'single-parent', label: '한부모·다자녀' },
  { slug: 'self-employed', label: '자영업' },
  { slug: 'urgent', label: '마감 임박 D-7' },
  { slug: 'regions', label: '지역별 17개 시·도' },
]

export default function AboutScreen({ onOpenGuides, onOpenGuide }: Props) {
  const operator = SITE_CONTENT.operator

  return (
    <div className="space-y-5">
      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">About</p>
        <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug tracking-tight text-ink-900">
          보조금 레이더는 이렇게 만들어집니다
        </h1>
        {SITE_CONTENT.intro.map((paragraph) => (
          <p key={paragraph.slice(0, 20)} className="mt-2 text-[13px] leading-[1.85] text-ink-600">
            {paragraph}
          </p>
        ))}
      </section>

      <section className="card px-4 py-3">
        {FACTS.map((fact) => (
          <div key={fact.label} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
            <span className="shrink-0 text-[11.5px] font-bold text-ink-400">{fact.label}</span>
            <span className="text-right text-[12px] font-semibold leading-relaxed text-ink-700">{fact.value}</span>
          </div>
        ))}
      </section>

      {SITE_CONTENT.sections.map((section) => (
        <section key={section.heading}>
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink-900">{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph.slice(0, 20)} className="mt-1.5 text-[13px] leading-[1.85] text-ink-600">
              {paragraph}
            </p>
          ))}
          {section.bullets?.length ? (
            <ul className="mt-2 space-y-1.5">
              {section.bullets.map((bullet) => (
                <li key={bullet.slice(0, 20)} className="flex gap-2 text-[13px] leading-[1.8] text-ink-600">
                  <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
        <h2 className="text-[13px] font-extrabold text-ink-800">운영·문의</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">
          {operator.name} · <a href={`mailto:${operator.email}`} className="font-semibold text-brand-700 underline">{operator.email}</a>
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">{operator.note}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-300">
          콘텐츠 기준일 {updatedLabel(CONTENT_UPDATED)} · 가이드 {GUIDES.length}편 ({GUIDE_CATEGORIES.join(' · ')})
        </p>
      </section>

      <section>
        <h2 className="text-[14px] font-extrabold text-ink-900">분야·대상별로 찾기</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-400">
          앱의 조건 설정 없이도 바로 볼 수 있는 정적 페이지입니다. 분야 8개·대상 6개·특집 2개로 공고를 묶었습니다.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {HUB_LINKS.map((hub) => (
            <a
              key={hub.slug}
              href={`./categories/${hub.slug}.html`}
              className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold text-brand-800 ring-1 ring-slate-200"
            >
              {hub.label}
            </a>
          ))}
        </div>
        <a href="./categories/" className="btn-ghost mt-2.5 block text-center">
          분야·대상별 보조금 전체 보기
        </a>
      </section>

      <section>
        <h2 className="text-[14px] font-extrabold text-ink-900">가이드 둘러보기</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {GUIDES.slice(0, 4).map((guide) => (
            <button
              key={guide.slug}
              type="button"
              onClick={() => onOpenGuide(guide.slug)}
              className="card px-3.5 py-3 text-left transition hover:ring-brand-200"
            >
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-700">{guide.category}</p>
              <p className="mt-1 text-[12.5px] font-bold leading-snug text-ink-800">{guide.title}</p>
            </button>
          ))}
        </div>
        <button type="button" onClick={onOpenGuides} className="btn-ghost mt-2.5 w-full">
          가이드 전체 보기 ({GUIDES.length}편)
        </button>
      </section>
    </div>
  )
}
