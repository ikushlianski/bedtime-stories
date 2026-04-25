import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth.context'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { username, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (!username) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
