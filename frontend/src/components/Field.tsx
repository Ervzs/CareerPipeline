import { useId } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { inputClass } from './styles'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

/** Label + control + error/hint, wired together for screen readers. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children({ id, describedBy: message ? messageId : undefined, invalid: Boolean(error) })}
      {message && (
        <p
          id={messageId}
          className={`mt-1 text-sm ${error ? 'text-danger' : 'text-ink-soft'}`}
          role={error ? 'alert' : undefined}
        >
          {message}
        </p>
      )}
    </div>
  )
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  error?: string
  hint?: string
}

export function TextField({ label, error, hint, ...input }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <input
          {...input}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${inputClass} ${invalid ? 'border-danger' : ''}`}
        />
      )}
    </Field>
  )
}

/** A form-level error (not tied to one field). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label: string
  error?: string
  children: ReactNode
}

export function SelectField({ label, error, children, ...select }: SelectFieldProps) {
  return (
    <Field label={label} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          {...select}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${inputClass} ${invalid ? 'border-danger' : ''}`}
        >
          {children}
        </select>
      )}
    </Field>
  )
}

interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className'
> {
  label: string
  error?: string
}

export function TextAreaField({ label, error, ...textarea }: TextAreaFieldProps) {
  return (
    <Field label={label} error={error}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...textarea}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${inputClass} ${invalid ? 'border-danger' : ''}`}
        />
      )}
    </Field>
  )
}
