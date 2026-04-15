import { Routes, Route, Link } from 'react-router-dom'
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

function Nav({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <nav className="border-b border-base-300 bg-base-100/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <p className="font-semibold uppercase tracking-[0.3em] text-secondary">
            Сказки на ночь
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="join">
            <Link to="/inbox" className="btn btn-ghost join-item btn-sm sm:btn-md">
              Входящие
            </Link>
            <Link to="/" className="btn btn-ghost join-item btn-sm sm:btn-md">
              Истории
            </Link>
            <Link to="/ideas" className="btn btn-ghost join-item btn-sm sm:btn-md">
              Идеи
            </Link>
            <Link to="/diary" className="btn btn-ghost join-item btn-sm sm:btn-md">
              Дневник
            </Link>
            <Link to="/dashboard" className="btn btn-ghost join-item btn-sm sm:btn-md">
              Панель
            </Link>
            <Link to="/universes" className="btn btn-ghost join-item btn-sm sm:btn-md">
              Вселенные
            </Link>
          </div>

          <button
            className="btn btn-ghost btn-sm btn-square"
            onClick={onToggle}
            aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  )
}

function App() {
  const { theme, toggleTheme, isDark } = useTheme()

  return (
    <div data-theme={theme} className="min-h-screen bg-base-200 text-base-content">
      <div className={`min-h-screen ${isDark ? 'bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.08),_transparent_35%),linear-gradient(180deg,_rgba(22,19,30,0.98),_rgba(30,26,42,0.98))]' : 'bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_35%),linear-gradient(180deg,_rgba(255,253,250,0.96),_rgba(247,242,234,0.96))]'}`}>
        <Nav isDark={isDark} onToggle={toggleTheme} />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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
        </main>
      </div>
    </div>
  )
}

export default App
