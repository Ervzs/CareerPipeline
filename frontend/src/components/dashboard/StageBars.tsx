import { stageColor } from '../../lib/stageColors'
import type { Dashboard } from '../../lib/types'

/** One horizontal bar per stage, in board order, in the stage's line colour. */
export function StageBars({ stages }: { stages: Dashboard['stages'] }) {
  const max = Math.max(1, ...stages.map((stage) => stage.count))
  return (
    <ul aria-label="Applications per stage" className="space-y-3">
      {stages.map((stage, index) => (
        <li key={stage.stage} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3">
          <span className="truncate text-sm font-medium">{stage.name}</span>
          <span aria-hidden className="h-3 rounded-full bg-mist">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${(stage.count / max) * 100}%`,
                background: stageColor(index),
              }}
            />
          </span>
          <span className="text-right text-sm tabular-nums">{stage.count}</span>
        </li>
      ))}
    </ul>
  )
}
