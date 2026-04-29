import { useEffect, useState } from 'react'
import { api, type ModelCatalogEntry, type PerStageOverrides } from '../lib/api'
import ModelSelectDropdown from './model-select-dropdown'

const STAGES: Array<{ key: string; label: string; fallbackSupported: boolean }> = [
  { key: 'plotter', label: 'Сюжетник', fallbackSupported: true },
  { key: 'writer', label: 'Писатель', fallbackSupported: true },
  { key: 'plotterQuestions', label: 'Вопросы к сиду', fallbackSupported: true },
]

interface ModelPickerProps {
  value: PerStageOverrides
  onChange: (next: PerStageOverrides) => void
}

export default function ModelPicker({ value, onChange }: ModelPickerProps) {
  const [models, setModels] = useState<ModelCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.models.list()
      .then((m) => setModels(m))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load models'))
      .finally(() => setLoading(false))
  }, [])

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
      <div className="rounded border border-base-300">
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
                  <td className="min-w-48">
                    <ModelSelectDropdown
                      models={models}
                      value={stageValue.model ?? ''}
                      onChange={(id) => setStageField(stage.key, 'model', id)}
                    />
                  </td>
                  <td className="min-w-48">
                    {stage.fallbackSupported ? (
                      <ModelSelectDropdown
                        models={models}
                        value={stageValue.fallback ?? ''}
                        onChange={(id) => setStageField(stage.key, 'fallback', id)}
                      />
                    ) : (
                      <span className="text-xs text-base-content/40">—</span>
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
