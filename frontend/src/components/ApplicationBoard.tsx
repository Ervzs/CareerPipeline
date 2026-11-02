import { ApplicationCard } from "@/components/ApplicationCard"
import { StatusBadge } from "@/components/StatusBadge"
import { STATUSES, type Application } from "@/types"

interface ApplicationBoardProps {
  applications: Application[]
}

export function ApplicationBoard({ applications }: ApplicationBoardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {STATUSES.map((status) => {
        const cards = applications.filter((application) => application.status === status)
        return (
          <section key={status} className="space-y-2 rounded-xl border bg-muted/40 p-2">
            <h2 className="flex items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-sm text-muted-foreground">{cards.length}</span>
            </h2>
            {cards.map((application) => (
              <ApplicationCard key={application.id} application={application} />
            ))}
          </section>
        )
      })}
    </div>
  )
}
