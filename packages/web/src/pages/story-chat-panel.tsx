import { useState, useEffect, useRef } from 'react'
import { api, type ConversationMessage, type StoryComment, type ChatContext } from '../lib/api'
import { StatusCallout, PatchDiffView } from '../components'
import { NOTE_TEXT_MAX_LENGTH, isNoteTextWithinLimit } from '../components/annotation-limits'

interface PatchInfo {
  patch: string
  summary: string
  target?: string
  selectionAtSend?: string
  selectionLineIndexAtSend?: number
  messageId: number
}

function parsePatch(content: string): { patch: string; summary: string; target?: string } | null {
  const patchMatch = content.match(/<<<PATCH>>>([\s\S]*?)<<<END PATCH>>>/)
  const summaryMatch = content.match(/<<<SUMMARY>>>([\s\S]*?)<<<END SUMMARY>>>/)
  const targetMatch = content.match(/<<<TARGET>>>([\s\S]*?)<<<END TARGET>>>/)

  if (!patchMatch || !summaryMatch) return null

  const target = targetMatch?.[1]?.trim()

  return { patch: patchMatch[1].trim(), summary: summaryMatch[1].trim(), ...(target ? { target } : {}) }
}

function stripMarkers(content: string): string {
  return content
    .replace(/<<<TARGET>>>[\s\S]*?<<<END TARGET>>>/g, '')
    .replace(/<<<PATCH>>>[\s\S]*?<<<END PATCH>>>/g, '')
    .replace(/<<<SUMMARY>>>[\s\S]*?<<<END SUMMARY>>>/g, '')
    .trim()
}

interface UseStoryChatProps {
  storyId: number
  context: ChatContext
  selectedText?: string
  selectedTextLineIndex?: number
}

function useStoryChat({ storyId, context, selectedText, selectedTextLineIndex }: UseStoryChatProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [pendingPatch, setPendingPatch] = useState<PatchInfo | null>(null)
  const [thinking, setThinking] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [bankedCount, setBankedCount] = useState(0)
  const [lastBanked, setLastBanked] = useState(false)

  useEffect(() => {
    api.pipeline
      .conversations(storyId, context)
      .then(setMessages)
      .catch(() => undefined)
  }, [storyId, context])

  const sendMessage = async (text: string) => {
    setThinking(true)
    setSendError(null)
    setLastBanked(false)

    try {
      const result = await api.pipeline.sendConversationMessage(storyId, text, selectedText, context)

      if (result.assistantMessage) {
        setMessages((prev) => [...prev, result.userMessage, result.assistantMessage as ConversationMessage])
      } else {
        setMessages((prev) => [...prev, result.userMessage])
      }

      if (result.banked) {
        setBankedCount((count) => count + 1)
        setLastBanked(true)
      }

      if (result.patch && result.patchSummary && result.assistantMessage) {
        setPendingPatch({
          patch: result.patch,
          summary: result.patchSummary,
          target: result.target,
          selectionAtSend: selectedText,
          selectionLineIndexAtSend: selectedTextLineIndex,
          messageId: result.assistantMessage.id,
        })
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Не удалось отправить сообщение')
    } finally {
      setThinking(false)
    }
  }

  return { messages, pendingPatch, setPendingPatch, thinking, sendError, sendMessage, bankedCount, lastBanked }
}

interface StoryChatPanelProps {
  storyId: number
  context: ChatContext | 'read'
  selectedText?: string
  selectedTextLineIndex?: number
  onPatchApplied?: (newText: string) => void
  onClose?: () => void
}

function MutableChatPanel({ storyId, context, selectedText, selectedTextLineIndex, onPatchApplied, onClose }: {
  storyId: number
  context: ChatContext
  selectedText?: string
  selectedTextLineIndex?: number
  onPatchApplied?: (newText: string) => void
  onClose?: () => void
}) {
  const { messages, pendingPatch, setPendingPatch, thinking, sendError, sendMessage, bankedCount, lastBanked } = useStoryChat({
    storyId,
    context,
    selectedText,
    selectedTextLineIndex,
  })
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

    if (!text || thinking || !isNoteTextWithinLimit(text)) return

    setInput('')
    void sendMessage(text)
  }

  const handleApplyPatch = async () => {
    if (!pendingPatch) return

    const findValue = pendingPatch.target ?? pendingPatch.selectionAtSend

    if (!findValue) return

    const usePreSelectedLineIndex = !pendingPatch.target

    setApplying(true)
    setApplyError(null)

    try {
      const updated =
        context === 'plan'
          ? await api.stories.applyPlanPatch(storyId, {
              find: findValue,
              replace: pendingPatch.patch,
              summary: pendingPatch.summary,
            })
          : await api.stories.applyTextPatch(storyId, {
              find: findValue,
              replace: pendingPatch.patch,
              summary: pendingPatch.summary,
              lineIndex: usePreSelectedLineIndex ? pendingPatch.selectionLineIndexAtSend : undefined,
            })

      setPendingPatch(null)
      onPatchApplied?.((context === 'plan' ? updated.plan_v1 : updated.active_text) ?? '')
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Не удалось применить изменение')
    } finally {
      setApplying(false)
    }
  }

  const title = context === 'plan' ? 'Обсудить план' : 'Обсудить текст'
  const emptyHint = selectedText
    ? 'Расскажи, что хочешь изменить в выделенном фрагменте.'
    : `Сообщений пока нет. Спроси что-нибудь о ${context === 'plan' ? 'плане' : 'тексте'} — можно обсудить любую правку.`

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-base-content">{title}</h2>
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

        {bankedCount > 0 && (
          <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-2 text-xs text-info-content">
            Сохранено комментариев для следующей переработки: {bankedCount}
          </div>
        )}

        <div ref={scrollRef} className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded-lg bg-base-200 p-4">
          {messages.length === 0 && !lastBanked && (
            <p className="text-sm text-base-content/50">{emptyHint}</p>
          )}

          {messages.map((msg) => {
            const isPatch = pendingPatch?.messageId === msg.id
            const displayContent = msg.role === 'assistant' ? stripMarkers(msg.content) : msg.content
            const parsed = msg.role === 'assistant' ? parsePatch(msg.content) : null
            const patchOriginal = isPatch ? (pendingPatch?.target ?? pendingPatch?.selectionAtSend) : undefined

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

                {parsed && patchOriginal && isPatch && (
                  <div className="self-start ml-0 w-full max-w-[85%] rounded-lg border border-success/30 bg-success/5 px-4 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-success/70">Предлагаемая замена</p>
                    <div className="mb-3">
                      <PatchDiffView original={patchOriginal} patched={parsed.patch} />
                    </div>
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

          {lastBanked && (
            <div className="self-start rounded-lg border border-info/30 bg-info/5 px-4 py-2 text-sm text-info-content">
              Сохранено — попадёт в следующую переработку.
            </div>
          )}

          {thinking && (
            <div className="self-start rounded-lg bg-base-100 px-4 py-2 text-sm text-base-content/60">
              Думаю...
            </div>
          )}
        </div>

        {sendError && (
          <StatusCallout tone="error" title="Ошибка отправки" message={sendError} />
        )}

        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <textarea
              className="textarea textarea-bordered flex-1 resize-none"
              rows={2}
              placeholder={selectedText ? 'Что нужно изменить в этом фрагменте?' : `Общий комментарий о ${context === 'plan' ? 'плане' : 'тексте'}...`}
              value={input}
              maxLength={NOTE_TEXT_MAX_LENGTH}
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
                disabled={!input.trim() || thinking || !isNoteTextWithinLimit(input)}
              >
                Отправить
              </button>
            </div>
          </div>

          <span className="self-end text-xs text-base-content/50">
            {input.length}/{NOTE_TEXT_MAX_LENGTH}
          </span>
        </div>
      </div>
    </section>
  )
}

function ReadOnlyCommentPanel({ storyId, onClose }: { storyId: number; onClose?: () => void }) {
  const [comments, setComments] = useState<StoryComment[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    api.comments
      .list(storyId)
      .then(setComments)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [storyId])

  const handleSend = async () => {
    const text = input.trim()

    if (!text || saving) return

    setSaving(true)
    setSaveError(null)

    try {
      const created = await api.comments.create(storyId, { commentText: text })

      setComments((prev) => [...prev, created])
      setInput('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить комментарий')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-base-content">Комментарии</h2>
          {onClose && (
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {!loading && comments.length === 0 && (
          <p className="text-sm text-base-content/50">Комментариев пока нет.</p>
        )}

        {comments.length > 0 && (
          <ul className="flex flex-col gap-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-base-200 px-4 py-2 text-sm text-base-content">
                {c.selectedText && (
                  <p className="mb-1 text-xs italic text-base-content/50">&ldquo;{c.selectedText}&rdquo;</p>
                )}
                <p>{c.commentText}</p>
              </li>
            ))}
          </ul>
        )}

        {saveError && (
          <StatusCallout tone="error" title="Ошибка сохранения" message={saveError} />
        )}

        <div className="flex gap-2">
          <textarea
            className="textarea textarea-bordered flex-1 resize-none"
            rows={2}
            placeholder="Оставь комментарий об этой истории..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
          />

          <div className="self-end">
            <button
              className="btn btn-primary"
              onClick={() => void handleSend()}
              disabled={!input.trim() || saving}
            >
              {saving ? '...' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export function StoryChatPanel({ storyId, context, selectedText, selectedTextLineIndex, onPatchApplied, onClose }: StoryChatPanelProps) {
  if (context === 'read') {
    return <ReadOnlyCommentPanel storyId={storyId} onClose={onClose} />
  }

  return (
    <MutableChatPanel
      storyId={storyId}
      context={context}
      selectedText={selectedText}
      selectedTextLineIndex={selectedTextLineIndex}
      onPatchApplied={onPatchApplied}
      onClose={onClose}
    />
  )
}
