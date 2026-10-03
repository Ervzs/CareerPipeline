import type { Application } from './types'

/** Applications grouped by stage id, each group sorted by `position`. */
export function groupByStage(applications: Application[]): Map<number, Application[]> {
  const groups = new Map<number, Application[]>()
  for (const application of applications) {
    const group = groups.get(application.stage)
    if (group) group.push(application)
    else groups.set(application.stage, [application])
  }
  for (const group of groups.values()) group.sort((a, b) => a.position - b.position)
  return groups
}

const DROP_PREFIX = 'stage:'

/** Id of a column's drop zone, so cards can be dropped into empty columns. */
export const columnDropId = (stageId: number) => `${DROP_PREFIX}${stageId}`

/** The stage id behind a drop-zone id, or undefined if `id` is not one (e.g. a card id). */
export function stageIdFromDropId(id: string | number): number | undefined {
  return typeof id === 'string' && id.startsWith(DROP_PREFIX)
    ? Number(id.slice(DROP_PREFIX.length))
    : undefined
}

const renumber = (list: Application[]) => list.map((a, index) => ({ ...a, position: index }))

/**
 * Predict the server's result of `PATCH /applications/{id}/move/`: the card lands at
 * `position` (zero-based, clamped) in `stageId`, and the source and target columns are
 * re-sequenced to 0..n-1. Used for optimistic updates, so it must match the backend rules.
 */
export function moveApplication(
  applications: Application[],
  id: number,
  stageId: number,
  position: number,
): Application[] {
  const moving = applications.find((a) => a.id === id)
  if (!moving) return applications

  const sourceStage = moving.stage
  const column = (stage: number) =>
    applications
      .filter((a) => a.stage === stage && a.id !== id)
      .sort((a, b) => a.position - b.position)

  const target = column(stageId)
  target.splice(Math.max(0, Math.min(position, target.length)), 0, { ...moving, stage: stageId })
  const source = stageId === sourceStage ? [] : column(sourceStage)

  const untouched = applications.filter((a) => a.stage !== stageId && a.stage !== sourceStage)
  return [...untouched, ...renumber(target), ...renumber(source)]
}
