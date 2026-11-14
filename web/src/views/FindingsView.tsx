// 5 FINDINGS: the materials matrix. One line per part (status, O₂ margin); open a row for the action and its sources.
import { ChevronRight } from 'lucide-react'
import { CiteChip, StatusPill } from '@/components/bits'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'
import { OrbNote, Reading, heat } from '@/components/Logo'

export function FindingsView() {
  const rows = useMission((s) => s.model.matrix)
  const open = useMission((s) => s.openRow)
  const toggle = useMission((s) => s.toggleRow)
  const setHover = useMission((s) => s.setHoverZone)
  if (!rows.length) return <OrbNote>the materials matrix lands here when @prevent finishes.</OrbNote>
  return (
    <div className="scroll-thin h-full overflow-y-auto px-1" onMouseLeave={() => setHover(undefined)}>
      <div className="grid grid-cols-[22px_1.6fr_1.2fr_0.8fr_70px_90px] gap-2 px-1.5 pb-1 text-label lowercase text-faint">
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
            <button type="button" onClick={() => toggle(r.id)} className="grid w-full grid-cols-[22px_1.6fr_1.2fr_0.8fr_70px_90px] items-center gap-2 px-1.5 py-0.5 text-left text-body hover:bg-surface-2">
              <span className="flex items-center gap-1">
                <span className="h-3 w-[3px] rounded-full" style={{ background: heat(margin) }} />
                <ChevronRight size={10} className={cn('text-faint transition', isOpen && 'rotate-90')} />
              </span>
              <span className="truncate text-ink">{r.item}</span>
              <span className="truncate text-muted-foreground">{r.material}</span>
              <span className="truncate text-faint">{r.zone}</span>
              <StatusPill status={r.status} />
              <span className="flex justify-end">
                <Reading v={`${margin >= 0 ? '+' : ''}${(margin * 100).toFixed(0)}`} u="pts" color={heat(margin)} size={12} title={`limit ${(r.limitO2 * 100).toFixed(0)} % O₂ vs cabin ${(r.targetO2 * 100).toFixed(0)} %`} />
              </span>
            </button>
            {isOpen && (
              <div className="space-y-1.5 px-7 pb-2 text-body">
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
