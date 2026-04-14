import type { AgentName, AgentStatus } from './types'

interface AgentStatusBadgeProps {
  agentName: AgentName
  status: AgentStatus
}

const statusConfig: Record<AgentStatus, { tone: string; label: string; dot: string }> = {
  idle: { tone: 'badge-ghost', label: 'Idle', dot: 'bg-base-content/30' },
  running: { tone: 'badge-primary', label: 'Running', dot: 'bg-primary animate-pulse' },
  done: { tone: 'badge-success', label: 'Done', dot: 'bg-success' },
  error: { tone: 'badge-error', label: 'Error', dot: 'bg-error' },
}

function AgentStatusBadge({ agentName, status }: AgentStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span className={`badge gap-2 px-3 py-3 ${config.tone}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {agentName} — {config.label}
    </span>
  )
}

export default AgentStatusBadge
