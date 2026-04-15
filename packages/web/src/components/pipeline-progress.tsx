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
                <div className={`mt-1 h-3 w-3 rounded-full ${stepLineColor[step.status]}`} />

                {i < steps.length - 1 && <div className="mt-1 h-10 w-0.5 bg-base-300" />}
              </div>

              <div className="flex flex-wrap items-center gap-2 pb-4">
                <AgentStatusBadge agentName={step.agentName} status={step.status} />

                {step.iterationNumber !== undefined && (
                  <span className="badge badge-outline border-base-300 text-base-content/60">
                    итерация {step.iterationNumber}
                  </span>
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
