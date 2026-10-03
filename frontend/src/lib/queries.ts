import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/toast/useToast'
import { api, ApiError } from './api'
import { moveApplication } from './board'
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
