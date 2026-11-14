import { CornerDownLeft, Siren } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { AskHuman } from '@/components/AskHuman'
import { useMission } from '@/live/store'
import { Dock } from './TileGrid'

const SUGGEST = [
  'Certify the PR-2 rover cabin at 8.2 psia / 34 % O₂',
  'Smoke alarm aft avionics bay — what do we do?',
  'Open case file: Apollo 1',
]

export function CommandBar() {
  const [text, setText] = useState('')
  const load = useMission((s) => s.load)
  const mode = useMission((s) => s.mode)
  const waiting = useMission((s) => s.model.waiting)
  const maxed = useMission((s) => s.max)
  const tiles = useMission((s) => s.tiles)
  const commsVisible = maxed === null ? tiles.includes('comms') : tiles[maxed] === 'comms'

  const submit = (q: string) => {
    if (!q.trim()) return
    // Demo: route the prompt to the closest scripted run. Live: POST it to FLIGHT via Lagrange (/api/send).
    if (mode === 'demo') {
      const t = q.toLowerCase()
      load(/apollo|1967|case/.test(t) ? 'apollo1' : /smoke|alarm|incident|fire now|bay/.test(t) ? 'incident' : 'habitat', true)
    } else {
      fetch('/api/lagrange/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: 'flight', text: q }) }).catch(() => {})
    }
    setText('')
  }

  return (
    <div className="no-print shrink-0 border-t border-line bg-surface/70 px-3 py-2 backdrop-blur">
      <AnimatePresence>
        {waiting && !commsVisible && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mb-2 max-w-2xl">
            <AskHuman compact />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2">
        <Alarms />
        <form
          className="flex flex-1 items-center gap-2 rounded-lg border border-line-2 bg-surface-2 px-3 py-1.5 focus-within:border-ug/60"
          onSubmit={(e) => {
            e.preventDefault()
            submit(text)
          }}
        >
          <span className="mono text-[10.5px] text-flame">@flight</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Give the crew a spec, a question, or an incident…" className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint" />
          <CornerDownLeft size={13} className="text-faint" />
        </form>
        <Dock />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {SUGGEST.map((s) => (
          <button key={s} type="button" onClick={() => submit(s)} className="rounded-full border border-line px-2.5 py-0.5 text-[10.5px] text-muted-foreground transition hover:border-line-2 hover:text-ink">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function Alarms() {
  const alarms = useMission((s) => s.model.alarms)
  const a = alarms[alarms.length - 1]
  if (!a) return null
  return (
    <motion.div initial={{ scale: 0.95 }} animate={{ scale: [1, 1.03, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="flex items-center gap-1.5 rounded-lg border border-k-fail/60 bg-k-fail/15 px-2.5 py-1.5 text-[11.5px] text-k-fail">
      <Siren size={13} />
      <span className="mono font-semibold">SMOKE</span>
      <span className="hidden text-k-fail/80 lg:inline">{a.module} · {a.detector}</span>
    </motion.div>
  )
}
