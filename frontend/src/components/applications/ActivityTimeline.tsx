import { useState } from 'react'
import type { FormEvent } from 'react'
import { fieldErrorsOf, formMessageOf } from '../../lib/errors'
import { formatDateTime, fromDateTimeInput, toDateTimeInput } from '../../lib/format'
import {
  useActivities,
  useCreateActivity,
  useDeleteActivity,
  useUpdateActivity,
} from '../../lib/queries'
import type { Activity, ActivityKind } from '../../lib/types'
import { FormError, SelectField, TextAreaField, TextField } from '../Field'
import { btnDangerGhost, btnGhost, btnPrimary, btnSecondary } from '../styles'

const KIND_LABELS: Record<ActivityKind, string> = {
  call: 'Call',
  interview: 'Interview',
  follow_up: 'Follow-up',
  other: 'Other',
}

interface FormProps {
  applicationId: number
  /** Pass an activity to edit it; omit to add a new one. */
  activity?: Activity
  onDone: () => void
}

function ActivityForm({ applicationId, activity, onDone }: FormProps) {
  const create = useCreateActivity(applicationId)
  const update = useUpdateActivity(applicationId)
  const [kind, setKind] = useState<ActivityKind>(activity?.kind ?? 'call')
  const [when, setWhen] = useState(() =>
    toDateTimeInput(activity?.occurred_at ?? new Date().toISOString()),
  )
  const [note, setNote] = useState(activity?.note ?? '')
  const [error, setError] = useState<unknown>(null)
  const fieldErrors = fieldErrorsOf(error)
  const pending = create.isPending || update.isPending

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const body = {
      kind,
      note,
      occurred_at: when ? fromDateTimeInput(when) : new Date().toISOString(),
    }
    const options = { onSuccess: onDone, onError: setError }
    if (activity) update.mutate({ id: activity.id, ...body }, options)
    else create.mutate(body, options)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-line p-3" noValidate>
      <FormError message={formMessageOf(error)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Type"
          value={kind}
          onChange={(e) => setKind(e.target.value as ActivityKind)}
          error={fieldErrors.kind}
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="When"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          error={fieldErrors.occurred_at}
        />
      </div>
      <TextAreaField
        label="Note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        error={fieldErrors.note}
        required
      />
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? 'Saving…' : activity ? 'Save note' : 'Add note'}
        </button>
      </div>
    </form>
  )
}

const kindLabel = (kind: string) => KIND_LABELS[kind as ActivityKind] ?? kind

function ActivityEntry({ activity, onEdit }: { activity: Activity; onEdit: () => void }) {
  const remove = useDeleteActivity(activity.application)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<unknown>(null)

  return (
    <li className="relative pb-5 last:pb-0">
      <span
        aria-hidden
        className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-surface bg-ink-soft"
      />
      <p className="text-sm">
        <span className="font-semibold">{kindLabel(activity.kind)}</span>
        <span className="text-ink-soft"> · {formatDateTime(activity.occurred_at)}</span>
      </p>
      <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{activity.note}</p>
      <FormError message={formMessageOf(error)} />
      <div className="-ml-3 mt-1 flex flex-wrap items-center gap-1">
        {confirming ? (
          <>
            <span className="pl-3 text-sm">Delete this note?</span>
            <button
              type="button"
              className={btnDangerGhost}
              disabled={remove.isPending}
              onClick={() => remove.mutate(activity.id, { onError: setError })}
            >
              Yes, delete
            </button>
            <button type="button" className={btnGhost} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={btnGhost}
              aria-label={`Edit ${kindLabel(activity.kind).toLowerCase()} note`}
              onClick={onEdit}
            >
              Edit
            </button>
            <button
              type="button"
              className={btnDangerGhost}
              aria-label={`Delete ${kindLabel(activity.kind).toLowerCase()} note`}
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  )
}

/** Calls, interviews and follow-ups for one application, newest first. */
export function ActivityTimeline({ applicationId }: { applicationId: number }) {
  const activities = useActivities(applicationId)
  const [mode, setMode] = useState<'idle' | 'adding' | { editing: number }>('idle')
  const close = () => setMode('idle')

  return (
    <div>
      {activities.isPending && <p className="text-sm text-ink-soft">Loading activity…</p>}
      {activities.isError && (
        <p className="text-sm text-danger">
          Couldn't load the activity.{' '}
          <button type="button" className="underline" onClick={() => void activities.refetch()}>
            Try again
          </button>
        </p>
      )}
      {activities.data?.length === 0 && mode !== 'adding' && (
        <p className="text-sm text-ink-soft">
          No activity yet. Log a call, an interview or a follow-up.
        </p>
      )}

      {activities.data && activities.data.length > 0 && (
        <ol aria-label="Activity" className="ml-1.5 border-l-2 border-line pl-5">
          {activities.data.map((activity) =>
            typeof mode === 'object' && mode.editing === activity.id ? (
              <li key={activity.id} className="pb-5 last:pb-0">
                <ActivityForm applicationId={applicationId} activity={activity} onDone={close} />
              </li>
            ) : (
              <ActivityEntry
                key={activity.id}
                activity={activity}
                onEdit={() => setMode({ editing: activity.id })}
              />
            ),
          )}
        </ol>
      )}

      {mode === 'adding' ? (
        <div className="mt-3">
          <ActivityForm applicationId={applicationId} onDone={close} />
        </div>
      ) : (
        <button type="button" className={`${btnSecondary} mt-3`} onClick={() => setMode('adding')}>
          Add note
        </button>
      )}
    </div>
  )
}
