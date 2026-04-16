import type { PsychologistOutput } from './types'
import DiffViewer from './diff-viewer'
import SafetyVerdictBadge from './safety-verdict-badge'
import TherapeuticScoreBar from './therapeutic-score-bar'

interface PlanReviewCardProps {
  planV1: string
  planFinal: string
  iterationsCount: number
  psychologistOutput: PsychologistOutput
  onApprove: () => void
}

function PlanReviewCard({
  planV1,
  planFinal,
  iterationsCount,
  psychologistOutput,
  onApprove,
}: PlanReviewCardProps) {
  const { safety, therapeutic, recommended_changes } = psychologistOutput

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl text-base-content">Проверка плана</h2>
            <p className="text-sm text-base-content/65">Итераций: {iterationsCount}</p>
          </div>

          <button className="btn btn-primary" onClick={onApprove}>
            Одобрить план
          </button>
        </div>

        <DiffViewer originalText={planV1} revisedText={planFinal} label="План v1 → Финал" />

        <section className="rounded-box border border-base-300 bg-base-200/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
            Оценка психолога
          </h3>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-base-content/60">Вердикт безопасности:</span>
            <SafetyVerdictBadge verdict={safety.verdict} />
          </div>

          {safety.issues.length > 0 && (
            <ul className="mb-4 list-disc space-y-1 pl-4 text-sm text-error">
              {safety.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}

          <TherapeuticScoreBar
            score={therapeutic.score}
            strengths={therapeutic.strengths}
            gaps={therapeutic.gaps}
          />

          {recommended_changes.length > 0 && (
            <div className="alert mt-4 border-warning/30 bg-warning/10 text-base-content">
              <div>
                <h4 className="font-semibold">Рекомендуемые изменения</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {recommended_changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default PlanReviewCard
