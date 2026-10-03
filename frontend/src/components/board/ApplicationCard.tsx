import { appliedLabel } from '../../lib/format'
import type { Application } from '../../lib/types'

interface Props {
  application: Application
  onOpen?: (application: Application) => void
}

export function ApplicationCard({ application, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(application)}
      className="block w-full rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-ink-soft"
    >
      <span className="block font-medium leading-snug">{application.job_title}</span>
      <span className="mt-0.5 block text-sm text-ink-soft">{application.company_detail.name}</span>
      <span className="mt-2 block text-xs text-ink-soft">
        {appliedLabel(application.date_applied)}
      </span>
    </button>
  )
}
