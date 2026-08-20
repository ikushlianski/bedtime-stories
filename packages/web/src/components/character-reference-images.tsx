import { useEffect, useState } from 'react'
import { api, type CharacterReferenceImage } from '../lib/api'

interface CharacterReferenceImagesProps {
  universeId: number
  characterId: number
}

function CharacterReferenceImages({ universeId, characterId }: CharacterReferenceImagesProps) {
  const [images, setImages] = useState<CharacterReferenceImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    api.universes
      .listReferenceImages(universeId, characterId)
      .then((imgs) => {
        if (!cancelled) setImages(imgs)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить референсы')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [universeId, characterId])

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''

    if (files.length === 0) return

    setUploading(true)
    setError(null)

    try {
      const uploaded = await api.universes.uploadReferenceImages(universeId, characterId, files)
      setImages((prev) => [...prev, ...uploaded])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить референсы')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(imageId: number) {
    try {
      await api.universes.deleteReferenceImage(universeId, characterId, imageId)
      setImages((prev) => prev.filter((img) => img.id !== imageId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить референс')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-base-content/70">Референсы персонажа</span>

      {!loading && images.length === 0 && <p className="text-xs text-base-content/40">Референсов пока нет.</p>}

      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <div key={img.id} className="relative">
            <img src={img.url} alt="Референс персонажа" className="h-16 w-16 rounded border border-base-300 object-cover" />
            <button
              type="button"
              className="btn btn-error btn-circle btn-xs absolute -right-1 -top-1"
              onClick={() => void handleDelete(img.id)}
              aria-label="Удалить референс"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="file-input file-input-bordered file-input-sm w-full max-w-xs bg-base-100"
        disabled={uploading}
        onChange={(e) => void handleFilesSelected(e)}
      />

      {uploading && <p className="text-xs text-base-content/40">Загружаем...</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

export default CharacterReferenceImages
