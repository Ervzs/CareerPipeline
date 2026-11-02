export const STATUSES = ["interested", "applied", "interview", "offer", "rejected"] as const

export type Status = (typeof STATUSES)[number]

export interface User {
  id: number
  email: string
}

export interface Application {
  id: number
  company: string
  job_title: string
  status: Status
  job_url: string
  applied_date: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type ApplicationInput = Omit<Application, "id" | "created_at" | "updated_at">
