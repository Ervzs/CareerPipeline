import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { Application, ApplicationInput } from "@/types"

export function useApplications() {
  return useQuery({
    queryKey: ["applications"],
    queryFn: () => api<Application[]>("/api/applications/"),
  })
}

export function useSaveApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: ApplicationInput }) =>
      api<Application>(id ? `/api/applications/${id}/` : "/api/applications/", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  })
}

export function useDeleteApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/api/applications/${id}/`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  })
}
