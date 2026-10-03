import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Application, Stage } from './types'

export const queryKeys = {
  stages: ['stages'] as const,
  applications: ['applications'] as const,
}

export const useStages = () =>
  useQuery({ queryKey: queryKeys.stages, queryFn: () => api<Stage[]>('/api/stages/') })

export const useApplications = () =>
  useQuery({
    queryKey: queryKeys.applications,
    queryFn: () => api<Application[]>('/api/applications/'),
  })
