// 5 FINDINGS: the materials matrix. One line per part (status, O₂ margin); open a row for the action and its sources.
import { ChevronRight } from 'lucide-react'
import { CiteChip, StatusPill } from '@/components/bits'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

export function FindingsView() {
  const rows = useMission((s) => s.model.matrix)
  const open = useMission((s) => s.openRow)
  const toggle = useMission((s) => s.toggleRow)
  const setHover = useMission((s) => s.setHoverZone)
  if (!rows.length) return <div className="px-3 py-2 text-[11px] text-faint">the materials matrix lands here when @prevent finishes.</div>
  return (
    <div className="scroll-thin h-full overflow-y-auto px-1" onMouseLeave={() => setHover(undefined)}>
      <div className="grid grid-cols-[14px_1.6fr_1.2fr_0.8fr_70px_90px] gap-2 px-1.5 pb-1 text-[9.5px] lowercase text-faint">
        <span />
        <span>part</span>
        <span>material</span>
        <span>zone</span>
        <span>status</span>
        <span className="text-right">O₂ margin</span>
      </div>
      {rows.map((r) => {
        const margin = r.limitO2 - r.targetO2
        const isOpen = open === r.id
        return (
          <div key={r.id} className={cn('rounded-sm', isOpen && 'bg-surface-2')} onMouseEnter={() => setHover(r.zone)}>
            <button type="button" onClick={() => toggle(r.id)} className="grid w-full grid-cols-[14px_1.6fr_1.2fr_0.8fr_70px_90px] items-center gap-2 px-1.5 py-0.5 text-left text-[11px] hover:bg-surface-2">
              <ChevronRight size={10} className={cn('text-faint transition', isOpen && 'rotate-90')} />
              <span className="truncate text-ink">{r.item}</span>
              <span className="truncate text-muted-foreground">{r.material}</span>
              <span className="truncate text-faint">{r.zone}</span>
              <StatusPill status={r.status} />
              <span className="text-right tnum" style={{ color: margin < 0 ? 'var(--bad)' : 'var(--ok)' }}>
                {margin >= 0 ? '+' : ''}
                {(margin * 100).toFixed(0)} pts
              </span>
            </button>
            {isOpen && (
              <div className="space-y-1.5 px-7 pb-2 text-[11px]">
                <div className="sans text-ink">{r.action}</div>
                <div className="text-faint">
                  limit O₂ ≈ {(r.limitO2 * 100).toFixed(0)} % vs cabin {(r.targetO2 * 100).toFixed(0)} % · 1 g screening (21 %): {r.test1} · qty {r.qty}
                </div>
                {r.cites && r.cites.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {r.cites.map((c) => (
                      <CiteChip key={c.id} id={c.id} note={c.note} />
                    ))}
                  </div>
                ) : (
                  <div className="text-faint">no citations (evidence step switched off)</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
