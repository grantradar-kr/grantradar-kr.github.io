import raw from '../content/guides.json'

export interface GuideTable {
  caption?: string
  headers: string[]
  rows: string[][]
}

export interface GuideSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
  table?: GuideTable
  note?: string
}

export interface GuideFaq {
  q: string
  a: string
}

export interface GuideSource {
  label: string
  url: string
}

export interface Guide {
  slug: string
  title: string
  summary: string
  category: string
  tags: string[]
  readMinutes: number
  updated: string
  lead: string
  takeaways?: string[]
  sections: GuideSection[]
  faq?: GuideFaq[]
  sources?: GuideSource[]
}

export interface SiteSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface SiteContent {
  intro: string[]
  sections: SiteSection[]
  operator: { name: string; email: string; note: string }
}

const content = raw as unknown as {
  updated: string
  site: SiteContent
  guides: Guide[]
}

export const GUIDES: Guide[] = content.guides
export const CONTENT_UPDATED: string = content.updated
export const SITE_CONTENT: SiteContent = content.site
export const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL ?? '').trim() || content.site.operator.email

export const GUIDE_CATEGORIES: string[] = Array.from(new Set(GUIDES.map((guide) => guide.category)))

export function guideBySlug(slug: string | null | undefined): Guide | null {
  if (!slug) return null
  return GUIDES.find((guide) => guide.slug === slug) ?? null
}

export function guideBodyText(guide: Guide): string {
  const parts: string[] = [guide.lead]
  for (const section of guide.sections) {
    parts.push(section.heading)
    parts.push(...(section.paragraphs ?? []))
    parts.push(...(section.bullets ?? []))
    if (section.table) {
      parts.push(section.table.caption ?? '')
      parts.push(...section.table.headers)
      for (const row of section.table.rows) parts.push(...row)
    }
  }
  for (const item of guide.faq ?? []) parts.push(item.q, item.a)
  return parts.join(' ')
}

export function guideCharCount(guide: Guide): number {
  return guideBodyText(guide).replace(/\s/g, '').length
}

export function relatedGuides(slug: string, limit = 3): Guide[] {
  const current = guideBySlug(slug)
  if (!current) return GUIDES.slice(0, limit)
  const scored = GUIDES.filter((guide) => guide.slug !== slug).map((guide) => {
    const sharedTags = guide.tags.filter((tag) => current.tags.includes(tag)).length
    const sameCategory = guide.category === current.category ? 1 : 0
    return { guide, score: sharedTags * 2 + sameCategory }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((item) => item.guide)
}

export function updatedLabel(value: string): string {
  return value.replace(/-/g, '.')
}
