import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../../lib/api'
import {
  useCreateStage,
  useDeleteStage,
  useRenameStage,
  useReorderStages,
  useStages,
} from '../../lib/queries'
import type { Stage } from '../../lib/types'
import { Dialog } from '../Dialog'
import { FormError, TextField } from '../Field'
import { btnGhost, btnPrimary, btnSecondary, inputClass } from '../styles'

/** Pull the most useful message out of any error from a stage request. */
function describe(error: unknown): string {
  if (error instanceof ApiError) return error.fieldError('name') ?? error.message
  return "Can't reach the server. Check your connection and try again."
}

function StageRow({ stage, onError }: { stage: Stage; onError: (message: string | null) => void }) {
  const rename = useRenameStage()
  const remove = useDeleteStage()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(stage.name)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  })

  function save(event: FormEvent) {
    event.preventDefault()
    onError(null)
    rename.mutate(
      { id: stage.id, name },
      {
        onSuccess: () => setEditing(false),
        onError: (error) => onError(describe(error)),
      },
    )
  }

  function destroy() {
    onError(null)
    remove.mutate(stage.id, { onError: (error) => onError(describe(error)) })
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border border-line bg-surface p-2 ${
        isDragging ? 'z-10 opacity-70 shadow-lg' : ''
      }`}
    >
      <button
        type="button"
        className={`${btnGhost} cursor-grab touch-none px-2`}
        aria-label={`Reorder ${stage.name}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      {editing ? (
        <form onSubmit={save} className="flex flex-1 items-center gap-2">
          <input
            aria-label={`Name for ${stage.name}`}
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          <button type="submit" className={btnPrimary} disabled={rename.isPending}>
            Save
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              setEditing(false)
              setName(stage.name)
              onError(null)
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span className="flex-1 truncate font-medium">{stage.name}</span>
          <button
            type="button"
            className={btnGhost}
            aria-label={`Rename ${stage.name}`}
            onClick={() => setEditing(true)}
          >
            Rename
          </button>
          <button
            type="button"
            className={`${btnGhost} text-danger hover:text-danger`}
            onClick={destroy}
            aria-label={`Delete ${stage.name}`}
            disabled={remove.isPending}
          >
            Delete
          </button>
        </>
      )}
    </li>
  )
}

/** Add, rename, delete and reorder pipeline stages. */
export function StageSettingsPanel({ onClose }: { onClose: () => void }) {
  const stages = useStages()
  const create = useCreateStage()
  const reorder = useReorderStages()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || !stages.data) return
    const ids = stages.data.map((stage) => stage.id)
    const next = arrayMove(ids, ids.indexOf(active.id as number), ids.indexOf(over.id as number))
    setError(null)
    reorder.mutate(next)
  }

  function add(event: FormEvent) {
    event.preventDefault()
    setError(null)
    create.mutate(newName, {
      onSuccess: () => setNewName(''),
      onError: (e) => setError(describe(e)),
    })
  }

  return (
    <Dialog title="Pipeline settings" variant="drawer" onClose={onClose}>
      <p className="mb-4 text-sm text-ink-soft">
        Stages are the columns of your board, from left to right. Drag the handle to reorder them. A
        stage can only be deleted once it has no applications.
      </p>

      <div className="mb-3">
        <FormError message={error} />
      </div>

      {stages.isPending && <p className="text-sm text-ink-soft">Loading stages…</p>}
      {stages.isError && (
        <p className="text-sm text-danger">
          Couldn't load your stages.{' '}
          <button type="button" className="underline" onClick={() => void stages.refetch()}>
            Try again
          </button>
        </p>
      )}

      {stages.data && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={stages.data.map((stage) => stage.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2" aria-label="Stages">
              {stages.data.map((stage) => (
                <StageRow key={stage.id} stage={stage} onError={setError} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <form onSubmit={add} className="mt-6 flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="New stage"
            placeholder="e.g. Phone screen"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
        </div>
        <button type="submit" className={btnSecondary} disabled={create.isPending}>
          Add stage
        </button>
      </form>
    </Dialog>
  )
}
