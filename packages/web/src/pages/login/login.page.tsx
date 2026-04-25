import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth.context'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const username = form.get('username') as string
    const password = form.get('password') as string

    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <h1 className="text-center text-xl font-semibold tracking-wide text-secondary uppercase">
            Сказки на ночь
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="form-control">
              <span className="label-text mb-1 block text-sm">Логин</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                required
                className="input input-bordered w-full"
              />
            </label>

            <label className="form-control">
              <span className="label-text mb-1 block text-sm">Пароль</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input input-bordered w-full"
              />
            </label>

            {error && (
              <p className="text-sm text-error">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
