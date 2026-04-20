import { useState, useCallback, useRef } from 'react'

export function useToast(durationMs = 2500) {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    setMessage(text)
    timerRef.current = setTimeout(() => setMessage(null), durationMs)
  }, [durationMs])

  return { message, showToast }
}
