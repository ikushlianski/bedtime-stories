import { Routes, Route, Link } from 'react-router-dom'
import { StoryListPage } from './pages/story-list'
import { StoryReaderPage } from './pages/story-reader'
import { PlanReviewPage } from './pages/plan-review'
import { TextReviewPage } from './pages/text-review'
import { PipelineStatusPage } from './pages/pipeline-status'
import { DashboardPage } from './pages/dashboard'

function Nav() {
  return (
    <nav className="border-b border-base-300 bg-base-100/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
            Bedtime Agent
          </p>
          <span className="font-serif text-2xl text-base-content">Gosha&apos;s Book</span>
        </div>

        <div className="join">
          <Link to="/" className="btn btn-ghost join-item btn-sm sm:btn-md">
            Stories
          </Link>
          <Link to="/dashboard" className="btn btn-ghost join-item btn-sm sm:btn-md">
            Dashboard
          </Link>
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <div data-theme="bedtime" className="min-h-screen bg-base-200 text-base-content">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_35%),linear-gradient(180deg,_rgba(255,253,250,0.96),_rgba(247,242,234,0.96))]">
        <Nav />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Routes>
            <Route path="/" element={<StoryListPage />} />
            <Route path="/stories/:id" element={<StoryReaderPage />} />
            <Route path="/stories/:id/plan-review" element={<PlanReviewPage />} />
            <Route path="/stories/:id/text-review" element={<TextReviewPage />} />
            <Route path="/stories/:id/pipeline" element={<PipelineStatusPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
