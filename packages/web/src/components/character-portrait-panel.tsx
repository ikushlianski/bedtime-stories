import { useState } from 'react'
import { api, type CharacterPortraitHistoryEntry, type CurrentPortrait, type PortraitTier } from '../lib/api'

const TIER_LABEL: Record<PortraitTier, string> = {
  own_reference: 'по своим референсам',
  universe_sibling: 'по стилю вселенной',
  default_style: 'по стандартному стилю',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface CharacterPortraitPanelProps {
  universeId: number
  characterId: number
  characterName: string
  currentPortrait: CurrentPortrait | null
  onPortraitUpdated: (portrait: CurrentPortrait) => void
}

function CharacterPortraitPanel({ universeId, characterId, characterName, currentPortrait, onPortraitUpdated }: CharacterPortraitPanelProps) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<CharacterPortraitHistoryEntry[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  async function handleGenerate() {
    const confirmMessage = currentPortrait
      ? `Перегенерировать портрет для «${characterName}»? Это платный запрос.`
      : `Сгенерировать портрет для «${characterName}»? Это платный запрос.`

    if (!window.confirm(confirmMessage)) return

    setGenerating(true)
    setError(null)

    try {
      const portrait = await api.universes.generatePortrait(universeId, characterId)
      onPortraitUpdated(portrait)
      setHistory(null)
      if (historyOpen) {
        void loadHistory()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сгенерировать портрет')
    } finally {
      setGenerating(false)
    }
  }

  async function loadHistory() {
    setLoadingHistory(true)

    try {
      const entries = await api.universes.getPortraitHistory(universeId, characterId)
      setHistory(entries)
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  function handleToggleHistory() {
    const next = !historyOpen
    setHistoryOpen(next)

    if (next && history === null) {
      void loadHistory()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {currentPortrait ? (
          <img
            src={currentPortrait.imageUrl}
            alt={`Портрет персонажа ${characterName}`}
            className="h-16 w-16 rounded-full border border-base-300 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-base-300 text-xs text-base-content/40">
            Нет портрета
          </div>
        )}

        <div className="flex flex-1 flex-col gap-1">
          {currentPortrait && (
            <div className="text-xs text-base-content/50">
              <span className="badge badge-ghost badge-xs">{TIER_LABEL[currentPortrait.tier]}</span>
              {currentPortrait.generatedAt && <span className="ml-2">{formatDate(currentPortrait.generatedAt)}</span>}
            </div>
          )}

          <button
            className={`btn btn-xs btn-outline self-start ${generating ? 'loading' : ''}`}
            disabled={generating}
            onClick={() => void handleGenerate()}
          >
            {generating ? 'Генерируем...' : currentPortrait ? 'Перегенерировать портрет' : 'Сгенерировать портрет'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

      {currentPortrait && (
        <button className="self-start text-xs text-base-content/40 underline" onClick={handleToggleHistory}>
          {historyOpen ? 'Скрыть предыдущие портреты' : 'Показать предыдущие портреты'}
        </button>
      )}

      {historyOpen && (
        <div className="flex flex-wrap gap-2">
          {loadingHistory && <p className="text-xs text-base-content/40">Загружаем...</p>}
          {!loadingHistory && history?.length === 0 && <p className="text-xs text-base-content/40">Предыдущих портретов нет.</p>}
          {!loadingHistory &&
            history?.map((entry) => (
              <img
                key={entry.id}
                src={entry.imageUrl}
                alt={`Предыдущий портрет персонажа ${characterName}`}
                title={TIER_LABEL[entry.tier]}
                className="h-12 w-12 rounded-full border border-base-300 object-cover"
              />
            ))}
        </div>
      )}
    </div>
  )
}

export default CharacterPortraitPanel
