import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  label?: string
  size?: 'sm' | 'md' | 'lg'
  bare?: boolean
}

export default function Modal({ open, onClose, children, label, size = 'md', bare = false }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const maxWidth = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-2xl'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={label}>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink-900/45 backdrop-blur-[2px]"
      />
      <div
        className={`relative z-10 max-h-[92vh] w-full overflow-hidden ${bare ? '' : 'modal-panel'} ${maxWidth} animate-fade-up sm:mx-4`}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
  right,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  right?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-extrabold tracking-tight text-ink-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-ink-500 transition hover:bg-slate-200"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
