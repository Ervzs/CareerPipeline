import { useState } from 'react'
import type { FormEvent } from 'react'
import { fieldErrorsOf, formMessageOf } from '../../lib/errors'
import { toDateTimeInput } from '../../lib/format'
import { useCompanies, useCreateApplication, useUpdateApplication } from '../../lib/queries'
import type { Application, ApplicationInput, Stage } from '../../lib/types'
import { Dialog } from '../Dialog'
import { FormError, SelectField, TextAreaField, TextField } from '../Field'
import { btnPrimary, btnSecondary } from '../styles'
import { useToast } from '../toast/useToast'

const NEW_COMPANY = 'new'

interface Props {
  stages: Stage[]
  /** Pass an application to edit it; omit to create one. */
  application?: Application
  /** Stage preselected when creating. */
  defaultStageId?: number
  onClose: () => void
}

export function ApplicationFormDialog({ stages, application, defaultStageId, onClose }: Props) {
  const editing = application !== undefined
  const companies = useCompanies()
  const create = useCreateApplication()
  const update = useUpdateApplication()
  const { showToast } = useToast()

  const [companyChoice, setCompanyChoice] = useState(String(application?.company ?? ''))
  const [companyName, setCompanyName] = useState('')
  const [stageId, setStageId] = useState(String(defaultStageId ?? stages[0]?.id ?? ''))
  const [jobTitle, setJobTitle] = useState(application?.job_title ?? '')
  const [description, setDescription] = useState(application?.job_description ?? '')
  const [listingUrl, setListingUrl] = useState(application?.listing_url ?? '')
  // A new application is usually added right after applying, so default to today.
  const [dateApplied, setDateApplied] = useState(() =>
    editing
      ? (application.date_applied ?? '')
      : toDateTimeInput(new Date().toISOString()).slice(0, 10),
  )
  const [error, setError] = useState<unknown>(null)

  const existing = companies.data ?? []
  const creatingCompany = companyChoice === NEW_COMPANY
  const fieldErrors = fieldErrorsOf(error)
  const pending = create.isPending || update.isPending

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const company: Pick<ApplicationInput, 'company' | 'company_name'> = creatingCompany
      ? { company_name: companyName }
      : { company: companyChoice ? Number(companyChoice) : null }
    const body = {
      ...company,
      job_title: jobTitle,
      job_description: description,
      listing_url: listingUrl,
      date_applied: dateApplied || null,
    }
    const done = (message: string) => () => {
      showToast(message, 'success')
      onClose()
    }

    if (editing) {
      update.mutate(
        { id: application.id, ...body },
        { onSuccess: done('Application saved.'), onError: setError },
      )
    } else {
      create.mutate(
        { ...body, stage: Number(stageId) },
        { onSuccess: done('Application added.'), onError: setError },
      )
    }
  }

  return (
    <Dialog title={editing ? 'Edit application' : 'Add application'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formMessageOf(error)} />

        <TextField
          label="Job title"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          error={fieldErrors.job_title}
          required
        />

        <TextField
          label="Listing URL"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={listingUrl}
          onChange={(e) => setListingUrl(e.target.value)}
          error={fieldErrors.listing_url}
          required={!editing}
        />

        <SelectField
          label="Company"
          value={creatingCompany ? NEW_COMPANY : companyChoice}
          onChange={(e) => setCompanyChoice(e.target.value)}
          error={creatingCompany ? undefined : fieldErrors.company}
          disabled={companies.isPending}
        >
          <option value="">No company</option>
          {existing.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
          <option value={NEW_COMPANY}>New company…</option>
        </SelectField>

        {creatingCompany && (
          <TextField
            label="New company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            error={fieldErrors.company_name ?? fieldErrors.company}
            required
          />
        )}

        {!editing && (
          <SelectField
            label="Stage"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            error={fieldErrors.stage}
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </SelectField>
        )}

        <TextField
          label="Date applied"
          type="date"
          value={dateApplied}
          onChange={(e) => setDateApplied(e.target.value)}
          error={fieldErrors.date_applied}
          hint="Leave empty for a job you haven't applied to yet."
        />

        <TextAreaField
          label="Job description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldErrors.job_description}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add application'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
