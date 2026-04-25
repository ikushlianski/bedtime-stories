import { useEffect, useMemo, useState } from 'react'
import { api, type ModelCatalogEntry, type PerStageOverrides } from '../lib/api'

const STAGES: Array<{ key: string; label: string; fallbackSupported: boolean }> = [
  { key: 'plotter', label: 'Plotter', fallbackSupported: false },
  { key: 'plotCritic', label: 'Plot Critic', fallbackSupported: false },
  { key: 'writer', label: 'Writer', fallbackSupported: false },
  { key: 'writerCritic', label: 'Writer Critic', fallbackSupported: false },
  { key: 'psychologistPlan', label: 'Psychologist (plan)', fallbackSupported: true },
  { key: 'psychologistText', label: 'Psychologist (text)', fallbackSupported: true },
  { key: 'plotterQuestions', label: 'Plotter Questions', fallbackSupported: true },
  { key: 'improver', label: 'Improver', fallbackSupported: true },
  { key: 'titleGenerator', label: 'Title Generator', fallbackSupported: true },
  { key: 'storyAnalyzer', label: 'Story Analyzer', fallbackSupported: true },
  { key: 'universeFactExtractor', label: 'Universe Fact Extractor', fallbackSupported: true },
  { key: 'feedbackSynthesizer', label: 'Feedback Synthesizer', fallbackSupported: true },
  { key: 'styleGuideUpdater', label: 'Style Guide Updater', fallbackSupported: true },
  { key: 'universeContextUpdater', label: 'Universe Context Updater', fallbackSupported: true },
]

interface ModelPickerProps {
  value: PerStageOverrides
  onChange: (next: PerStageOverrides) => void
}

function formatPrice(usdPerMillion: string | null): string {
  if (!usdPerMillion) return ''
  const n = parseFloat(usdPerMillion)
  if (n === 0) return 'free'
  return `$${n.toFixed(2)}/Mtok`
}

export default function ModelPicker({ value, onChange }: ModelPickerProps) {
  const [models, setModels] = useState<ModelCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [freeOnly, setFreeOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.models.list()
      .then((m) => setModels(m))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load models'))
      .finally(() => setLoading(false))
  }, [])

  const sortedModels = useMemo(() => {
    return models
      .filter((m) => !freeOnly || m.isFree === true)
      .slice()
      .sort((a, b) => parseFloat(a.inputUsdPerMillion ?? '0') - parseFloat(b.inputUsdPerMillion ?? '0'))
  }, [models, freeOnly])

  function setStageField(stage: string, field: 'model' | 'fallback', model: string) {
    const current = value[stage] ?? {}
    const nextStage = { ...current, [field]: model || undefined }

    if (nextStage.model === undefined && nextStage.fallback === undefined) {
      const { [stage]: _drop, ...rest } = value
      void _drop
      onChange(rest)
    } else {
      onChange({ ...value, [stage]: nextStage })
    }
  }

  if (loading) {
    return <p className="text-sm text-base-content/60">Загрузка моделей...</p>
  }

  if (error) {
    return <p className="text-sm text-error">{error}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={freeOnly}
            onChange={(e) => setFreeOnly(e.target.checked)}
          />
          <span>Только бесплатные</span>
        </label>
        <span className="text-base-content/60">сортировка: по цене ↑</span>
      </div>

      <div className="max-h-80 overflow-y-auto rounded border border-base-300">
        <table className="table table-xs">
          <thead>
            <tr>
              <th>Стадия</th>
              <th>Модель</th>
              <th>Фоллбэк</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((stage) => {
              const stageValue = value[stage.key] ?? {}
              return (
                <tr key={stage.key}>
                  <td className="font-mono text-xs">{stage.label}</td>
                  <td>
                    <select
                      className="select select-bordered select-xs w-full bg-base-200"
                      value={stageValue.model ?? ''}
                      onChange={(e) => setStageField(stage.key, 'model', e.target.value)}
                    >
                      <option value="">— по умолчанию —</option>
                      {sortedModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({formatPrice(m.inputUsdPerMillion)}){m.isFree ? ' [free]' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {stage.fallbackSupported ? (
                      <select
                        className="select select-bordered select-xs w-full bg-base-200"
                        value={stageValue.fallback ?? ''}
                        onChange={(e) => setStageField(stage.key, 'fallback', e.target.value)}
                      >
                        <option value="">— по умолчанию —</option>
                        {sortedModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({formatPrice(m.inputUsdPerMillion)}){m.isFree ? ' [free]' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-base-content/40" title="Фоллбэк для этой стадии будет в Phase 3">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
