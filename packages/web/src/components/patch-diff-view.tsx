import { computePatchDiff } from '../lib/compute-patch-diff'

interface PatchDiffViewProps {
  original: string
  patched: string
}

const segmentStyle: Record<'added' | 'removed' | 'unchanged', string> = {
  added: 'bg-success/20 text-success-content underline decoration-success',
  removed: 'bg-error/20 text-error-content line-through decoration-error',
  unchanged: '',
}

function PatchDiffView({ original, patched }: PatchDiffViewProps) {
  const segments = computePatchDiff(original, patched)

  return (
    <p className="whitespace-pre-wrap text-sm text-base-content/80" data-testid="patch-diff-view">
      {segments.map((segment, index) => (
        <span key={index} className={segmentStyle[segment.type]} data-diff-type={segment.type}>
          {segment.text}
        </span>
      ))}
    </p>
  )
}

export default PatchDiffView
