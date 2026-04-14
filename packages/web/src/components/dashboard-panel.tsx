import type { ReactNode } from 'react'

interface DashboardPanelProps {
  title: string
  description: string
  children: ReactNode
}

function DashboardPanel({ title, description, children }: DashboardPanelProps) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl text-base-content">{title}</h2>
          <p className="text-sm text-base-content/60">{description}</p>
        </div>

        {children}
      </div>
    </section>
  )
}

export default DashboardPanel
