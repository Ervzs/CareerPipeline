import { stageColor } from '../../lib/stageColors'
import type { Application, Stage } from '../../lib/types'
import { ApplicationCard } from './ApplicationCard'

interface Props {
  stage: Stage
  index: number
  applications: Application[]
  onOpen?: (application: Application) => void
}

/** One column. The coloured line on top is the stage's "rail line". */
export function StageColumn({ stage, index, applications, onOpen }: Props) {
  const headingId = `stage-${stage.id}`
  return (
    <section
      aria-labelledby={headingId}
      className="flex max-h-full w-72 shrink-0 snap-start flex-col rounded-lg bg-white/60"
    >
      <div className="h-1 rounded-t-lg" style={{ background: stageColor(index) }} />
      <header className="flex items-baseline justify-between px-3 pt-3 pb-2">
        <h2 id={headingId} className="text-base font-bold">
          {stage.name}
        </h2>
        <span className="text-sm text-ink-soft" aria-label={`${applications.length} applications`}>
          {applications.length}
        </span>
      </header>
      <ul className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
        {applications.map((application) => (
          <li key={application.id}>
            <ApplicationCard application={application} onOpen={onOpen} />
          </li>
        ))}
        {applications.length === 0 && (
          <li className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-soft">
            No applications here yet
          </li>
        )}
      </ul>
    </section>
  )
}
