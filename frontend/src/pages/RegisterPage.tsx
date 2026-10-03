import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FormError, TextField } from '../components/Field'
import { btnPrimary } from '../components/styles'
import { ApiError } from '../lib/api'
import { AuthLayout } from './AuthLayout'

export default function RegisterPage() {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [busy, setBusy] = useState(false)

  const fieldErrors = error instanceof ApiError ? error : null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await register(email, password) // the route guard redirects to the board
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
      setBusy(false)
    }
  }

  // Password problems arrive as a list (too short, too common, ...): show them all.
  const passwordDetail = fieldErrors?.details.password
  const passwordError = Array.isArray(passwordDetail) ? passwordDetail.join(' ') : passwordDetail
  const hasFieldError = Boolean(fieldErrors?.fieldError('email') || passwordError)
  const formMessage = !error
    ? null
    : fieldErrors && hasFieldError
      ? null
      : fieldErrors
        ? fieldErrors.message
        : "Can't reach the server. Check your connection and try again."

  return (
    <AuthLayout title="Create your account" subtitle="Start tracking your applications today.">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
        <FormError message={formMessage} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors?.fieldError('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          hint="At least 8 characters. Avoid common passwords."
        />
        <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-8 text-sm text-ink-soft">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-signal hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
