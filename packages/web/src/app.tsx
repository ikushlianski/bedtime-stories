import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { StoryListPage } from './pages/story-list'
import { StoryReaderPage } from './pages/story-reader'
import { PlanReviewPage } from './pages/plan-review'
import { TextReviewPage } from './pages/text-review'
import { PipelineStatusPage } from './pages/pipeline-status'
import { PlanQuestionsPage } from './pages/plan-questions'
import { DashboardPage } from './pages/dashboard'
import { IdeasPage } from './pages/ideas'
import { UniversesPage } from './pages/universes'
import { UniverseDetailPage } from './pages/universe-detail'
import { DiaryPage } from './pages/diary'
import { FragmentsPage } from './pages/fragments'
import { TopicsPage } from './pages/topics'
import { WordsPage } from './pages/words'
import { ChildProfilePage } from './pages/child-profile'
import { AdminPage } from './pages/admin'
import { SettingsPage } from './pages/settings'
import { GlobalStoryModals } from './components'
import { useTheme } from './lib/use-theme'
import { useAuth } from './auth/auth.context'
import { LoginPage } from './pages/login/login.page'
import { ProtectedRoute } from './components/protected-route'

const OTHER_NAV = [
  { to: '/ideas', label: 'Идеи' },
  { to: '/topics', label: 'Темы' },
  { to: '/fragments', label: 'Фрагменты' },
  { to: '/words', label: 'Слова' },
  { to: '/child-profile', label: 'Мой ребёнок' },
  { to: '/dashboard', label: 'Панель' },
  { to: '/admin', label: 'Админ' },
  { to: '/universes', label: 'Вселенные' },
  { to: '/settings', label: 'Настройки' },
]

function NavLink({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation()
  const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <Link
      to={to}
      className={`rounded-btn px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
      }`}
    >
      {label}
    </Link>
  )
}

function Sidebar({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  function openModal(modal: 'create' | 'example') {
    navigate({ pathname, search: `?modal=${modal}` })
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex min-h-full w-56 flex-col border-r border-base-300 bg-base-100 px-3 py-6">
      <div className="mb-8 px-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
          Сказки на ночь
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        <NavLink to="/drafts" label="Черновики" />
        <NavLink to="/proofreading" label="На вычитке" />
        <NavLink to="/" label="Непрочитанные" />

        <div className="my-3 border-t border-base-300" />

        <NavLink to="/read" label="Прочитанные" />

        <div className="my-3 border-t border-base-300" />

        <button
          className="rounded-btn px-3 py-2 text-left text-sm font-medium text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary"
          onClick={() => openModal('create')}
        >
          + Новая история
        </button>
        <button
          className="rounded-btn px-3 py-2 text-left text-sm font-medium text-base-content/70 transition-colors hover:bg-base-200 hover:text-base-content"
          onClick={() => openModal('example')}
        >
          + Добавить пример
        </button>

        <div className="my-3 border-t border-base-300" />

        {OTHER_NAV.map(({ to, label }) => (
          <NavLink key={to} to={to} label={label} />
        ))}
      </nav>

      <div className="mt-4 flex items-center gap-2 px-3">
        <button
          className="btn btn-ghost btn-sm btn-square"
          onClick={onToggle}
          aria-label={isDark ? 'Светлая тема' : 'Тёмная тема'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
        <button
          className="btn btn-ghost btn-sm text-xs text-base-content/50"
          onClick={handleLogout}
        >
          Выйти
        </button>
      </div>
    </aside>
  )
}

function AppShell() {
  const { theme, toggleTheme, isDark } = useTheme()
  const { username, loading } = useAuth()

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
                <Route path="/login" element={<LoginPage />} />
                <Route path="/*" element={
                  <ProtectedRoute>
                    <Routes>
                      <Route path="/" element={<StoryListPage lockedStatus="ready" />} />
                      <Route path="/drafts" element={<StoryListPage lockedStatus="draft" />} />
                      <Route path="/proofreading" element={<StoryListPage lockedStatus="proofreading" />} />
                      <Route path="/read" element={<StoryListPage lockedStatus="read" />} />
                      <Route path="/stories/:id" element={<StoryReaderPage />} />
                      <Route path="/stories/:id/plan-review" element={<PlanReviewPage />} />
                      <Route path="/stories/:id/text-review" element={<TextReviewPage />} />
                      <Route path="/stories/:id/pipeline" element={<PipelineStatusPage />} />
                      <Route path="/stories/:id/questions" element={<PlanQuestionsPage />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/admin" element={<AdminPage />} />
                      <Route path="/ideas" element={<IdeasPage />} />
                      <Route path="/diary" element={<DiaryPage />} />
                      <Route path="/fragments" element={<FragmentsPage />} />
                      <Route path="/topics" element={<TopicsPage />} />
                      <Route path="/words" element={<WordsPage />} />
                      <Route path="/child-profile" element={<ChildProfilePage />} />
                      <Route path="/universes" element={<UniversesPage />} />
                      <Route path="/universes/:id" element={<UniverseDetailPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                  </ProtectedRoute>
                } />
              </Routes>
            </div>
          </main>
        </div>

        {!loading && username && (
          <div className="drawer-side z-40">
            <label htmlFor="sidebar-drawer" aria-label="Закрыть меню" className="drawer-overlay" />
            <Sidebar isDark={isDark} onToggle={toggleTheme} />
          </div>
        )}

        {!loading && username && <GlobalStoryModals />}
      </div>
    </div>
  )
}

function App() {
  return <AppShell />
}

export default App
