import { useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

type Theme = 'light' | 'dark'

const storageKey = 'theme'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(storageKey)

  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(storageKey, theme)
  }, [theme])

  function toggle() {
    setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))
  }

  useHotkeys('mod+d', (event) => {
    event.preventDefault()
    toggle()
  })

  return { theme, toggle }
}
