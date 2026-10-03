import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Application } from '../../lib/types'
import { ApplicationCard } from './ApplicationCard'

interface Props {
  application: Application
  onOpen?: (application: Application) => void
}

export function SortableApplicationCard({ application, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
    >
      <ApplicationCard application={application} onOpen={onOpen} {...attributes} {...listeners} />
    </li>
  )
}
