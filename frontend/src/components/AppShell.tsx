import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { btnGhost } from './styles'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-mist hover:text-ink'
  }`

/** Top bar shared by every signed-in page. */
export function AppShell() {
  const { user, logout } = useAuth()
  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="flex items-center gap-4 px-4 py-2.5 sm:px-6">
          <span className="font-display text-lg font-bold">CareerPipeline</span>
          <nav aria-label="Main" className="flex gap-1">
            <NavLink to="/" end className={navClass}>
              Board
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-[16rem] truncate text-sm text-ink-soft sm:inline">
              {user?.email}
            </span>
            <button type="button" className={btnGhost} onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
