import { useState } from 'react'
import { ApplicationDetailsPanel } from '../components/applications/ApplicationDetailsPanel'
import { ApplicationFormDialog } from '../components/applications/ApplicationFormDialog'
import { Board } from '../components/board/Board'
import { CompaniesDialog } from '../components/companies/CompaniesDialog'
import { StageSettingsPanel } from '../components/settings/StageSettingsPanel'
import { Spinner } from '../components/Spinner'
import { btnPrimary, btnSecondary } from '../components/styles'
import { useApplications, useStages } from '../lib/queries'

/** Which dialog is open on the board, if any. */
type DialogState =
  null | { kind: 'add'; stageId?: number } | { kind: 'companies' } | { kind: 'settings' }

export default function BoardPage() {
  const [dialog, setDialog] = useState<DialogState>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const stages = useStages()
  const applications = useApplications()

  const close = () => setDialog(null)
  // Look the card up on every render so the panel always shows fresh data (or closes if it is gone).
  const selected = applications.data?.find((a) => a.id === selectedId)

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
      <div className="flex flex-col gap-3 px-4 pt-5 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold">Your pipeline</h1>
          {applications.data.length === 0 && (
            <p className="mt-1 text-ink-soft">
              No applications yet. Add your first one to start the board.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button type="button" className={btnPrimary} onClick={() => setDialog({ kind: 'add' })}>
            Add application
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setDialog({ kind: 'companies' })}
          >
            Companies
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setDialog({ kind: 'settings' })}
          >
            Pipeline settings
          </button>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <Board
            stages={stages.data}
            applications={applications.data}
            selectedId={selectedId}
            onOpen={(application) => setSelectedId(application.id)}
            onAdd={(stageId) => setDialog({ kind: 'add', stageId })}
          />
        </div>
        {selected && (
          <ApplicationDetailsPanel
            application={selected}
            stages={stages.data}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
      {dialog?.kind === 'add' && (
        <ApplicationFormDialog
          stages={stages.data}
          defaultStageId={dialog.stageId}
          onClose={close}
        />
      )}
      {dialog?.kind === 'companies' && <CompaniesDialog onClose={close} />}
      {dialog?.kind === 'settings' && <StageSettingsPanel onClose={close} />}
    </main>
  )
}
