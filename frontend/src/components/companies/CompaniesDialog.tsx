import { useMemo, useState } from 'react'
import { formMessageOf } from '../../lib/errors'
import { useApplications, useCompanies, useDeleteCompany } from '../../lib/queries'
import { Dialog } from '../Dialog'
import { FormError } from '../Field'
import { btnDangerGhost, btnGhost } from '../styles'
import { CompanyForm } from './CompanyForm'

/** All companies, with edit and delete. A company with applications can't be deleted. */
export function CompaniesDialog({ onClose }: { onClose: () => void }) {
  const companies = useCompanies()
  const applications = useApplications()
  const remove = useDeleteCompany()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<unknown>(null)

  const counts = useMemo(() => {
    const result = new Map<number, number>()
    for (const application of applications.data ?? []) {
      result.set(application.company, (result.get(application.company) ?? 0) + 1)
    }
    return result
  }, [applications.data])

  return (
    <Dialog title="Companies" onClose={onClose}>
      <p className="mb-4 text-sm text-ink-soft">
        A company can only be deleted once it has no applications.
      </p>
      <div className="mb-3">
        <FormError message={formMessageOf(error)} />
      </div>

      {companies.isPending && <p className="text-sm text-ink-soft">Loading companies…</p>}
      {companies.isError && (
        <p className="text-sm text-danger">
          Couldn't load your companies.{' '}
          <button type="button" className="underline" onClick={() => void companies.refetch()}>
            Try again
          </button>
        </p>
      )}
      {companies.data?.length === 0 && (
        <p className="rounded-md border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          No companies yet. They are created when you add an application.
        </p>
      )}

      <ul className="space-y-2" aria-label="Companies">
        {companies.data?.map((company) => {
          const count = counts.get(company.id) ?? 0
          return (
            <li key={company.id} className="rounded-md border border-line p-3">
              {editingId === company.id ? (
                <CompanyForm company={company} onDone={() => setEditingId(null)} />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{company.name}</p>
                    <p className="text-sm text-ink-soft">
                      {count === 1 ? '1 application' : `${count} applications`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btnGhost}
                    aria-label={`Edit ${company.name}`}
                    onClick={() => {
                      setError(null)
                      setEditingId(company.id)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={btnDangerGhost}
                    aria-label={`Delete ${company.name}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      setError(null)
                      remove.mutate(company.id, { onError: setError })
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}
