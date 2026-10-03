import { formatShortDate } from '../../lib/format'
import type { Dashboard } from '../../lib/types'

/** Applications sent per week, oldest week on the left. */
export function WeeklyBars({ weeks }: { weeks: Dashboard['weeks'] }) {
  const max = Math.max(1, ...weeks.map((week) => week.count))
  return (
    <ol aria-label="Applications per week" className="flex h-52 items-end gap-1 sm:gap-2">
      {weeks.map((week, index) => {
        const label = formatShortDate(week.week_start)
        return (
          <li
            key={week.week_start}
            aria-label={`${week.count} applications, week of ${label}`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <span aria-hidden className="mb-1 text-center text-xs tabular-nums">
              {week.count > 0 ? week.count : ''}
            </span>
            <span
              aria-hidden
              className={`block w-full rounded-t bg-signal ${week.count === 0 ? 'h-px bg-line' : ''}`}
              style={week.count > 0 ? { height: `${(week.count / max) * 80}%` } : undefined}
            />
            {/* Every other week is labelled so each label has room; it centres over its bar. */}
            <span aria-hidden className="mt-1.5 flex justify-center">
              <span
                className={`text-[0.65rem] whitespace-nowrap text-ink-soft sm:text-xs ${
                  index % 2 === 1 ? 'invisible' : ''
                }`}
              >
                {label}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
