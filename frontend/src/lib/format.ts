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
