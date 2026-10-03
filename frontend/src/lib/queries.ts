import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/toast/useToast'
import { api, ApiError } from './api'
import { moveApplication } from './board'
import type {
  Activity,
  ActivityInput,
  Application,
  ApplicationInput,
  Company,
  Dashboard,
  Stage,
} from './types'

export const queryKeys = {
  stages: ['stages'] as const,
  applications: ['applications'] as const,
  companies: ['companies'] as const,
}

export const useStages = () =>
  useQuery({ queryKey: queryKeys.stages, queryFn: () => api<Stage[]>('/api/stages/') })

export const useApplications = () =>
  useQuery({
    queryKey: queryKeys.applications,
    queryFn: () => api<Application[]>('/api/applications/'),
  })

interface MoveInput {
  id: number
  stage: number
  position: number
}

/**
 * Move a card. The board updates instantly (optimistic); if the server rejects the move
 * the previous board is restored and an error is shown. The server's answer always wins
 * in the end because the list is refetched afterwards.
 */
export function useMoveApplication() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  return useMutation({
    mutationFn: ({ id, stage, position }: MoveInput) =>
      api<Application>(`/api/applications/${id}/move/`, {
        method: 'PATCH',
        body: { stage, position },
      }),
    onMutate: async ({ id, stage, position }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applications })
      const previous = queryClient.getQueryData<Application[]>(queryKeys.applications)
      queryClient.setQueryData<Application[]>(
        queryKeys.applications,
        (current) => current && moveApplication(current, id, stage, position),
      )
      return { previous }
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.applications, context.previous)
      const reason = error instanceof ApiError ? error.message : 'The server could not be reached.'
      showToast(`Couldn't move that application, so it went back. ${reason}`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications }),
  })
}

// --- stages ---------------------------------------------------------------

const invalidateStages = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: queryKeys.stages })

export function useCreateStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api<Stage>('/api/stages/', { method: 'POST', body: { name } }),
    onSuccess: () => invalidateStages(queryClient),
  })
}

export function useRenameStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api<Stage>(`/api/stages/${id}/`, { method: 'PATCH', body: { name } }),
    onSuccess: () => invalidateStages(queryClient),
  })
}

/** Rejected with `stage_not_empty` (409) while the stage still holds applications. */
export function useDeleteStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/api/stages/${id}/`, { method: 'DELETE' }),
    onSuccess: () => invalidateStages(queryClient),
  })
}

/** Reorder stages: the list updates instantly and is restored if the server refuses. */
export function useReorderStages() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (stageIds: number[]) =>
      api<Stage[]>('/api/stages/reorder/', { method: 'POST', body: { stage_ids: stageIds } }),
    onMutate: async (stageIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.stages })
      const previous = queryClient.getQueryData<Stage[]>(queryKeys.stages)
      queryClient.setQueryData<Stage[]>(queryKeys.stages, (current) => {
        const byId = new Map(current?.map((stage) => [stage.id, stage]))
        return stageIds.flatMap((id, order) => {
          const stage = byId.get(id)
          return stage ? [{ ...stage, order }] : []
        })
      })
      return { previous }
    },
    onError: (error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.stages, context.previous)
      const reason = error instanceof ApiError ? error.message : 'The server could not be reached.'
      showToast(`Couldn't save the new stage order, so it went back. ${reason}`)
    },
    onSettled: () => invalidateStages(queryClient),
  })
}

// --- companies and applications ---------------------------------------------

export const useCompanies = () =>
  useQuery({ queryKey: queryKeys.companies, queryFn: () => api<Company[]>('/api/companies/') })

/** Cards embed their company, so company changes must refresh the board as well. */
const invalidateCompanyData = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
    queryClient.invalidateQueries({ queryKey: queryKeys.applications }),
  ])

type CompanyInput = Pick<Company, 'name' | 'website' | 'notes'>

export function useUpdateCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CompanyInput> & { id: number }) =>
      api<Company>(`/api/companies/${id}/`, { method: 'PATCH', body }),
    onSuccess: () => invalidateCompanyData(queryClient),
  })
}

/** Rejected with `company_in_use` (409) while the company still has applications. */
export function useDeleteCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/api/companies/${id}/`, { method: 'DELETE' }),
    onSuccess: () => invalidateCompanyData(queryClient),
  })
}

export function useCreateApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ApplicationInput) =>
      api<Application>('/api/applications/', { method: 'POST', body }),
    // `company_name` may have created a company, so refresh both lists.
    onSuccess: () => invalidateCompanyData(queryClient),
  })
}

export function useUpdateApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Omit<ApplicationInput, 'stage'>> & { id: number }) =>
      api<Application>(`/api/applications/${id}/`, { method: 'PATCH', body }),
    onSuccess: () => invalidateCompanyData(queryClient),
  })
}

export function useDeleteApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/api/applications/${id}/`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications }),
  })
}

// --- dashboard ----------------------------------------------------------------

/** Always refetched when the page opens (default staleTime), so it never shows old numbers for long. */
export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/api/dashboard/') })

// --- activity notes ---------------------------------------------------------------

const activitiesKey = (applicationId: number) => ['activities', applicationId] as const

export const useActivities = (applicationId: number) =>
  useQuery({
    queryKey: activitiesKey(applicationId),
    queryFn: () => api<Activity[]>(`/api/applications/${applicationId}/activities/`),
  })

export function useCreateActivity(applicationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ActivityInput) =>
      api<Activity>(`/api/applications/${applicationId}/activities/`, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: activitiesKey(applicationId) }),
  })
}

export function useUpdateActivity(applicationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ActivityInput> & { id: number }) =>
      api<Activity>(`/api/activities/${id}/`, { method: 'PATCH', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: activitiesKey(applicationId) }),
  })
}

export function useDeleteActivity(applicationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/api/activities/${id}/`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: activitiesKey(applicationId) }),
  })
}
