import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { PageHeader, StatusCallout } from '../components'
import ModelPicker from '../components/model-picker'
import type { PerStageOverrides } from '../lib/api'

export function SettingsPage() {
  const [stageModels, setStageModels] = useState<PerStageOverrides>({})
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.settings
      .get()
      .then((data) => {
        setStageModels(data.stageModels as PerStageOverrides)
        setFeatureFlags(data.featureFlags ?? {})
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const result = await api.settings.update({ stageModels, featureFlags })

      setStageModels(result.stageModels as PerStageOverrides)
      setFeatureFlags(result.featureFlags ?? {})
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Настройки"
        title="Модели по умолчанию"
        description="Глобальные модели для каждой стадии генерации. Перекрываются настройками вселенной или отдельной истории."
      />

      {loading && <StatusCallout title="Загрузка" message="Получаем настройки." />}

      {!loading && (
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-6">
            <ModelPicker value={stageModels} onChange={setStageModels} />

            <div className="divider" />

            <label className="label cursor-pointer justify-between gap-4 rounded-lg border border-base-300 bg-base-200 px-4 py-3">
              <div className="flex flex-col">
                <span className="label-text font-medium">Живые подсказки тем во время написания истории</span>
                <span className="text-sm text-base-content/60">
                  Пока родитель печатает затравку, ИИ будет предлагать подходящие темы из банка вселенной на выбор.
                </span>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={featureFlags.liveTopicSuggestions ?? false}
                onChange={(event) =>
                  setFeatureFlags((prev) => ({ ...prev, liveTopicSuggestions: event.target.checked }))
                }
              />
            </label>

            {error && <p className="text-sm text-error">{error}</p>}

            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-sm text-success">Сохранено</span>}
              <button
                className="btn btn-primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
