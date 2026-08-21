import type { StoryIllustrationMarker } from '../lib/api'

interface StoryIllustrationMarkersPanelProps {
  markers: StoryIllustrationMarker[]
  onDelete: (markerId: number) => void
  deletingId?: number | null
}

function StoryIllustrationMarkersPanel({ markers, onDelete, deletingId }: StoryIllustrationMarkersPanelProps) {
  if (markers.length === 0) return null

  return (
    <div className="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-base-content/50">
        Отмечено для иллюстрации ({markers.length})
      </p>
      <ul className="space-y-2">
        {markers.map((marker) => (
          <li key={marker.id} className="flex items-center justify-between gap-2 rounded-lg bg-base-200 px-3 py-2">
            <span className="truncate text-sm italic text-base-content/70">&laquo;{marker.markedText}&raquo;</span>
            <button
              className="btn btn-ghost btn-xs"
              disabled={deletingId === marker.id}
              onClick={() => onDelete(marker.id)}
            >
              {deletingId === marker.id ? '...' : '✕'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default StoryIllustrationMarkersPanel
