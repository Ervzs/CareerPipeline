import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export default function App() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api<{ status: string }>("/api/health/"),
  })

  return (
    <main className="p-6">API: {health.data?.status ?? health.error?.message ?? "loading..."}</main>
  )
}
