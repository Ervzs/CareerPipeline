import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FormError, TextField } from '../components/Field'
import { btnPrimary, btnSecondary } from '../components/styles'
import { ApiError } from '../lib/api'
import { AuthLayout } from './AuthLayout'

export default function LoginPage() {
  const { login, loginDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action() // on success the route guard redirects to the board
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Email or password is incorrect.'
          : "Can't reach the server. Check your connection and try again.",
      )
      setBusy(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void run(() => login(email, password))
  }

  return (
    <AuthLayout title="Log in" subtitle="Pick up where your search left off.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-sm text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        className={`${btnSecondary} w-full`}
        disabled={busy}
        onClick={() => void run(loginDemo)}
      >
        Try the demo
      </button>
      <p className="mt-2 text-center text-sm text-ink-soft">
        Explore a board filled with sample applications. No sign-up needed.
      </p>

      <p className="mt-8 text-sm text-ink-soft">
        New here?{' '}
        <Link to="/register" className="font-semibold text-signal hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
