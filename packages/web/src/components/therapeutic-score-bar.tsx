import { useState } from 'react'

interface TherapeuticScoreBarProps {
  score: number
  strengths: string[]
  gaps: string[]
}

function scoreToColor(score: number): string {
  if (score >= 4) {
    return 'progress-success'
  }

  if (score >= 3) {
    return 'progress-warning'
  }

  return 'progress-error'
}

function TherapeuticScoreBar({ score, strengths, gaps }: TherapeuticScoreBarProps) {
  const [expanded, setExpanded] = useState(false)
  const color = scoreToColor(score)
  const percentage = (score / 5) * 100

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-base-content/75">Терапевтическая оценка: {score}/5</span>

        <button className="btn btn-ghost btn-xs" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Скрыть детали' : 'Показать детали'}
        </button>
      </div>

      <progress
        className={`progress h-3 w-full ${color}`}
        value={percentage}
        max={100}
        aria-label="Терапевтическая оценка"
      />

      {expanded && (
        <div className="grid gap-3 md:grid-cols-2">
          {strengths.length > 0 && (
            <div className="rounded-box border border-success/20 bg-success/10 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-success">
                Сильные стороны
              </p>
              <ul className="list-disc space-y-1 pl-4 text-sm text-base-content/75">
                {strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {gaps.length > 0 && (
            <div className="rounded-box border border-warning/20 bg-warning/10 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-warning">
                Пробелы
              </p>
              <ul className="list-disc space-y-1 pl-4 text-sm text-base-content/75">
                {gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TherapeuticScoreBar
