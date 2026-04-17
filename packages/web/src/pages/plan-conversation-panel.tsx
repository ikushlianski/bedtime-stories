import { useState, useEffect } from 'react'
import { api, type ConversationMessage } from '../lib/api'
import { StatusCallout } from '../components'

function usePlanConversation(storyId: number) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    api.pipeline
      .conversations(storyId)
      .then(setMessages)
      .catch(() => {
        /* non-fatal */
      })
  }, [storyId])

  const sendMessage = async (text: string) => {
    setThinking(true)
    setSendError(null)

    try {
      const { userMessage, assistantMessage } = await api.pipeline.sendConversationMessage(storyId, text)

      setMessages((prev) => [...prev, userMessage, assistantMessage])
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Не удалось отправить сообщение')
    } finally {
      setThinking(false)
    }
  }

  return { messages, thinking, sendError, sendMessage }
}

export function PlanConversationPanel({ storyId }: { storyId: number }) {
  const { messages, thinking, sendError, sendMessage } = usePlanConversation(storyId)
  const [input, setInput] = useState('')

  const handleSend = () => {
    const text = input.trim()

    if (!text || thinking) {
      return
    }

    setInput('')
    void sendMessage(text)
  }

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="font-serif text-2xl text-base-content">Обсудить план</h2>

        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded-lg bg-base-200 p-4">
          {messages.length === 0 && (
            <p className="text-sm text-base-content/50">Сообщений пока нет. Спроси что-нибудь о плане.</p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'self-end bg-primary text-primary-content'
                  : 'self-start bg-base-100 text-base-content'
              }`}
            >
              {msg.content}
            </div>
          ))}

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
            placeholder="Спроси о плане..."
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
