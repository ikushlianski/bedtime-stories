import type { PipelineStep } from './types'
import AgentStatusBadge from './agent-status-badge'

interface PipelineProgressProps {
  steps: PipelineStep[]
}

const stepLineColor: Record<PipelineStep['status'], string> = {
  idle: 'bg-base-300',
  running: 'bg-primary',
  done: 'bg-success',
  error: 'bg-error',
}

function PipelineProgress({ steps }: PipelineProgressProps) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-5">
        <h2 className="font-serif text-2xl text-base-content">Ход обработки</h2>

        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className={`mt-1 h-3 w-3 rounded-full ${stepLineColor[step.status]} ${step.status === 'running' ? 'ring-2 ring-primary ring-offset-1 ring-offset-base-100 animate-pulse' : ''}`} />

                {i < steps.length - 1 && <div className="mt-1 h-10 w-0.5 bg-base-300" />}
              </div>

              <div className={`flex flex-col gap-1 pb-4 transition-all duration-500 ${step.status === 'running' ? 'opacity-100' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <AgentStatusBadge agentName={step.agentName} status={step.status} />

                  {step.status === 'running' && (
                    <span className="text-xs text-primary animate-pulse">думает…</span>
                  )}

                  {step.iterationNumber !== undefined && (
                    <span className="badge badge-outline border-base-300 text-base-content/60">
                      итерация {step.iterationNumber}
                    </span>
                  )}
                </div>

                {step.summary && step.status === 'done' && (
                  <div className="mt-0.5 max-w-prose text-sm text-base-content/70">
                    {(() => {
                      const lines = step.summary.split('\n').filter(Boolean)
                      if (lines.length <= 1) return <p className="leading-relaxed">{step.summary}</p>
                      const [header, ...items] = lines
                      return (
                        <>
                          <p className="mb-1.5 leading-relaxed">{header}</p>
                          <ul className="space-y-1">
                            {items.map((line, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-base-content/30" />
                                <span className="leading-relaxed">{line}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default PipelineProgress
