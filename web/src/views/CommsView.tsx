import { OrbNote } from '@/components/Logo'
// 6 COMMS: every agent ⇄ agent message across Lagrange, one line each, colour = message kind.
import { useEffect, useRef } from 'react'
import { CiteChip, KIND_COLOR, KIND_LABEL } from '@/components/bits'
import { agentColor, agentName, orgOf } from '@/demo/crew'
import { useMission } from '@/live/store'

const hm = (ms: number) => new Date(ms).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })

export function CommsView() {
  const comms = useMission((s) => s.model.comms)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [comms.length])
  if (!comms.length) return <OrbNote className="!p-3">quiet. asks, answers and reviews between agents show up here as they cross Lagrange.</OrbNote>
  return (
    <div className="scroll-thin h-full overflow-y-auto px-2">
      {comms.map((c) => (
        <div key={c.id} className="flex items-baseline gap-2 py-px text-body leading-snug">
          <span className="w-[38px] shrink-0 tnum text-faint">{hm(c.at)}</span>
          <span className="w-[58px] shrink-0 text-label lowercase" style={{ color: KIND_COLOR[c.kind] }}>
            {KIND_LABEL[c.kind]}
          </span>
          <span className="shrink-0" style={{ color: agentColor(c.from) }}>
            {agentName(c.from)}
          </span>
          <span className="shrink-0 text-faint">→</span>
          <span className="shrink-0" style={{ color: agentColor(c.to) }}>
            {agentName(c.to)}
          </span>
          <span className={c.kind === 'task' ? 'sans min-w-0 text-muted-foreground' : 'sans min-w-0 text-ink'}>{c.text}</span>
          {c.cites?.map((ct) => <CiteChip key={ct.id} id={ct.id} note={ct.note} className="shrink-0" />)}
          {c.saved && (
            <span className="shrink-0 rounded-sm border border-ok/30 px-1 text-label text-ok" title={`Asked instead of ${c.saved.instead}`}>
              ↯ saved ≈ {Math.round(c.saved.tokens / 1000)}k tokens
            </span>
          )}
          {orgOf(c.from) && orgOf(c.to) && orgOf(c.from)!.id !== orgOf(c.to)!.id && (
            <span className="shrink-0 text-label lowercase text-faint">
              {orgOf(c.from)!.id} → {orgOf(c.to)!.id}
            </span>
          )}
        </div>
      ))}
      <div ref={end} />
    </div>
  )
}
