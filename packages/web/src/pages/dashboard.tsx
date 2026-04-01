import type { ReactNode } from 'react'

interface DashboardPanelProps {
  title: string
  description: string
  children: ReactNode
}

function DashboardPanel({ title, description, children }: DashboardPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      {children}
    </div>
  )
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 rounded-lg bg-gray-50 border border-dashed border-gray-300">
      <span className="text-sm text-gray-400">{label}</span>
    </div>
  )
}

export function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardPanel
          title="Quality Trend"
          description="Rating over time, with markers for prompt and model changes. Shows whether quality improves after agent updates."
        >
          <ComingSoon label="Coming soon — quality chart" />
        </DashboardPanel>

        <DashboardPanel
          title="Agent Effectiveness"
          description="For each critic and psychologist: % of stories where their notes changed the output, average diff size, and your feedback on their work."
        >
          <ComingSoon label="Coming soon — effectiveness table" />
        </DashboardPanel>

        <DashboardPanel
          title="Feedback Patterns"
          description="Recurring themes across your text comments, clustered by the Improver. Shows whether themes disappear after prompt edits."
        >
          <ComingSoon label="Coming soon — feedback clusters" />
        </DashboardPanel>

        <DashboardPanel
          title="Sasha's Reactions"
          description="Annotations by type, most annotated passages, and Sasha's answers to discussion questions over time."
        >
          <ComingSoon label="Coming soon — reaction analysis" />
        </DashboardPanel>

        <div className="lg:col-span-2">
          <DashboardPanel
            title="Cost"
            description="Per-story token usage and real cost broken down by agent. Helps identify where money is spent without visible quality impact."
          >
            <ComingSoon label="Coming soon — cost breakdown" />
          </DashboardPanel>
        </div>
      </div>
    </div>
  )
}
