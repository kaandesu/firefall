import { ArrowRight, MessagesSquare } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AskHuman } from '@/components/AskHuman'
import { AgentTag, Avatar, CiteChip, Empty, KIND_COLOR, KindBadge, fmtTime } from '@/components/bits'
import { CREW, HUMAN } from '@/demo/crew'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

export function CommsView() {
  const comms = useMission((s) => s.model.comms)
  const [filter, setFilter] = useState<string | null>(null)
  const [hideTasks, setHideTasks] = useState(false)
  const list = useMemo(
    () => comms.filter((c) => (!filter || c.from === filter || c.to === filter) && (!hideTasks || c.kind !== 'task')),
    [comms, filter, hideTasks],
  )
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = end.current?.parentElement
    if (el) el.scrollTop = el.scrollHeight
  }, [list.length])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <button type="button" onClick={() => setFilter(null)} className={cn('mono rounded px-1.5 py-0.5 text-[10px]', !filter ? 'bg-surface-3 text-ink' : 'text-muted-foreground hover:text-ink')}>
          all
        </button>
        {[HUMAN, ...CREW.map((a) => a.handle)].map((h) => (
          <button key={h} type="button" onClick={() => setFilter(filter === h ? null : h)} className={cn('rounded p-0.5 transition', filter === h ? 'bg-surface-3 ring-1 ring-line-2' : 'opacity-60 hover:opacity-100')} title={h}>
            <Avatar handle={h} size={16} />
          </button>
        ))}
        <button type="button" onClick={() => setHideTasks(!hideTasks)} className="mono ml-auto rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-ink">
          {hideTasks ? 'show tasks' : 'hide tasks'}
        </button>
      </div>
      <div className="px-2 pt-2">
        <AskHuman />
      </div>
      {list.length === 0 ? (
        <Empty icon={<MessagesSquare size={26} />} title="Quiet channel" hint="Agent-to-agent asks, replies and reviews appear here as they cross Lagrange." />
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <AnimatePresence initial={false}>
            {list.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn('group mb-1.5 rounded-md border-l-2 bg-surface-2/60 px-2.5 py-1.5', c.kind === 'human' && 'bg-surface-3')}
                style={{ borderColor: KIND_COLOR[c.kind] }}
              >
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Avatar handle={c.from} size={14} />
                  <AgentTag handle={c.from} />
                  <ArrowRight size={10} className="text-faint" />
                  <AgentTag handle={c.to} />
                  <KindBadge kind={c.kind} />
                  <span className="mono ml-auto text-[9px] text-faint opacity-0 transition group-hover:opacity-100">{fmtTime(c.at)}</span>
                </div>
                <div className={cn('mt-0.5 text-[12.5px] leading-snug', c.kind === 'task' ? 'text-muted-foreground' : 'text-ink')}>{c.text}</div>
                {c.cites && c.cites.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.cites.map((ct) => (
                      <CiteChip key={ct.id} id={ct.id} />
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={end} />
        </div>
      )}
    </div>
  )
}
