import { useState } from 'react'
import { Button } from './button'

export interface IdeaRejectModalProps {
  onConfirm: (reason?: string) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function IdeaRejectModal({ onConfirm, onCancel, isLoading = false }: IdeaRejectModalProps) {
  const [reason, setReason] = useState('')

  const handleConfirm = async () => {
    await onConfirm(reason || undefined)
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-sm">
        <h3 className="font-bold text-lg">Отклонить идею?</h3>
        <p className="py-4 text-sm text-base-content/70">
          Укажите причину отклонения (необязательно), чтобы система учла это при генерировании новых идей.
        </p>

        <textarea
          className="textarea textarea-bordered w-full text-sm"
          placeholder="Например: слишком похоже на существующую историю, не подходит для возраста..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isLoading}
          rows={3}
        />

        <div className="modal-action gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} loading={isLoading}>
            Отклонить
          </Button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onCancel}>
        <button>close</button>
      </form>
    </dialog>
  )
}
