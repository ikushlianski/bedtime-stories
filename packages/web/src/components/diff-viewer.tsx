interface DiffViewerProps {
  originalText: string
  revisedText: string
  label: string
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

function computeDiff(original: string, revised: string): DiffLine[] {
  const originalLines = original.split('\n')
  const revisedLines = revised.split('\n')
  const result: DiffLine[] = []

  const maxLen = Math.max(originalLines.length, revisedLines.length)

  for (let i = 0; i < maxLen; i++) {
    const orig = originalLines[i]
    const rev = revisedLines[i]

    if (orig === rev) {
      result.push({ type: 'unchanged', text: orig ?? '' })
    } else {
      if (orig !== undefined) {
        result.push({ type: 'removed', text: orig })
      }

      if (rev !== undefined) {
        result.push({ type: 'added', text: rev })
      }
    }
  }

  return result
}

const lineStyle: Record<DiffLine['type'], string> = {
  added: 'border-success/40 bg-success/10 text-success-content',
  removed: 'border-error/40 bg-error/10 text-error-content line-through',
  unchanged: 'border-base-300 bg-base-200/70 text-base-content/80',
}

const linePrefix: Record<DiffLine['type'], string> = {
  added: '+ ',
  removed: '- ',
  unchanged: '  ',
}

function DiffViewer({ originalText, revisedText, label }: DiffViewerProps) {
  const diffLines = computeDiff(originalText, revisedText)

  return (
    <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
      <header className="border-b border-base-300 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
          {label}
        </h3>
      </header>

      <div className="p-3">
        <pre className="max-h-96 space-y-1 overflow-auto text-xs">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={`rounded-box border px-3 py-2 font-mono ${lineStyle[line.type]}`}
            >
              <span className="select-none opacity-50">{linePrefix[line.type]}</span>
              {line.text}
            </div>
          ))}
        </pre>
      </div>
    </section>
  )
}

export default DiffViewer
