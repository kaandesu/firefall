// Whether a person has signed the hazard report, read from the inbox.
import { SIGN_GATE, SIGN_OPTIONS } from '@/demo/apollo1'
import type { Model } from './model'
import type { InboxItem } from './types'

export const openFor = (items: InboxItem[], who: string) => items.filter((x) => x.to === who && x.status === 'open').length

export const tPlus = (m: Model, at?: number) => {
  const s = Math.max(0, Math.round(((at ?? m.now) - (m.run?.at ?? at ?? 0)) / 1000))
  return `T+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function signature(m: Model): { signed: boolean; by?: string; when?: string } {
  const it = m.inbox.find((x) => x.id === SIGN_GATE && x.status === 'done')
  if (!it || !it.answer || it.answer.startsWith(SIGN_OPTIONS[1])) return { signed: false }
  return { signed: true, by: 'You', when: tPlus(m, it.doneAt) }
}
