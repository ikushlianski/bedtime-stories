import { useState, useEffect } from 'react'

type Theme = 'bedtime' | 'bedtime-dark'

const STORAGE_KEY = 'bedtime-theme'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored === 'bedtime' || stored === 'bedtime-dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'bedtime-dark' : 'bedtime'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'bedtime'
    }

    return getInitialTheme()
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((t) => (t === 'bedtime' ? 'bedtime-dark' : 'bedtime'))
  }

  return { theme, toggleTheme, isDark: theme === 'bedtime-dark' }
}
