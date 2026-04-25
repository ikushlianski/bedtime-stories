import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AdminSpendChart from '../components/admin-spend-chart'
import AdminStoriesTable from '../components/admin-stories-table'
import AdminModelLeaderboard from '../components/admin-model-leaderboard'
import AdminAwaitingFeedbackInbox from '../components/admin-awaiting-feedback-inbox'

export function AdminPage() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const id = hash.slice(1)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [hash])

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">Админ</p>
        <h1 className="text-2xl font-semibold mt-1">Панель моделей и фидбэка</h1>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Расходы за месяц</h2>
        <AdminSpendChart />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Истории</h2>
        <AdminStoriesTable />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Лидерборд моделей</h2>
        <AdminModelLeaderboard />
      </section>

      <section id="inbox">
        <h2 className="text-lg font-semibold mb-3">Неоценённые истории</h2>
        <AdminAwaitingFeedbackInbox />
      </section>
    </div>
  )
}
