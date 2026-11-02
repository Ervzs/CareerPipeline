import { zodResolver } from "@hookform/resolvers/zod"
import { useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useSaveApplication } from "@/hooks/useApplications"
import { STATUSES, type Application } from "@/types"

const schema = z.object({
  company: z.string().trim().min(1, "Company is required"),
  job_title: z.string().trim().min(1, "Job title is required"),
  status: z.enum(STATUSES),
  job_url: z.url("Enter a full link, like https://...").or(z.literal("")),
  applied_date: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>

interface ApplicationFormProps {
  application?: Application
  children: ReactNode
}

export function ApplicationForm({ application, children }: ApplicationFormProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{application ? "Edit application" : "Add application"}</DialogTitle>
        </DialogHeader>
        <FormBody application={application} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

interface FormBodyProps {
  application?: Application
  onSaved: () => void
}

function FormBody({ application, onSaved }: FormBodyProps) {
  const save = useSaveApplication()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company: application?.company ?? "",
      job_title: application?.job_title ?? "",
      status: application?.status ?? "interested",
      job_url: application?.job_url ?? "",
      applied_date: application?.applied_date ?? "",
      notes: application?.notes ?? "",
    },
  })
  const { errors } = form.formState

  function onSubmit(values: FormValues) {
    save.mutate(
      { id: application?.id, input: { ...values, applied_date: values.applied_date || null } },
      {
        onSuccess: () => {
          toast.success(application ? "Application updated" : "Application added")
          onSaved()
        },
      },
    )
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        {save.error && (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
        <Field data-invalid={!!errors.company}>
          <FieldLabel htmlFor="company">Company</FieldLabel>
          <Input id="company" aria-invalid={!!errors.company} {...form.register("company")} />
          <FieldError errors={[errors.company]} />
        </Field>
        <Field data-invalid={!!errors.job_title}>
          <FieldLabel htmlFor="job_title">Job title</FieldLabel>
          <Input id="job_title" aria-invalid={!!errors.job_title} {...form.register("job_title")} />
          <FieldError errors={[errors.job_title]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status" className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status} className="capitalize">
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field data-invalid={!!errors.job_url}>
          <FieldLabel htmlFor="job_url">Job link</FieldLabel>
          <Input
            id="job_url"
            type="url"
            placeholder="https://"
            aria-invalid={!!errors.job_url}
            {...form.register("job_url")}
          />
          <FieldError errors={[errors.job_url]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="applied_date">Applied on</FieldLabel>
          <Input id="applied_date" type="date" {...form.register("applied_date")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea id="notes" {...form.register("notes")} />
        </Field>
        <Button type="submit" disabled={save.isPending}>
          Save
        </Button>
      </FieldGroup>
    </form>
  )
}
