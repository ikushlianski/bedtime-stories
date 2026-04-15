import type { SafetyVerdict } from './types'

interface SafetyVerdictBadgeProps {
  verdict: SafetyVerdict
}

const verdictConfig: Record<SafetyVerdict, { label: string; tone: string }> = {
  safe: { label: 'Безопасно', tone: 'badge-success' },
  concern: { label: 'Есть сомнения', tone: 'badge-warning' },
  block: { label: 'Заблокировано', tone: 'badge-error' },
}

function SafetyVerdictBadge({ verdict }: SafetyVerdictBadgeProps) {
  const config = verdictConfig[verdict]

  return <span className={`badge ${config.tone} px-3 py-3`}>{config.label}</span>
}

export default SafetyVerdictBadge
