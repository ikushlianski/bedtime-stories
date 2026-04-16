import type { AgentName, AgentStatus } from './types'

interface AgentStatusBadgeProps {
  agentName: AgentName
  status: AgentStatus
}

const statusConfig: Record<AgentStatus, { tone: string; label: string; dot: string }> = {
  idle: { tone: 'badge-ghost', label: 'Ожидание', dot: 'bg-base-content/30' },
  running: { tone: 'badge-primary', label: 'Выполняется', dot: 'bg-primary animate-pulse' },
  done: { tone: 'badge-success', label: 'Готово', dot: 'bg-success' },
  error: { tone: 'badge-error', label: 'Ошибка', dot: 'bg-error' },
}

const agentDisplayName: Record<AgentName, string> = {
  Plotter: 'Сюжетник',
  Psychologist: 'Психолог',
  PlotCritic: 'Критик плана',
  Writer: 'Писатель',
  WriterCritic: 'Критик текста',
  Improver: 'Улучшатель',
}

function AgentStatusBadge({ agentName, status }: AgentStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span className={`badge gap-2 px-3 py-3 ${config.tone}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {agentDisplayName[agentName] ?? agentName} — {config.label}
    </span>
  )
}

export default AgentStatusBadge
