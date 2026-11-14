// Light and dark mode: the same device in aluminium or black. Stored per viewer.
import { useEffect, useState } from 'react'

export type Mode = 'light' | 'dark'

const read = (): Mode => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

export function useMode() {
  const [mode, setMode] = useState<Mode>(read)
  useEffect(() => {
    document.documentElement.dataset.theme = mode
    try {
      localStorage.setItem('ff-theme', mode)
    } catch {
      /* private window: the choice just isn't remembered */
    }
  }, [mode])
  return [mode, setMode] as const
}
