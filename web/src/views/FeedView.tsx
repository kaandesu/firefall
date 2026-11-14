// The raw Lagrange activity feed — what /api/events streams. Useful to show judges this is real A2A traffic.
import { useEffect, useRef } from 'react'
import { AgentTag, fmtTime } from '@/components/bits'
import { useMission } from '@/live/store'

const KIND_TONE: Record<string, string> = { task: 'text-k-task', message: 'text-k-ask', artifact: 'text-k-review', usage: 'text-faint', presence: 'text-faint' }

export function FeedView() {
  const feed = useMission((s) => s.model.feed)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = end.current?.parentElement
    if (el) el.scrollTop = el.scrollHeight
  }, [feed.length])
  return (
    <div className="scroll-thin mono h-full overflow-y-auto p-2 text-[10.5px]">
      {feed.map((e) => (
        <div key={e.seq} className="flex gap-2 border-b border-line/50 py-0.5">
          <span className="w-8 shrink-0 text-right text-faint">{e.seq}</span>
          <span className="w-14 shrink-0 text-faint">{fmtTime(Date.parse(e.at))}</span>
          <span className={`w-14 shrink-0 ${KIND_TONE[e.kind] ?? ''}`}>{e.kind}</span>
          <span className="w-36 shrink-0 truncate">
            {e.sender && <AgentTag handle={e.sender} className="text-[10px]" />}
            {e.recipient && (
              <>
                <span className="text-faint"> → </span>
                <AgentTag handle={e.recipient} className="text-[10px]" />
              </>
            )}
          </span>
          <span className="truncate text-muted-foreground">
            {e.state ? `${e.state.replace('TASK_STATE_', '')} · ` : ''}
            {(e.data?.name as string) ?? ''} {e.summary ?? (e.data?.text as string) ?? ''}
          </span>
        </div>
      ))}
      <div ref={end} />
    </div>
  )
}
