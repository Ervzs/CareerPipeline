import { useState } from 'react'
import { Board } from '../components/board/Board'
import { StageSettingsPanel } from '../components/settings/StageSettingsPanel'
import { Spinner } from '../components/Spinner'
import { btnSecondary } from '../components/styles'
import { useApplications, useStages } from '../lib/queries'

export default function BoardPage() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const stages = useStages()
  const applications = useApplications()

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

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 px-4 pt-5 pb-3 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold">Your pipeline</h1>
          {applications.data.length === 0 && (
            <p className="mt-1 text-ink-soft">
              No applications yet. Add your first one to start the board.
            </p>
          )}
        </div>
        <button type="button" className={btnSecondary} onClick={() => setSettingsOpen(true)}>
          Pipeline settings
        </button>
      </div>
      <Board stages={stages.data} applications={applications.data} />
      {settingsOpen && <StageSettingsPanel onClose={() => setSettingsOpen(false)} />}
    </main>
  )
}
