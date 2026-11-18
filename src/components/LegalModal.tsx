import Modal, { ModalHeader } from './Modal'
import { LEGAL_CONTACT, LEGAL_DOCS, LEGAL_UPDATED, renderInline, type LegalBlock, type LegalDocument } from '../lib/legal'

export type LegalKind = 'privacy' | 'terms'

interface Props {
  kind: LegalKind | null
  onClose: () => void
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'h4' && block.text) {
    return <p className="mt-2 font-bold text-ink-700">{renderInline(block.text)}</p>
  }
  if (block.type === 'ul' && block.items?.length) {
    return (
      <ul className="list-disc space-y-1 pl-4">
        {block.items.map((item) => (
          <li key={item.slice(0, 24)}>{renderInline(item)}</li>
        ))}
      </ul>
    )
  }
  if (block.type === 'note' && block.text) {
    return (
      <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-ink-500">
        {renderInline(block.text)}
      </p>
    )
  }
  if (block.text) return <p>{renderInline(block.text)}</p>
  return null
}

function DocumentBody({ doc }: { doc: LegalDocument }) {
  return (
    <>
      {doc.intro ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-ink-500">{renderInline(doc.intro)}</p>
      ) : null}
      {doc.sections.map((section) => (
        <section key={section.title} className="mt-4 first:mt-0">
          <h3 className="text-[13.5px] font-extrabold text-ink-900">{section.title}</h3>
          <div className="mt-1 space-y-1.5 text-[12.5px] leading-[1.8] text-ink-600">
            {section.blocks.map((block, index) => (
              <Block key={`${section.title}-${index}`} block={block} />
            ))}
          </div>
        </section>
      ))}
      <p className="mt-4 border-t border-slate-100 pt-2 text-[11.5px] leading-relaxed text-ink-400">
        시행일 {LEGAL_UPDATED} · 문의 {LEGAL_CONTACT}
      </p>
    </>
  )
}

export default function LegalModal({ kind, onClose }: Props) {
  if (!kind) return null
  const doc = LEGAL_DOCS[kind]
  return (
    <Modal open onClose={onClose} size="md" label={doc.title}>
      <ModalHeader title={doc.title} subtitle={`시행일 ${LEGAL_UPDATED} · 보조금 레이더`} onClose={onClose} />
      <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
        <DocumentBody doc={doc} />
      </div>
    </Modal>
  )
}
