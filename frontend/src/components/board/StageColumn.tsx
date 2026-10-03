import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { columnDropId } from '../../lib/board'
import { stageColor } from '../../lib/stageColors'
import type { Application, Stage } from '../../lib/types'
import { SortableApplicationCard } from './SortableApplicationCard'

interface Props {
  stage: Stage
  index: number
  applications: Application[]
  onOpen?: (application: Application) => void
  onAdd?: (stageId: number) => void
  selectedId?: number | null
}

/** One column. The coloured line on top is the stage's "rail line". */
export function StageColumn({ stage, index, applications, onOpen, onAdd, selectedId }: Props) {
  const headingId = `stage-${stage.id}`
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(stage.id) })

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-h-full w-[82vw] max-w-72 shrink-0 sm:w-72 snap-start flex-col rounded-lg bg-white/60"
    >
      <div className="h-1 rounded-t-lg" style={{ background: stageColor(index) }} />
      <header className="flex items-baseline justify-between px-3 pt-3 pb-2">
        <h2 id={headingId} className="text-base font-bold">
          {stage.name}
        </h2>
        <span className="flex items-center gap-2">
          <span
            className="text-sm text-ink-soft"
            aria-label={`${applications.length} applications`}
          >
            {applications.length}
          </span>
          {onAdd && (
            <button
              type="button"
              className="rounded px-1.5 text-lg leading-none text-ink-soft hover:bg-mist hover:text-ink"
              aria-label={`Add application to ${stage.name}`}
              onClick={() => onAdd(stage.id)}
            >
              +
            </button>
          )}
        </span>
      </header>
      <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={`flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3 transition-colors ${
            isOver ? 'bg-signal/5' : ''
          }`}
        >
          {applications.map((application) => (
            <SortableApplicationCard
              key={application.id}
              application={application}
              onOpen={onOpen}
              selected={application.id === selectedId}
            />
          ))}
          {applications.length === 0 && (
            <li className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-soft">
              No applications here yet
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  )
}
