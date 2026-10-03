import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { formatDate } from '../../lib/format'
import { formMessageOf } from '../../lib/errors'
import { useDeleteApplication } from '../../lib/queries'
import { stageColor } from '../../lib/stageColors'
import type { Application, Stage } from '../../lib/types'
import { CompanyEditDialog } from '../companies/CompanyEditDialog'
import { FormError } from '../Field'
import { btnDanger, btnGhost, btnSecondary } from '../styles'
import { useToast } from '../toast/useToast'
import { ApplicationFormDialog } from './ApplicationFormDialog'

interface Props {
  application: Application
  stages: Stage[]
  onClose: () => void
}

/** Only http(s) links are rendered as links, so a pasted `javascript:` URL can't run. */
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h3 className="mb-1.5 text-sm font-bold">{title}</h3>
      {children}
    </section>
  )
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-ink-soft">{children}</p>
)

/**
 * Details of the selected card. Sits beside the board on large screens and covers the
 * screen on small ones.
 */
export function ApplicationDetailsPanel({ application, stages, onClose }: Props) {
  const remove = useDeleteApplication()
  const { showToast } = useToast()
  const panelRef = useRef<HTMLElement>(null)
  const [editing, setEditing] = useState<'application' | 'company' | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const stageIndex = stages.findIndex((stage) => stage.id === application.stage)
  const company = application.company_detail
  const listingHref = application.listing_url ? safeHref(application.listing_url) : null
  const websiteHref = company.website ? safeHref(company.website) : null

  // Move focus to the panel when a card is opened so keyboard users land on its content.
  useEffect(() => {
    panelRef.current?.focus()
  }, [application.id])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !editing) onClose()
  }

  function destroy() {
    setError(null)
    remove.mutate(application.id, {
      onSuccess: () => {
        showToast('Application deleted.', 'success')
        onClose()
      },
      onError: setError,
    })
  }

  return (
    <>
      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-label="Application details"
        onKeyDown={onKeyDown}
        className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-surface lg:static lg:z-auto lg:w-[26rem] lg:shrink-0 lg:border-l lg:border-line"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-snug">{application.job_title}</h2>
            <p className="mt-0.5 text-ink-soft">{company.name}</p>
          </div>
          <button type="button" className={btnGhost} onClick={onClose} aria-label="Close details">
            ✕
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-soft">Stage</dt>
            <dd className="flex items-center gap-2 font-medium">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: stageColor(Math.max(stageIndex, 0)) }}
              />
              {stages[stageIndex]?.name ?? 'Unknown'}
            </dd>
            <dt className="text-ink-soft">Date applied</dt>
            <dd className="font-medium">
              {application.date_applied ? formatDate(application.date_applied) : 'Not applied yet'}
            </dd>
            <dt className="text-ink-soft">Listing</dt>
            <dd className="min-w-0 font-medium">
              {listingHref ? (
                <a
                  href={listingHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-signal hover:underline"
                >
                  {new URL(listingHref).hostname}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="text-ink-soft">
                  {application.listing_url ? 'Invalid link' : 'None'}
                </span>
              )}
            </dd>
          </dl>

          <Section title="Job description">
            {application.job_description ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {application.job_description}
              </p>
            ) : (
              <Empty>No description yet. Use Edit to paste the job posting.</Empty>
            )}
          </Section>

          <Section title={`About ${company.name}`}>
            {websiteHref && (
              <p className="mb-1.5 text-sm">
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-signal hover:underline"
                >
                  {new URL(websiteHref).hostname}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            )}
            {company.notes ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{company.notes}</p>
            ) : (
              <Empty>No notes about this company yet.</Empty>
            )}
            <button
              type="button"
              className={`${btnGhost} -ml-3 mt-1`}
              onClick={() => setEditing('company')}
            >
              Edit company
            </button>
          </Section>

          <div className="space-y-3 border-t border-line pt-4">
            <FormError message={formMessageOf(error)} />
            {confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">Delete this application?</span>
                <button
                  type="button"
                  className={btnDanger}
                  onClick={destroy}
                  disabled={remove.isPending}
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep it
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setEditing('application')}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`${btnGhost} text-danger hover:text-danger`}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {editing === 'application' && (
        <ApplicationFormDialog
          stages={stages}
          application={application}
          onClose={() => setEditing(null)}
        />
      )}
      {editing === 'company' && (
        <CompanyEditDialog company={company} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
