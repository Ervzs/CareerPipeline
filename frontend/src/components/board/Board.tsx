import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent, UniqueIdentifier } from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { groupByStage, stageIdFromDropId } from '../../lib/board'
import { useMoveApplication } from '../../lib/queries'
import type { Application, Stage } from '../../lib/types'
import { ApplicationCard } from './ApplicationCard'
import { StageColumn } from './StageColumn'

/** stage id -> ordered application ids */
type Columns = Record<number, number[]>

function findColumn(id: UniqueIdentifier, columns: Columns): number | undefined {
  const dropZoneStage = stageIdFromDropId(id)
  if (dropZoneStage !== undefined) return dropZoneStage
  return Object.keys(columns)
    .map(Number)
    .find((stageId) => columns[stageId].includes(id as number))
}

interface Props {
  stages: Stage[]
  applications: Application[]
  onOpen?: (application: Application) => void
}

export function Board({ stages, applications, onOpen }: Props) {
  const move = useMoveApplication()

  const byId = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications])
  const serverColumns = useMemo<Columns>(() => {
    const groups = groupByStage(applications)
    return Object.fromEntries(
      stages.map((stage) => [stage.id, (groups.get(stage.id) ?? []).map((a) => a.id)]),
    )
  }, [stages, applications])

  // While a card is being dragged we show a local copy of the columns so the card can
  // hop between columns live. Nothing is sent to the server until the card is dropped.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const columns = dragColumns ?? serverColumns

  const sensors = useSensors(
    // A small movement threshold keeps plain clicks (open details) from becoming drags.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On touch screens, press and hold briefly so scrolling the board still works.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Space picks up a card, arrows move it. Enter stays free to open the details.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )

  const reset = () => {
    setDragColumns(null)
    setActiveId(null)
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as number)
    setDragColumns(serverColumns)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragColumns) return
    const from = findColumn(active.id, dragColumns)
    const to = findColumn(over.id, dragColumns)
    if (from === undefined || to === undefined || from === to) return

    setDragColumns((current) => {
      if (!current) return current
      const target = [...current[to]]
      const overIndex = target.indexOf(over.id as number)
      const translated = active.rect.current.translated
      const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false
      // Dropping on the column itself (not on a card) appends to the end.
      target.splice(
        overIndex === -1 ? target.length : overIndex + (below ? 1 : 0),
        0,
        active.id as number,
      )
      return { ...current, [from]: current[from].filter((id) => id !== active.id), [to]: target }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const current = dragColumns
    reset()
    if (!over || !current) return

    const id = active.id as number
    const stageId = findColumn(id, current)
    if (stageId === undefined || stageId !== findColumn(over.id, current)) return

    let ids = current[stageId]
    const from = ids.indexOf(id)
    const to = ids.indexOf(over.id as number)
    if (to !== -1 && from !== to) ids = arrayMove(ids, from, to)
    const position = ids.indexOf(id)

    const original = byId.get(id)
    if (!original || (original.stage === stageId && original.position === position)) return
    move.mutate({ id, stage: stageId, position })
  }

  const activeApplication = activeId === null ? null : byId.get(activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      <div className="flex flex-1 snap-x gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
        {stages.map((stage, index) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            index={index}
            applications={(columns[stage.id] ?? []).flatMap((id) => byId.get(id) ?? [])}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>
        {activeApplication ? <ApplicationCard application={activeApplication} lifted /> : null}
      </DragOverlay>
    </DndContext>
  )
}
