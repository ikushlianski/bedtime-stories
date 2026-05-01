import { useEffect, useState } from 'react'
import { api, type ModelCategories, type PerStageOverrides, EMPTY_MODEL_CATEGORIES } from '../lib/api'
import { PipelineStage, PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from '@bedtime/core/pipeline/pipeline-stages'
import ModelSelectDropdown from './model-select-dropdown'

const STAGES: Array<{ key: PipelineStage; label: string; fallbackSupported: boolean }> = PIPELINE_STAGES.map((stage) => ({
  key: stage,
  label: PIPELINE_STAGE_LABELS[stage],
  fallbackSupported: true,
}))

interface ModelPickerProps {
  value: PerStageOverrides
  onChange: (next: PerStageOverrides) => void
  required?: boolean
}

export function validateStageModels(value: PerStageOverrides): boolean {
  return PIPELINE_STAGES.every((stage) => value[stage]?.model)
}

export default function ModelPicker({ value, onChange, required = false }: ModelPickerProps) {
  const [categories, setCategories] = useState<ModelCategories>(EMPTY_MODEL_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const missingStages = required ? PIPELINE_STAGES.filter((stage) => !value[stage]?.model) : []

  useEffect(() => {
    setLoading(true)
    api.models.list()
      .then((cats) => setCategories(cats))
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
      <div className="space-y-4 md:space-y-0 md:rounded md:border md:border-base-300">
        {STAGES.map((stage, idx) => {
          const stageValue = value[stage.key] ?? {}
          const isMissing = missingStages.includes(stage.key)
          return (
            <div
              key={stage.key}
              className={`px-3 py-3 md:px-4 ${idx % 2 === 0 ? '' : 'md:bg-base-50'} ${isMissing ? 'bg-error/10' : ''} ${idx > 0 ? 'border-t border-base-300 md:border-t' : ''}`}
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  {stage.label}
                  {required && <span className="text-error ml-1">*</span>}
                </label>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-base-content/60">Модель</span>
                    <ModelSelectDropdown
                      categories={categories}
                      value={stageValue.model ?? ''}
                      onChange={(id) => setStageField(stage.key, 'model', id)}
                    />
                  </div>
                  {stage.fallbackSupported && (
                    <div>
                      <span className="text-xs text-base-content/60">Фоллбэк (опционально)</span>
                      <ModelSelectDropdown
                        categories={categories}
                        value={stageValue.fallback ?? ''}
                        onChange={(id) => setStageField(stage.key, 'fallback', id)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {required && missingStages.length > 0 && (
        <p className="text-sm text-error">
          Выбери модель для: {missingStages.map((s) => STAGES.find((st) => st.key === s)?.label).filter(Boolean).join(', ')}
        </p>
      )}
    </div>
  )
}
