const MS_PER_DAY = 86_400_000

/** Parse a YYYY-MM-DD date as local midnight (avoids the UTC off-by-one of `new Date(str)`). */
function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDate(value: string): string {
  return parseDate(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Jul 13": a compact label for chart axes. */
export function formatShortDate(value: string): string {
  return parseDate(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** "Applied today", "Applied 3 days ago", or the date once it is more than a month old. */
export function appliedLabel(dateApplied: string | null, now = new Date()): string {
  if (!dateApplied) return 'Not applied yet'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today.getTime() - parseDate(dateApplied).getTime()) / MS_PER_DAY)
  if (days <= 0) return 'Applied today'
  if (days === 1) return 'Applied yesterday'
  if (days <= 30) return `Applied ${days} days ago`
  return `Applied ${formatDate(dateApplied)}`
}

/** "Mar 4, 2026, 10:30 AM" in the viewer's locale and time zone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO timestamp -> value for <input type="datetime-local"> (local time, no seconds). */
export function toDateTimeInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value (local time) -> ISO timestamp. */
export function fromDateTimeInput(value: string): string {
  return new Date(value).toISOString()
}
