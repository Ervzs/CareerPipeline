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
