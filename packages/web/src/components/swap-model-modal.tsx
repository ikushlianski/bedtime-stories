import { useEffect, useMemo, useState } from 'react'
import { api, type ModelCatalogEntry, type ModelCategories, EMPTY_MODEL_CATEGORIES } from '../lib/api'

function combinedCost(m: ModelCatalogEntry): number {
  return parseFloat(m.inputUsdPerMillion ?? '0') + parseFloat(m.outputUsdPerMillion ?? '0')
}

function formatPrice(m: ModelCatalogEntry): string {
  if (m.isFree) return 'free'
  const input = parseFloat(m.inputUsdPerMillion ?? '0')
  const output = parseFloat(m.outputUsdPerMillion ?? '0')
  return `$${input.toFixed(2)}/$${output.toFixed(2)}/M`
}

const REASON_CHIPS: Array<{ value: string; label: string }> = [
  { value: 'too_verbose', label: 'Слишком многословно' },
  { value: 'too_short', label: 'Слишком коротко' },
  { value: 'broke_format', label: 'Сломал формат' },
  { value: 'boring_prose', label: 'Скучная проза' },
  { value: 'off_topic', label: 'Ушёл от темы' },
  { value: 'repetitive', label: 'Повторяется' },
  { value: 'not_calm', label: 'Не для сна (слишком активно)' },
  { value: 'weak_ending', label: 'Слабая концовка' },
  { value: 'too_slow', label: 'Слишком медленно' },
  { value: 'failed', label: 'Сломалось' },
  { value: 'other', label: 'Другое' },
]

const SECTIONS: Array<{ key: keyof ModelCategories; label: string }> = [
  { key: 'popular', label: 'Популярные' },
  { key: 'free', label: 'Бесплатные' },
  { key: 'new', label: 'Новинки' },
  { key: 'temporary', label: 'Временные (preview)' },
]

interface SwapModelModalProps {
  open: boolean
  storyId: number
  stage: 'plotter' | 'writer'
  currentModel: string | null
  onClose: () => void
  onSubmitted: () => void
}

export default function SwapModelModal({ open, storyId, stage, currentModel, onClose, onSubmitted }: SwapModelModalProps) {
  const [categories, setCategories] = useState<ModelCategories>(EMPTY_MODEL_CATEGORIES)
  const [toModel, setToModel] = useState('')
  const [reasonChip, setReasonChip] = useState<string>('')
  const [reasonText, setReasonText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedSections = useMemo(
    () => SECTIONS.map(({ key, label }) => ({
      label,
      models: [...categories[key]].sort((a, b) => combinedCost(a) - combinedCost(b)),
    })),
    [categories],
  )

  useEffect(() => {
    if (!open) return
    api.models.list().then(setCategories).catch(() => undefined)
  }, [open])

  if (!open) return null

  const canSubmit = toModel.length > 0 && (reasonChip.length > 0 || reasonText.trim().length > 0) && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      await api.swapModel.submit(storyId, {
        stage,
        toModel,
        ...(reasonChip ? { reasonChip } : {}),
        ...(reasonText.trim() ? { reasonText: reasonText.trim() } : {}),
      })
      onSubmitted()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить модель')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg p-8">
        <h3 className="font-bold text-lg">Сменить модель и пере-запустить: {stage}</h3>
        <p className="text-sm text-base-content/60 mt-1">Текущая: <code>{currentModel ?? '—'}</code></p>

        <label className="label mt-6"><span className="label-text">Новая модель</span></label>
        <select
          className="select select-bordered w-full"
          value={toModel}
          onChange={(e) => setToModel(e.target.value)}
        >
          <option value="">— выбрать —</option>
          {sortedSections.map(({ label, models }) => {
            if (models.length === 0) return null
            return (
              <optgroup key={label} label={label}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({formatPrice(m)})
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>

        <label className="label mt-4"><span className="label-text">Почему?</span></label>
        <div className="flex flex-wrap gap-2">
          {REASON_CHIPS.map((c) => (
            <button
              type="button"
              key={c.value}
              className={`btn btn-xs ${reasonChip === c.value ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
              onClick={() => setReasonChip(reasonChip === c.value ? '' : c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <textarea
          className="textarea textarea-bordered w-full mt-3"
          rows={3}
          placeholder="Или впишите своими словами"
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
        />

        {error && <p className="text-sm text-error mt-2">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Запускаю…' : 'Сменить и пере-запустить'}
          </button>
        </div>
      </div>
    </div>
  )
}
