import { LogOut, Plus } from "lucide-react"

import { ApplicationBoard } from "@/components/ApplicationBoard"
import { ApplicationForm } from "@/components/ApplicationForm"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useApplications } from "@/hooks/useApplications"
import { useLogout } from "@/hooks/useAuth"
import type { User } from "@/types"

interface ApplicationsPageProps {
  user: User
}

export function ApplicationsPage({ user }: ApplicationsPageProps) {
  const applications = useApplications()
  const logout = useLogout()

  return (
    <main className="flex min-h-svh flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:h-svh">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Applications</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <ApplicationForm>
            <Button>
              <Plus /> Add
            </Button>
          </ApplicationForm>
          <Button variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>
            <LogOut /> Log out
          </Button>
        </div>
      </header>

      {applications.isPending && <p className="text-muted-foreground">Loading...</p>}

      {applications.error && (
        <Alert variant="destructive">
          <AlertDescription>{applications.error.message}</AlertDescription>
        </Alert>
      )}

      {applications.data?.length === 0 && (
        <p className="text-muted-foreground">No applications yet. Add your first one.</p>
      )}

      {!!applications.data?.length && <ApplicationBoard applications={applications.data} />}
    </main>
  )
}
