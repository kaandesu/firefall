// Two finishes of the same device: "field" (light aluminium) and "xy" (black). Stored per viewer.
import { useEffect, useState } from 'react'

export type Finish = 'field' | 'xy'

const read = (): Finish => (document.documentElement.dataset.theme === 'xy' ? 'xy' : 'field')

export function useFinish() {
  const [finish, setFinish] = useState<Finish>(read)
  useEffect(() => {
    document.documentElement.dataset.theme = finish
    try {
      localStorage.setItem('ff-theme', finish)
    } catch {
      /* private window: the choice just isn't remembered */
    }
  }, [finish])
  return [finish, setFinish] as const
}
