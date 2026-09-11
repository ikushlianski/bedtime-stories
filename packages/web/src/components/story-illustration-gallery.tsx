import { useState, useEffect, useCallback } from 'react'
import { api, type StoryIllustration } from '../lib/api'

const EMPTY_ALBUM_RETRY_DELAY_MS = 15000

interface StoryIllustrationGalleryProps {
  storyId: number
}

function StoryIllustrationGallery({ storyId }: StoryIllustrationGalleryProps) {
  const [illustrations, setIllustrations] = useState<StoryIllustration[]>([])
  const [loaded, setLoaded] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [customCount, setCustomCount] = useState(2)
  const [generatingCustom, setGeneratingCustom] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const rows = await api.stories.listIllustrations(storyId)
      setIllustrations(rows)
      return rows
    } catch {
      return []
    } finally {
      setLoaded(true)
    }
  }, [storyId])

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    void load().then((rows) => {
      if (cancelled || rows.length > 0) return

      retryTimer = setTimeout(() => {
        if (!cancelled) void load()
      }, EMPTY_ALBUM_RETRY_DELAY_MS)
    })

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [load])

  async function handleRegenerate() {
    if (
      !window.confirm(
        'Перегенерировать альбом иллюстраций? Это платный запрос — текущие картинки будут заменены новыми.',
      )
    ) {
      return
    }

    setRegenerating(true)
    setError(null)

    try {
      const rows = await api.stories.regenerateIllustrations(storyId)
      setIllustrations(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось перегенерировать альбом')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleGenerateCustom() {
    if (
      !window.confirm(
        'Сгенерировать иллюстрации по этому промпту? Это платный запрос — картинки будут добавлены к альбому.',
      )
    ) {
      return
    }

    setGeneratingCustom(true)
    setCustomError(null)

    try {
      const newRows = await api.stories.generateCustomIllustrations(storyId, { prompt: customPrompt, count: customCount })
      setIllustrations((prev) => [...prev, ...newRows])

      if (newRows.length < customCount) {
        setCustomError(`Сгенерировано ${newRows.length} из ${customCount} — часть запросов не удалась`)
      } else {
        setCustomPrompt('')
      }
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : 'Не удалось сгенерировать иллюстрации')
    } finally {
      setGeneratingCustom(false)
    }
  }

  if (!loaded) return null

  const activeIllustration = lightboxIndex !== null ? illustrations[lightboxIndex] : undefined

  return (
    <div className="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">Иллюстрации</p>
        <button
          className={`btn btn-xs btn-outline ${regenerating ? 'loading' : ''}`}
          disabled={regenerating}
          onClick={() => void handleRegenerate()}
        >
          {regenerating ? 'Генерируем...' : 'Перегенерировать альбом'}
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-error">{error}</p>}

      <div className="mb-3 rounded-box border border-base-200 bg-base-200/40 p-3">
        <textarea
          className="textarea textarea-bordered w-full bg-base-100"
          placeholder="Промпт для генерации иллюстрации (используется дословно)"
          rows={2}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            className="input input-bordered input-sm w-20 bg-base-100"
            min={1}
            max={6}
            value={customCount}
            onChange={(e) => setCustomCount(Number(e.target.value))}
          />
          <button
            className={`btn btn-xs btn-outline ${generatingCustom ? 'loading' : ''}`}
            disabled={generatingCustom || customPrompt.trim().length === 0}
            onClick={() => void handleGenerateCustom()}
          >
            {generatingCustom ? 'Генерируем...' : 'Сгенерировать по промпту'}
          </button>
        </div>
        {customError && <p className="mt-2 text-xs text-error">{customError}</p>}
      </div>

      {illustrations.length === 0 ? (
        <p className="text-xs text-base-content/40">Иллюстрации ещё не готовы.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {illustrations.map((illustration, index) => (
            <button
              key={illustration.id}
              className="h-24 w-24 overflow-hidden rounded-box border border-base-300"
              onClick={() => setLightboxIndex(index)}
            >
              <img src={illustration.imageUrl} alt={illustration.momentDescription} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {activeIllustration && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={activeIllustration.imageUrl}
              alt={activeIllustration.momentDescription}
              className="max-h-[80vh] w-full rounded-box object-contain"
            />
            <p className="mt-2 text-center text-sm text-white/80">{activeIllustration.momentDescription}</p>

            <button className="btn btn-circle btn-sm absolute right-2 top-2" onClick={() => setLightboxIndex(null)}>
              ✕
            </button>

            {illustrations.length > 1 && (
              <>
                <button
                  className="btn btn-circle btn-sm absolute left-2 top-1/2 -translate-y-1/2"
                  onClick={() =>
                    setLightboxIndex((i) => (i === null ? null : (i - 1 + illustrations.length) % illustrations.length))
                  }
                >
                  ←
                </button>
                <button
                  className="btn btn-circle btn-sm absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setLightboxIndex((i) => (i === null ? null : (i + 1) % illustrations.length))}
                >
                  →
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default StoryIllustrationGallery
