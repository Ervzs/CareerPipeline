import { Navigate, Route, Routes } from "react-router"

import { useMe } from "@/hooks/useAuth"
import { ApplicationsPage } from "@/pages/ApplicationsPage"
import { LoginPage } from "@/pages/LoginPage"
import { RegisterPage } from "@/pages/RegisterPage"

export default function App() {
  const me = useMe()

  if (me.isPending) return <p className="p-6 text-muted-foreground">Loading...</p>

  const user = me.data

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route
        path="/"
        element={user ? <ApplicationsPage user={user} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
