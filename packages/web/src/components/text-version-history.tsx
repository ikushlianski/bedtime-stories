import { useEffect, useState } from 'react'
import { api, type TextVersion } from '../lib/api'

interface Props {
  storyId: number
  activeVersionId: number | null | undefined
  onRestored: () => void
}

const stageLabels: Record<TextVersion['stage'], string> = {
  writer_initial: 'Первый черновик',
  writer_critic: 'После критика',
  annotated_rewrite: 'Переработка',
  chat_patch: 'Правка из чата',
}

export function TextVersionHistory({ storyId, activeVersionId, onRestored }: Props) {
  const [versions, setVersions] = useState<TextVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    api.stories.listTextVersions(storyId).then(setVersions).finally(() => setLoading(false))
  }, [storyId, activeVersionId])

  async function handleRestore(versionId: number) {
    setRestoring(versionId)

    try {
      await api.stories.restoreTextVersion(storyId, versionId)
      onRestored()
    } finally {
      setRestoring(null)
    }
  }

  if (loading) return <div className="text-sm text-base-content/50">Загрузка версий…</div>

  if (versions.length <= 1) return null

  return (
    <div className="mt-4 rounded-box border border-base-300 bg-base-100 p-4">
      <h3 className="mb-3 text-sm font-semibold">История версий текста</h3>
      <ul className="space-y-2">
        {versions.map((v) => {
          const isActive = v.id === activeVersionId
          return (
            <li
              key={v.id}
              className={`flex items-start justify-between gap-3 rounded-lg p-3 text-sm ${isActive ? 'border border-primary/40 bg-primary/10' : 'border border-base-200 bg-base-50'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{v.version_number}</span>
                  <span className="text-base-content/60">{stageLabels[v.stage]}</span>
                  {isActive && <span className="badge badge-primary badge-sm">текущая</span>}
                </div>
                {v.model_id && <div className="mt-0.5 text-xs text-base-content/50">{v.model_id}</div>}
                {v.preview && (
                  <div className="mt-1 line-clamp-2 text-xs text-base-content/60">{v.preview}</div>
                )}
                <div className="mt-0.5 text-xs text-base-content/40">
                  {new Date(v.created_at).toLocaleString('ru-RU')}
                </div>
              </div>
              {!isActive && (
                <button
                  className="btn btn-ghost btn-sm shrink-0"
                  disabled={restoring !== null}
                  onClick={() => handleRestore(v.id)}
                >
                  {restoring === v.id ? <span className="loading loading-spinner loading-xs" /> : 'Восстановить'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
