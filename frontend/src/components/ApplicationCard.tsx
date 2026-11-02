import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ApplicationForm } from "@/components/ApplicationForm"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useDeleteApplication } from "@/hooks/useApplications"
import type { Application } from "@/types"

interface ApplicationCardProps {
  application: Application
}

export function ApplicationCard({ application }: ApplicationCardProps) {
  const remove = useDeleteApplication()

  function onDelete() {
    if (!confirm(`Delete ${application.company}?`)) return
    remove.mutate(application.id, {
      onSuccess: () => toast.success("Application deleted"),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{application.company}</CardTitle>
        <CardDescription>
          {application.job_url ? (
            <a href={application.job_url} target="_blank" rel="noreferrer" className="underline">
              {application.job_title}
            </a>
          ) : (
            application.job_title
          )}
        </CardDescription>
        <CardAction>
          <ApplicationForm application={application}>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${application.company}`}>
              <Pencil />
            </Button>
          </ApplicationForm>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${application.company}`}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </CardAction>
      </CardHeader>
      {application.applied_date && (
        <CardContent className="text-xs text-muted-foreground">
          Applied {application.applied_date}
        </CardContent>
      )}
    </Card>
  )
}
