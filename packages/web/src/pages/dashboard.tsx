import { DashboardPanel, PageHeader } from '../components'

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-box border border-dashed border-base-300 bg-base-200 text-sm text-base-content/45">
      <span>{label}</span>
    </div>
  )
}

export function DashboardPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Dashboard"
        description="Track quality, feedback, agent impact, reactions, and cost as the bedtime story system evolves."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          title="Sasha&apos;s Reactions"
          description="Annotations by type, most annotated passages, and Sasha&apos;s answers to discussion questions over time."
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
