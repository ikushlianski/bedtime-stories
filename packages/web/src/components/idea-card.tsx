import { useState } from 'react'
import { StoryIdea } from '../lib/api'
import { Button } from './button'
import { IdeaRejectModal } from './idea-reject-modal'

export interface IdeaCardProps {
  idea: StoryIdea
  onApprove: (createStory?: boolean) => Promise<void>
  onReject: (reason?: string) => Promise<void>
  disabled?: boolean
}

export function IdeaCard({ idea, onApprove, onReject, disabled = false }: IdeaCardProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await onApprove(true)
    } finally {
      setIsApproving(false)
    }
  }

  const handleRejectSubmit = async (reason?: string) => {
    setIsRejecting(true)
    try {
      await onReject(reason)
      setShowRejectModal(false)
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <>
      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="card-title text-sm font-semibold text-base-content">{idea.topic}</h3>
              <p className="text-sm text-base-content my-2">{idea.seedText}</p>
              <p className="text-xs text-base-content/70 italic">{idea.rationale}</p>
            </div>
          </div>

          <div className="card-actions justify-end gap-2 mt-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRejectModal(true)}
              disabled={disabled || isRejecting}
              loading={isRejecting}
            >
              Отклонить
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={disabled || isApproving}
              loading={isApproving}
            >
              Использовать
            </Button>
          </div>
        </div>
      </div>

      {showRejectModal && (
        <IdeaRejectModal
          onConfirm={handleRejectSubmit}
          onCancel={() => setShowRejectModal(false)}
          isLoading={isRejecting}
        />
      )}
    </>
  )
}
