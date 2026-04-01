import { HeroUIProvider } from "@heroui/react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { StoryListPage } from "./pages/story-list";
import { StoryReaderPage } from "./pages/story-reader";
import { PlanReviewPage } from "./pages/plan-review";
import { TextReviewPage } from "./pages/text-review";
import { PipelineStatusPage } from "./pages/pipeline-status";
import { DashboardPage } from "./pages/dashboard";

function Nav() {
  return (
    <nav className="flex items-center gap-6 px-6 py-3 bg-default-100 border-b border-default-200">
      <span className="text-lg font-bold text-default-900">
        Gosha&apos;s Book
      </span>

      <Link to="/" className="text-sm text-default-600 hover:text-primary">
        Stories
      </Link>

      <Link
        to="/dashboard"
        className="text-sm text-default-600 hover:text-primary"
      >
        Dashboard
      </Link>
    </nav>
  );
}

function App() {
  const navigate = useNavigate();

  return (
    <HeroUIProvider navigate={navigate}>
      <div className="min-h-screen bg-background text-foreground">
        <Nav />

        <main className="max-w-4xl mx-auto px-4 py-6">
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
    </HeroUIProvider>
  );
}

export default App;
