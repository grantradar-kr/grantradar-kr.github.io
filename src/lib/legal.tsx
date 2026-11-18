import type { ReactNode } from 'react'
import raw from '../content/legal.json'

export type LegalBlockType = 'p' | 'ul' | 'h4' | 'note'

export interface LegalBlock {
  type: LegalBlockType
  text?: string
  items?: string[]
}

export interface LegalSection {
  title: string
  blocks: LegalBlock[]
}

export interface LegalDocument {
  title: string
  intro?: string
  sections: LegalSection[]
}

const data = raw as unknown as {
  updated: string
  contact: string
  privacy: LegalDocument
  terms: LegalDocument
}

export const LEGAL_UPDATED = data.updated
export const LEGAL_CONTACT = data.contact
export const LEGAL_DOCS = { privacy: data.privacy, terms: data.terms } as const

const INLINE_RE = new RegExp('\\[([^\\]]+)\\]\\((https?:\\/\\/[^)\\s]+)\\)|\\*\\*([^*]+)\\*\\*', 'g')

/** `[라벨](주소)` 링크와 `**강조**` 만 지원하는 최소 인라인 렌더러 */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const lines = text.split('\n')
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) nodes.push(<br key={`br-${lineIndex}`} />)
    let lastIndex = 0
    let match: RegExpExecArray | null
    INLINE_RE.lastIndex = 0
    while ((match = INLINE_RE.exec(line)) !== null) {
      if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index))
      if (match[1] && match[2]) {
        nodes.push(
          <a
            key={`a-${lineIndex}-${match.index}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-700 underline"
          >
            {match[1]}
          </a>,
        )
      } else if (match[3]) {
        nodes.push(<b key={`b-${lineIndex}-${match.index}`}>{match[3]}</b>)
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < line.length) nodes.push(line.slice(lastIndex))
  })
  return nodes
}
