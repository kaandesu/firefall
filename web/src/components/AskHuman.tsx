import { Hand } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMission } from '@/live/store'
import { AgentTag, Avatar } from './bits'

/** FLIGHT's ask_human: the run is INPUT_REQUIRED until you answer (the demo answers itself after a few seconds). */
export function AskHuman({ compact = false }: { compact?: boolean }) {
  const w = useMission((s) => s.model.waiting)
  const answer = useMission((s) => s.answer)
  const holding = useMission((s) => s.status.holding)
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!w) return
    const start = Date.now()
    const id = setInterval(() => setLeft(Math.max(0, 9 - Math.floor((Date.now() - start) / 1000))), 250)
    return () => clearInterval(id)
  }, [w])
  if (!w) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glow-flame rounded-lg border border-k-ask/50 bg-[color-mix(in_oklab,var(--k-ask)_8%,var(--surface-2))] p-3"
    >
      <div className="flex items-center gap-2">
        <Hand size={14} className="text-k-ask" />
        <span className="mono text-[10px] uppercase tracking-widest text-k-ask">Input required</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Avatar handle={w.from} size={16} />
          <AgentTag handle={w.from} />
        </span>
      </div>
      <div className={compact ? 'mt-1.5 text-xs' : 'mt-2 text-sm leading-snug'}>{w.question}</div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {w.options.map((o, i) => (
          <Button key={o} size="sm" variant={i === 0 ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => answer(o)}>
            {o}
          </Button>
        ))}
        {holding && <span className="mono ml-auto text-[10px] text-faint">auto in {left}s</span>}
      </div>
    </motion.div>
  )
}
