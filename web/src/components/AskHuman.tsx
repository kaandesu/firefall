import { Hand } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMission } from '@/live/store'
import { AgentTag, Avatar } from './bits'

/** The Review Lead's ask_human: the run is INPUT_REQUIRED until you answer (the demo answers itself after a few seconds). */
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
      className="rounded-lg border border-warn/40 bg-warn/5 p-3"
    >
      <div className="flex items-center gap-2">
        <Hand size={14} className="text-warn" />
        <span className="text-[12px] font-medium text-warn">Your decision is needed</span>
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
        {holding && <span className="ml-auto text-[11px] text-faint">demo picks the first option in {left}s</span>}
      </div>
    </motion.div>
  )
}
