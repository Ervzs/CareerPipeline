import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '../components/Spinner'
import { useAuth } from './useAuth'

/** Renders the child routes only for signed-in users; everyone else goes to the login page. */
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Spinner label="Restoring your session" />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Login and register pages: signed-in users skip straight to the board. */
export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'loading') return <Spinner label="Restoring your session" />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
