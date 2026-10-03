import { useState } from 'react'
import type { FormEvent } from 'react'
import { fieldErrorsOf, formMessageOf } from '../../lib/errors'
import { useUpdateCompany } from '../../lib/queries'
import type { Company } from '../../lib/types'
import { FormError, TextAreaField, TextField } from '../Field'
import { btnPrimary, btnSecondary } from '../styles'

interface Props {
  company: Company
  onDone: () => void
}

/** Edit a company's name, website and notes. */
export function CompanyForm({ company, onDone }: Props) {
  const update = useUpdateCompany()
  const [name, setName] = useState(company.name)
  const [website, setWebsite] = useState(company.website)
  const [notes, setNotes] = useState(company.notes)
  const [error, setError] = useState<unknown>(null)
  const fieldErrors = fieldErrorsOf(error)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    update.mutate(
      { id: company.id, name, website, notes },
      { onSuccess: onDone, onError: setError },
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <FormError message={formMessageOf(error)} />
      <TextField
        label="Company name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        required
      />
      <TextField
        label="Website"
        type="url"
        inputMode="url"
        placeholder="https://"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        error={fieldErrors.website}
      />
      <TextAreaField
        label="Notes"
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        error={fieldErrors.notes}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className={btnPrimary} disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save company'}
        </button>
      </div>
    </form>
  )
}
