import type { ButtonHTMLAttributes } from 'react'
import { appliedLabel } from '../../lib/format'
import type { Application } from '../../lib/types'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className'> {
  application: Application
  onOpen?: (application: Application) => void
  /** True for the floating copy that follows the pointer while dragging. */
  lifted?: boolean
  /** True for the card whose details are open. */
  selected?: boolean
}

/** The visual card. Extra button props let the sortable wrapper attach drag handlers. */
export function ApplicationCard({
  application,
  onOpen,
  lifted = false,
  selected = false,
  ...buttonProps
}: Props) {
  return (
    <button
      {...buttonProps}
      type="button"
      onClick={() => onOpen?.(application)}
      aria-current={selected || undefined}
      className={`block w-full rounded-md border bg-surface p-3 text-left transition-colors ${
        lifted
          ? 'border-signal shadow-xl'
          : selected
            ? 'border-signal ring-1 ring-signal'
            : 'border-line hover:border-ink-soft'
      }`}
    >
      <span className="block font-medium leading-snug">{application.job_title}</span>
      <span className="mt-0.5 block text-sm text-ink-soft">{application.company_detail.name}</span>
      <span className="mt-2 block text-xs text-ink-soft">
        {appliedLabel(application.date_applied)}
      </span>
    </button>
  )
}
