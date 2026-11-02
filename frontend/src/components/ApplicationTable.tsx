import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ApplicationForm } from "@/components/ApplicationForm"
import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDeleteApplication } from "@/hooks/useApplications"
import type { Application } from "@/types"

interface ApplicationTableProps {
  applications: Application[]
}

export function ApplicationTable({ applications }: ApplicationTableProps) {
  const remove = useDeleteApplication()

  function onDelete(application: Application) {
    if (!confirm(`Delete ${application.company}?`)) return
    remove.mutate(application.id, {
      onSuccess: () => toast.success("Application deleted"),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Job</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Applied</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((application) => (
          <TableRow key={application.id}>
            <TableCell>
              <div className="font-medium">{application.company}</div>
              {application.job_url ? (
                <a
                  href={application.job_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground underline"
                >
                  {application.job_title}
                </a>
              ) : (
                <div className="text-muted-foreground">{application.job_title}</div>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={application.status} />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {application.applied_date ?? "—"}
            </TableCell>
            <TableCell className="text-right">
              <ApplicationForm application={application}>
                <Button variant="ghost" size="icon" aria-label={`Edit ${application.company}`}>
                  <Pencil />
                </Button>
              </ApplicationForm>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${application.company}`}
                onClick={() => onDelete(application)}
              >
                <Trash2 />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
