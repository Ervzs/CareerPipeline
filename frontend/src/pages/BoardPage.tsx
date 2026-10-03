import { useMemo } from 'react'
import { StageColumn } from '../components/board/StageColumn'
import { Spinner } from '../components/Spinner'
import { btnSecondary } from '../components/styles'
import { useApplications, useStages } from '../lib/queries'
import type { Application } from '../lib/types'

export default function BoardPage() {
  const stages = useStages()
  const applications = useApplications()

  // The API already returns applications in board order; group them per stage.
  const byStage = useMemo(() => {
    const groups = new Map<number, Application[]>()
    for (const application of applications.data ?? []) {
      groups.set(application.stage, [...(groups.get(application.stage) ?? []), application])
    }
    return groups
  }, [applications.data])

  if (stages.isPending || applications.isPending) return <Spinner label="Loading your pipeline" />

  if (stages.isError || applications.isError) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Couldn't load your pipeline</h1>
        <p className="mt-2 text-ink-soft">
          Check your connection, then try again. Your data hasn't changed.
        </p>
        <button
          type="button"
          className={`${btnSecondary} mt-4`}
          onClick={() => {
            void stages.refetch()
            void applications.refetch()
          }}
        >
          Try again
        </button>
      </main>
    )
  }

  const isEmpty = applications.data.length === 0

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-5 pb-3 sm:px-6">
        <h1 className="text-2xl font-bold">Your pipeline</h1>
        {isEmpty && (
          <p className="mt-1 text-ink-soft">
            No applications yet. Add your first one to start the board.
          </p>
        )}
      </div>
      <div className="flex flex-1 snap-x gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
        {stages.data.map((stage, index) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            index={index}
            applications={byStage.get(stage.id) ?? []}
          />
        ))}
      </div>
    </main>
  )
}
