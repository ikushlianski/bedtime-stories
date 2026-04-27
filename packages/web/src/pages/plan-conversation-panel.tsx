import { useState, useEffect, useRef } from 'react'
import { api, type ConversationMessage } from '../lib/api'
import { StatusCallout } from '../components'

interface PatchInfo {
  patch: string
  summary: string
  messageId: number
}

function parsePatch(content: string): { patch: string; summary: string } | null {
  const patchMatch = content.match(/<<<PATCH>>>([\s\S]*?)<<<END PATCH>>>/)
  const summaryMatch = content.match(/<<<SUMMARY>>>([\s\S]*?)<<<END SUMMARY>>>/)

  if (!patchMatch || !summaryMatch) return null

  return { patch: patchMatch[1].trim(), summary: summaryMatch[1].trim() }
}

function stripMarkers(content: string): string {
  return content
    .replace(/<<<PATCH>>>[\s\S]*?<<<END PATCH>>>/g, '')
    .replace(/<<<SUMMARY>>>[\s\S]*?<<<END SUMMARY>>>/g, '')
    .trim()
}

interface UsePlanConversationProps {
  storyId: number
  selectedText?: string
}

function usePlanConversation({ storyId, selectedText }: UsePlanConversationProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [pendingPatch, setPendingPatch] = useState<PatchInfo | null>(null)
  const [thinking, setThinking] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    api.pipeline
      .conversations(storyId)
      .then(setMessages)
      .catch(() => undefined)
  }, [storyId])

  const sendMessage = async (text: string) => {
    setThinking(true)
    setSendError(null)

    try {
      const result = await api.pipeline.sendConversationMessage(storyId, text, selectedText)

      setMessages((prev) => [...prev, result.userMessage, result.assistantMessage])

      if (result.patch && result.patchSummary) {
        setPendingPatch({ patch: result.patch, summary: result.patchSummary, messageId: result.assistantMessage.id })
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Не удалось отправить сообщение')
    } finally {
      setThinking(false)
    }
  }

  return { messages, pendingPatch, setPendingPatch, thinking, sendError, sendMessage }
}

interface PlanConversationPanelProps {
  storyId: number
  selectedText?: string
  onPatchApplied?: (newPlanText: string) => void
  onClose?: () => void
}

export function PlanConversationPanel({ storyId, selectedText, onPatchApplied, onClose }: PlanConversationPanelProps) {
  const { messages, pendingPatch, setPendingPatch, thinking, sendError, sendMessage } = usePlanConversation({ storyId, selectedText })
  const [input, setInput] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, thinking])

  const handleSend = () => {
    const text = input.trim()

    if (!text || thinking) return

    setInput('')
    void sendMessage(text)
  }

  const handleApplyPatch = async () => {
    if (!pendingPatch || !selectedText) return

    setApplying(true)
    setApplyError(null)

    try {
      const updated = await api.stories.applyPlanPatch(storyId, {
        find: selectedText,
        replace: pendingPatch.patch,
        summary: pendingPatch.summary,
      })

      setPendingPatch(null)
      onPatchApplied?.(updated.plan_v1 ?? '')
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Не удалось применить изменение')
    } finally {
      setApplying(false)
    }
  }

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-base-content">Обсудить план</h2>
          {onClose && (
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {selectedText && (
          <div className="rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-secondary/70">Выделенный фрагмент</p>
            <p className="line-clamp-3 text-sm italic text-base-content/60">&ldquo;{selectedText}&rdquo;</p>
          </div>
        )}

        <div ref={scrollRef} className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded-lg bg-base-200 p-4">
          {messages.length === 0 && (
            <p className="text-sm text-base-content/50">
              {selectedText
                ? 'Расскажи, что хочешь изменить в выделенном фрагменте.'
                : 'Сообщений пока нет. Спроси что-нибудь о плане.'}
            </p>
          )}

          {messages.map((msg) => {
            const isPatch = pendingPatch?.messageId === msg.id
            const displayContent = msg.role === 'assistant' ? stripMarkers(msg.content) : msg.content
            const parsed = msg.role === 'assistant' ? parsePatch(msg.content) : null

            return (
              <div key={msg.id} className="flex flex-col gap-2">
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'self-end bg-primary text-primary-content'
                      : 'self-start bg-base-100 text-base-content'
                  }`}
                >
                  {displayContent}
                </div>

                {parsed && selectedText && isPatch && (
                  <div className="self-start ml-0 w-full max-w-[85%] rounded-lg border border-success/30 bg-success/5 px-4 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-success/70">Предлагаемая замена</p>
                    <p className="mb-3 whitespace-pre-wrap text-sm text-base-content/80">{parsed.patch}</p>
                    <p className="mb-3 text-xs italic text-base-content/50">{parsed.summary}</p>
                    {applyError && <p className="mb-2 text-xs text-error">{applyError}</p>}
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => void handleApplyPatch()}
                      disabled={applying}
                    >
                      {applying ? 'Применяем...' : 'Применить'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {thinking && (
            <div className="self-start rounded-lg bg-base-100 px-4 py-2 text-sm text-base-content/60">
              Думаю...
            </div>
          )}
        </div>

        {sendError && (
          <StatusCallout tone="error" title="Ошибка отправки" message={sendError} />
        )}

        <div className="flex gap-2">
          <textarea
            className="textarea textarea-bordered flex-1 resize-none"
            rows={2}
            placeholder={selectedText ? 'Что нужно изменить в этом фрагменте?' : 'Спроси о плане...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />

          <div className="self-end">
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={!input.trim() || thinking}
            >
              Отправить
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
