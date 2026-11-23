import { useMemo, useState } from 'react'
import AdSlot from './AdSlot'
import {
  CONTENT_UPDATED,
  GUIDES,
  GUIDE_CATEGORIES,
  guideBySlug,
  relatedGuides,
  updatedLabel,
  type Guide,
} from '../lib/guides'

interface Props {
  slug: string | null
  onOpenGuide: (slug: string) => void
  onBackToGuides: () => void
  onGoHome: () => void
  onOpenCalculators: () => void
  onOpenCalculator: (key: 'median-income' | 'unemployment-benefit' | 'eitc') => void
}

const CALC_LINKS: { key: 'median-income' | 'unemployment-benefit' | 'eitc'; emoji: string; label: string; desc: string }[] = [
  { key: 'median-income', emoji: '📊', label: '중위소득 판정', desc: '내 소득이 몇 %인지' },
  { key: 'unemployment-benefit', emoji: '🧾', label: '실업급여', desc: '1일 급여·수령일수' },
  { key: 'eitc', emoji: '💸', label: '근로장려금', desc: '예상 지급액 계산' },
]

function MetaLine({ guide }: { guide: Guide }) {
  return (
    <p className="mt-2 text-[11.5px] font-semibold text-ink-300">
      약 {guide.readMinutes}분 분량 · 기준일 {updatedLabel(guide.updated)} · 보조금 레이더 편집
    </p>
  )
}

function SectionTable({ table }: { table: NonNullable<Guide['sections'][number]['table']> }) {
  return (
    <div className="mt-3">
      {table.caption ? <p className="mb-1.5 text-[11.5px] font-bold text-ink-500">{table.caption}</p> : null}
      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
        <table className="w-full min-w-[420px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="bg-slate-50">
              {table.headers.map((header) => (
                <th key={header} scope="col" className="whitespace-nowrap px-3 py-2 font-extrabold text-ink-700">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-100 align-top">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-3 py-2 leading-relaxed ${cellIndex === 0 ? 'font-semibold text-ink-800' : 'text-ink-600'}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GuideArticle({ guide, onBackToGuides, onOpenGuide, onGoHome }: Props & { guide: Guide }) {
  const related = useMemo(() => relatedGuides(guide.slug), [guide.slug])

  return (
    <article className="space-y-5">
      <button type="button" onClick={onBackToGuides} className="text-[12.5px] font-bold text-brand-700 hover:underline">
        ← 가이드 목록
      </button>

      <header>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">
          {guide.category}
        </span>
        <h1 className="mt-2.5 text-[22px] font-extrabold leading-snug tracking-tight text-ink-900">{guide.title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{guide.lead}</p>
        <MetaLine guide={guide} />
      </header>

      {guide.takeaways?.length ? (
        <section className="rounded-2xl bg-brand-50/70 px-4 py-3.5 ring-1 ring-brand-100">
          <h2 className="text-[12.5px] font-extrabold text-brand-900">3줄 요약</h2>
          <ul className="mt-1.5 space-y-1.5 text-[12.5px] leading-relaxed text-brand-900/90">
            {guide.takeaways.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span aria-hidden className="mt-[3px] text-brand-600">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-6">
        {guide.sections.map((section, index) => (
          <section key={section.heading}>
            <h2 className="text-[15.5px] font-extrabold tracking-tight text-ink-900">{section.heading}</h2>
            {section.paragraphs?.length ? (
              <div className="mt-1.5 space-y-2">
                {section.paragraphs.map((paragraph, pIndex) => (
                  <p key={pIndex} className="text-[13px] leading-[1.85] text-ink-600">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
            {section.bullets?.length ? (
              <ul className="mt-2 space-y-1.5">
                {section.bullets.map((bullet, bIndex) => (
                  <li key={bIndex} className="flex gap-2 text-[13px] leading-[1.8] text-ink-600">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {section.table ? <SectionTable table={section.table} /> : null}
            {section.note ? (
              <p className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-ink-500">
                {section.note}
              </p>
            ) : null}
            {index === 1 ? (
              <div className="mt-5">
                <AdSlot label="광고" />
              </div>
            ) : null}
          </section>
        ))}
      </div>

      {guide.faq?.length ? (
        <section className="card px-4 py-3.5">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink-900">자주 묻는 질문</h2>
          <div className="mt-1 divide-y divide-slate-100">
            {guide.faq.map((item) => (
              <details key={item.q} className="group py-2.5">
                <summary className="cursor-pointer list-none text-[13px] font-bold text-ink-800 marker:hidden">
                  <span className="text-brand-700">Q. </span>
                  {item.q}
                </summary>
                <p className="mt-1.5 text-[12.5px] leading-[1.8] text-ink-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {guide.sources?.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
          <h2 className="text-[12.5px] font-extrabold text-ink-700">출처와 확인일</h2>
          <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-ink-500">
            {guide.sources.map((source) => (
              <li key={source.url}>
                ·{' '}
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-300 hover:text-brand-700">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-300">
            이 글은 {updatedLabel(guide.updated)} 기준으로 작성했습니다. 제도와 금액은 이후 바뀔 수 있으니, 신청 전에는 공고 원문과
            담당 기관 안내를 확인하세요. 오류 제보는 eldbs9180@gmail.com 으로 보내 주시면 확인 후 수정합니다.
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl bg-ink-900 px-4 py-4 text-white">
        <p className="text-[13px] font-extrabold">내 조건에 맞는 공고부터 확인해 보세요</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-white/70">
          가이드는 판단 기준을 설명합니다. 실제 공고는 내 조건을 입력하면 일치율 순으로 정리해 보여 드립니다.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onGoHome} className="rounded-xl bg-white px-3.5 py-2 text-[12px] font-extrabold text-ink-900">
            추천 보기
          </button>
          <a href="#/browse" className="rounded-xl bg-white/15 px-3.5 py-2 text-[12px] font-extrabold text-white ring-1 ring-white/25">
            전체 목록
          </a>
        </div>
      </section>

      {related.length ? (
        <section>
          <h2 className="text-[14px] font-extrabold text-ink-900">함께 읽으면 좋은 글</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {related.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => onOpenGuide(item.slug)}
                className="card px-3.5 py-3 text-left transition hover:ring-brand-200"
              >
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-700">{item.category}</p>
                <p className="mt-1 text-[12.5px] font-bold leading-snug text-ink-800">{item.title}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  )
}

export default function GuidesScreen({ slug, onOpenGuide, onBackToGuides, onGoHome, onOpenCalculators, onOpenCalculator }: Props) {
  const [category, setCategory] = useState<string>('all')
  const guide = guideBySlug(slug)

  if (slug) {
    if (!guide) {
      return (
        <div className="card px-5 py-10 text-center">
          <p className="text-[30px]">📄</p>
          <h1 className="mt-2 text-[16px] font-extrabold text-ink-900">가이드를 찾지 못했어요</h1>
          <p className="mt-1 text-[12.5px] text-ink-400">주소가 바뀌었거나 삭제된 글일 수 있습니다.</p>
          <button type="button" onClick={onBackToGuides} className="btn-primary mt-4">
            가이드 목록으로
          </button>
        </div>
      )
    }
    return <GuideArticle guide={guide} slug={slug} onOpenGuide={onOpenGuide} onBackToGuides={onBackToGuides} onGoHome={onGoHome} onOpenCalculators={onOpenCalculators} onOpenCalculator={onOpenCalculator} />
  }

  const list = category === 'all' ? GUIDES : GUIDES.filter((item) => item.category === category)

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-brand-800 px-5 py-5 text-white shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-100">Guides · 기준일 {updatedLabel(CONTENT_UPDATED)}</p>
        <h1 className="mt-1.5 text-[21px] font-extrabold leading-snug tracking-tight">신청 전에 읽는 보조금 가이드</h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/75">
          공고 목록만으로는 판단하기 어려운 계산법, 서류, 신청 순서를 직접 정리했습니다. 모든 글에 기준일과 출처를 남깁니다.
        </p>
      </section>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`chip shrink-0 ${category === 'all' ? 'chip-active' : 'chip-idle'}`}
        >
          전체 {GUIDES.length}
        </button>
        {GUIDE_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`chip shrink-0 ${category === item ? 'chip-active' : 'chip-idle'}`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* 모의계산기 바로가기 — 읽기 전에 내 숫자로 확인 */}
      <section className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-extrabold text-ink-900">읽기 전에 계산부터</h2>
          <button type="button" onClick={onOpenCalculators} className="text-[11px] font-bold text-brand-700 hover:underline">
            전체 보기 →
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {CALC_LINKS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpenCalculator(item.key)}
              className="rounded-xl bg-white px-2 py-2.5 text-center ring-1 ring-brand-100 transition hover:bg-brand-50"
            >
              <span className="text-[16px]">{item.emoji}</span>
              <span className="mt-0.5 block text-[10.5px] font-bold leading-tight text-ink-700">{item.label}</span>
              <span className="mt-0.5 block text-[9.5px] font-semibold leading-tight text-ink-300">{item.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {list.map((item) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => onOpenGuide(item.slug)}
            className="card flex h-full flex-col px-4 py-3.5 text-left transition hover:ring-brand-200"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10.5px] font-bold text-ink-500 ring-1 ring-slate-200">
                {item.category}
              </span>
              <span className="text-[10.5px] font-semibold text-ink-300">약 {item.readMinutes}분</span>
            </div>
            <p className="mt-2 text-[14px] font-extrabold leading-snug text-ink-900">{item.title}</p>
            <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-ink-500">{item.summary}</p>
            <span className="mt-2.5 text-[11.5px] font-bold text-brand-700">읽어보기 →</span>
          </button>
        ))}
      </div>

      <AdSlot label="광고" />
    </div>
  )
}
