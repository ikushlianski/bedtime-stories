import { useState } from 'react'
import type { ModelCatalogEntry } from '../lib/api'
import { StoryIdea, api } from '../lib/api'
import { Button } from './button'
import { IdeaRejectModal } from './idea-reject-modal'
import ModelSelectDropdown from './model-select-dropdown'

export interface IdeaCardProps {
  idea: StoryIdea
  models: ModelCatalogEntry[]
  onApprove: (createStory?: boolean, model?: string) => Promise<void>
  onReject: (reason?: string) => Promise<void>
  disabled?: boolean
}

export function IdeaCard({ idea, models, onApprove, onReject, disabled = false }: IdeaCardProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [selectedApprovalModel, setSelectedApprovalModel] = useState('')

  const handleApprove = () => {
    setShowApproveModal(true)
  }

  const handleApproveWithModel = async () => {
    if (!selectedApprovalModel) {
      return
    }

    setIsApproving(true)
    try {
      await onApprove(true, selectedApprovalModel)
      setShowApproveModal(false)
      setSelectedApprovalModel('')
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
              <p className="text-xs text-base-content/50 mt-2">
                Модель: {models.find((m) => m.id === idea.ideaSuggesterModel)?.name || idea.ideaSuggesterModel}
              </p>
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

      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-base-100 rounded-lg p-6 max-w-sm w-full mx-4">
            <h4 className="font-semibold mb-4">Выберите модель для создания истории</h4>
            <ModelSelectDropdown
              models={models}
              value={selectedApprovalModel}
              onChange={setSelectedApprovalModel}
              placeholder="Выберите модель..."
            />
            <div className="flex gap-2 mt-6">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowApproveModal(false)
                  setSelectedApprovalModel('')
                }}
                disabled={isApproving}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                onClick={handleApproveWithModel}
                loading={isApproving}
                disabled={!selectedApprovalModel || isApproving}
                className="flex-1"
              >
                Создать историю
              </Button>
            </div>
          </div>
        </div>
      )}

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
