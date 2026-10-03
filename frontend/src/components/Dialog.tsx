import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { btnGhost } from './styles'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** `drawer` slides in from the right (full screen on phones); `modal` is centred. */
  variant?: 'drawer' | 'modal'
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible dialog: labelled, closes on Escape or backdrop click, keeps Tab inside,
 * moves focus in on open and returns it to the opener on close.
 */
export function Dialog({ title, onClose, children, variant = 'modal' }: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select')
    ;(first ?? panel)?.focus()
    return () => opener?.focus?.()
  }, [])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCloseRef.current()
      return
    }
    if (event.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const isDrawer = variant === 'drawer'
  return (
    <div
      className={`fixed inset-0 z-40 flex bg-ink/40 ${
        isDrawer ? 'justify-end' : 'items-end justify-center sm:items-center sm:p-4'
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`flex max-h-full w-full flex-col overflow-hidden bg-surface ${
          isDrawer ? 'h-full sm:max-w-md' : 'rounded-t-xl sm:max-w-lg sm:rounded-xl'
        }`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" className={btnGhost} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
