export interface User {
  id: number
  email: string
}

export interface Stage {
  id: number
  name: string
  order: number
}

export interface Company {
  id: number
  name: string
  website: string
  notes: string
}

export interface Application {
  id: number
  company: number
  company_detail: Company
  stage: number
  job_title: string
  job_description: string
  listing_url: string
  date_applied: string | null
  position: number
  created_at: string
  updated_at: string
}

/** Fields accepted when creating an application: send `company` OR `company_name`. */
export interface ApplicationInput {
  stage: number
  job_title: string
  job_description?: string
  listing_url?: string
  date_applied?: string | null
  company?: number
  company_name?: string
}

/** The error envelope every API error uses. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Record<string, string[] | string>
  }
}

export interface Dashboard {
  totals: { applications: number; applied: number }
  stages: { stage: number; name: string; order: number; count: number }[]
  /** The last 12 weeks, oldest first; `week_start` is the Monday of that week. */
  weeks: { week_start: string; count: number }[]
  response_rate: {
    baseline_stage: string | null
    responded: number
    applied: number
    /** 0 to 1, or null when nothing has been applied to yet. */
    rate: number | null
  }
}
