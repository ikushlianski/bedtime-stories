import type { PsychologistOutput } from './types'
import DiffViewer from './diff-viewer'
import SafetyVerdictBadge from './safety-verdict-badge'
import TherapeuticScoreBar from './therapeutic-score-bar'

interface TextReviewCardProps {
  textV1: string
  textV2: string
  psychologistOutput: PsychologistOutput
  onApprove: () => void
}

function TextReviewCard({ textV1, textV2, psychologistOutput, onApprove }: TextReviewCardProps) {
  const { safety, therapeutic, recommended_changes } = psychologistOutput

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-3xl text-base-content">Text Review</h2>

          <button className="btn btn-success btn-wide" onClick={onApprove}>
            Approve Text
          </button>
        </div>

        <DiffViewer originalText={textV1} revisedText={textV2} label="Text v1 → v2" />

        <section className="rounded-box border border-base-300 bg-base-200/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
            Psychologist Assessment
          </h3>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-base-content/60">Safety verdict:</span>
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
                <h4 className="font-semibold">Recommended changes</h4>
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

export default TextReviewCard
