import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { StoryListPage } from './pages/story-list'
import { StoryReaderPage } from './pages/story-reader'
import { PlanReviewPage } from './pages/plan-review'
import { TextReviewPage } from './pages/text-review'
import { PipelineStatusPage } from './pages/pipeline-status'
import { PlanQuestionsPage } from './pages/plan-questions'
import { DashboardPage } from './pages/dashboard'
import { IdeasPage } from './pages/ideas'
import { InboxPage } from './pages/inbox'
import { UniversesPage } from './pages/universes'
import { DiaryPage } from './pages/diary'
import { useTheme } from './lib/use-theme'

const NAV_LINKS = [
  { to: '/inbox', label: 'Входящие' },
  { to: '/', label: 'Истории' },
  { to: '/ideas', label: 'Идеи' },
  { to: '/diary', label: 'Дневник' },
  { to: '/dashboard', label: 'Панель' },
  { to: '/universes', label: 'Вселенные' },
]

function Sidebar({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const { pathname } = useLocation()

  const isActive = (to: string) => to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <aside className="flex min-h-full w-56 flex-col border-r border-base-300 bg-base-100 px-3 py-6">
      <div className="mb-8 px-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
          Сказки на ночь
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_LINKS.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`rounded-btn px-3 py-2 text-sm font-medium transition-colors ${
              isActive(to)
                ? 'bg-primary/10 text-primary'
                : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 px-3">
        <button
          className="btn btn-ghost btn-sm btn-square"
          onClick={onToggle}
          aria-label={isDark ? 'Светлая тема' : 'Тёмная тема'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
    </aside>
  )
}

function App() {
  const { theme, toggleTheme, isDark } = useTheme()

  return (
    <div data-theme={theme} className="min-h-screen bg-base-200 text-base-content">
      <div className="drawer lg:drawer-open">
        <input id="sidebar-drawer" type="checkbox" className="drawer-toggle" />

        <div className="drawer-content flex min-h-screen flex-col">
          <header className="flex items-center gap-4 border-b border-base-300 bg-base-100/90 px-4 py-3 backdrop-blur lg:hidden">
            <label
              htmlFor="sidebar-drawer"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Открыть меню"
            >
              ☰
            </label>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
              Сказки на ночь
            </p>
          </header>

          <main
            className={`flex-1 px-4 py-8 sm:px-8 ${
              isDark
                ? 'bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.08),_transparent_35%),linear-gradient(180deg,_rgba(22,19,30,0.98),_rgba(30,26,42,0.98))]'
                : 'bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_35%),linear-gradient(180deg,_rgba(255,253,250,0.96),_rgba(247,242,234,0.96))]'
            }`}
          >
            <div className="mx-auto max-w-4xl">
              <Routes>
                <Route path="/" element={<StoryListPage />} />
                <Route path="/stories/:id" element={<StoryReaderPage />} />
                <Route path="/stories/:id/plan-review" element={<PlanReviewPage />} />
                <Route path="/stories/:id/text-review" element={<TextReviewPage />} />
                <Route path="/stories/:id/pipeline" element={<PipelineStatusPage />} />
                <Route path="/stories/:id/questions" element={<PlanQuestionsPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/ideas" element={<IdeasPage />} />
                <Route path="/diary" element={<DiaryPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/universes" element={<UniversesPage />} />
              </Routes>
            </div>
          </main>
        </div>

        <div className="drawer-side z-40">
          <label htmlFor="sidebar-drawer" aria-label="Закрыть меню" className="drawer-overlay" />
          <Sidebar isDark={isDark} onToggle={toggleTheme} />
        </div>
      </div>
    </div>
  )
}

export default App
