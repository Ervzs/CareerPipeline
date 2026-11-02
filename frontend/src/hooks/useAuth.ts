import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, setAccessToken } from "@/lib/api"
import type { User } from "@/types"

export interface Credentials {
  email: string
  password: string
}

async function logIn(credentials: Credentials) {
  const { access } = await api<{ access: string }>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(credentials),
  })
  setAccessToken(access)
  return api<User>("/api/auth/me/")
}

export function useMe() {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: () => api<User>("/api/auth/me/"),
    retry: false,
    staleTime: Infinity,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logIn,
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      await api("/api/auth/register/", { method: "POST", body: JSON.stringify(credentials) })
      return logIn(credentials)
    },
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api("/api/auth/logout/", { method: "POST" }),
    onSuccess: () => {
      setAccessToken(null)
      queryClient.setQueryData(["me"], null)
      queryClient.removeQueries({ queryKey: ["applications"] })
    },
  })
}
