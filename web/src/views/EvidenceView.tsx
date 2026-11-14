import { ArrowLeft, Cloud, Droplet, ExternalLink, Flame, Layers, Sigma, Wind } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { BY_ID, INVESTIGATIONS, PILLAR_COLOR, PSI_FETCHED_AT, type FuelType, type Investigation } from '@/data/psi'
import { useMission } from '@/live/store'
import type { Ranked } from '@/live/types'
import { cn } from '@/lib/utils'

export const FUEL_ICON: Record<FuelType, typeof Flame> = { solid: Layers, gas: Flame, droplet: Droplet, smoke: Cloud, aerosol: Wind, model: Sigma }

type Tab = 'ranked' | 'compare' | 'coverage'

export function EvidenceView() {
  const ranking = useMission((s) => s.model.ranking)
  const focusIds = useMission((s) => s.model.focusIds)
  const selected = useMission((s) => s.selectedInv)
  const selectInv = useMission((s) => s.selectInv)
  const [tab, setTab] = useState<Tab>('ranked')

  const rows: (Ranked & { inv: Investigation })[] = useMemo(() => {
    const scored = ranking.length
      ? ranking.filter((r) => BY_ID[r.id])
      : INVESTIGATIONS.map((i) => ({ id: i.id, score: i.c.base, pillar: i.c.pillars[0], why: i.c.finding ?? '' }))
    const seen = new Set(scored.map((r) => r.id))
    const rest = INVESTIGATIONS.filter((i) => !seen.has(i.id)).map((i) => ({ id: i.id, score: i.c.base * 0.6, pillar: i.c.pillars[0], why: i.c.finding ?? '' }))
    return [...scored, ...rest].sort((a, b) => b.score - a.score).map((r) => ({ ...r, inv: BY_ID[r.id] }))
  }, [ranking])

  if (selected && BY_ID[selected]) return <Detail inv={BY_ID[selected]} rank={rows.find((r) => r.id === selected)} onBack={() => selectInv(undefined)} />

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        {(['ranked', 'compare', 'coverage'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn('rounded px-2 py-0.5 text-[12px] capitalize', tab === t ? 'bg-surface-3 text-ink' : 'text-muted-foreground hover:text-ink')}>
            {t}
          </button>
        ))}
        <span className="mono ml-auto text-[9.5px] text-faint">
          {ranking.length ? 'ranked by Research' : 'base relevance'} · PSI snapshot {PSI_FETCHED_AT.slice(0, 10)}
        </span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        {tab === 'ranked' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2 p-2">
            {rows.map((r, i) => (
              <RankCard key={r.id} r={r} i={i} focus={focusIds.includes(r.id)} onOpen={() => selectInv(r.id)} />
            ))}
          </div>
        )}
        {tab === 'compare' && <Compare rows={rows.slice(0, 12)} onOpen={selectInv} />}
        {tab === 'coverage' && <Coverage />}
      </div>
    </div>
  )
}

function RankCard({ r, i, focus, onOpen }: { r: Ranked & { inv: Investigation }; i: number; focus: boolean; onOpen: () => void }) {
  const Icon = FUEL_ICON[r.inv.c.fuel]
  return (
    <motion.button
      layout
      type="button"
      onClick={onOpen}
      className={cn('flex flex-col gap-1.5 rounded-lg border bg-surface-2/70 p-2.5 text-left transition hover:border-line-2', focus ? 'border-ug/50 ring-1 ring-ug/40' : 'border-line')}
    >
      <div className="flex items-center gap-2">
        <span className="mono text-[10px] text-faint">#{i + 1}</span>
        <span className="flex size-6 items-center justify-center rounded-md" style={{ background: `color-mix(in oklab, ${PILLAR_COLOR[r.pillar]} 16%, transparent)`, color: PILLAR_COLOR[r.pillar] }}>
          <Icon size={13} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight">{r.inv.c.short}</div>
          <div className="mono text-[9.5px] text-faint">{r.id}</div>
        </div>
        <span className="mono ml-auto text-[12px]" style={{ color: PILLAR_COLOR[r.pillar] }}>
          {Math.round(r.score * 100)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded bg-surface-3">
        <motion.div className="h-full" style={{ background: PILLAR_COLOR[r.pillar] }} initial={{ width: 0 }} animate={{ width: `${r.score * 100}%` }} />
      </div>
      <div className="line-clamp-3 text-[11.5px] leading-snug text-muted-foreground">{r.why}</div>
      <div className="flex flex-wrap gap-1">
        {r.inv.c.pillars.map((p) => (
          <span key={p} className="mono rounded px-1 text-[9px]" style={{ color: PILLAR_COLOR[p], background: `color-mix(in oklab, ${PILLAR_COLOR[p]} 12%, transparent)` }}>
            {p}
          </span>
        ))}
        <span className="mono truncate text-[9px] text-faint">{r.inv.c.platform}</span>
      </div>
    </motion.button>
  )
}

function Compare({ rows, onOpen }: { rows: (Ranked & { inv: Investigation })[]; onOpen: (id: string) => void }) {
  const cols: { k: string; get: (i: Investigation) => string | undefined }[] = [
    { k: 'Fuel / samples', get: (i) => i.c.samples ?? i.c.fuel },
    { k: 'Platform', get: (i) => i.c.platform },
    { k: 'O₂', get: (i) => i.c.o2 },
    { k: 'Pressure', get: (i) => i.c.pressure },
    { k: 'Flow', get: (i) => i.c.flow },
    { k: 'Sensors', get: (i) => i.c.sensors },
    { k: 'Key finding', get: (i) => i.c.finding },
  ]
  return (
    <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
      <thead className="sticky top-0 bg-surface">
        <tr>
          <th className="mono border-b border-line px-2 py-1.5 text-[10px] font-normal uppercase tracking-wider text-faint">Investigation</th>
          {cols.map((c) => (
            <th key={c.k} className="mono border-b border-line px-2 py-1.5 text-[10px] font-normal uppercase tracking-wider text-faint">
              {c.k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="cursor-pointer align-top hover:bg-surface-2/60" onClick={() => onOpen(r.id)}>
            <td className="border-b border-line px-2 py-1.5">
              <div className="font-semibold" style={{ color: PILLAR_COLOR[r.pillar] }}>
                {r.inv.c.short}
              </div>
              <div className="mono text-[9.5px] text-faint">{r.id}</div>
            </td>
            {cols.map((c) => (
              <td key={c.k} className="border-b border-line px-2 py-1.5 text-muted-foreground">
                {c.get(r.inv) ?? <span className="text-faint">— in dataset</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Where the evidence sits: gravity × atmosphere. All PSI flight data is µg; Moon/Mars columns are empty. */
function Coverage() {
  const g = [
    { id: 'ug', label: 'µg · spacecraft', sub: 'Orion · Gateway · ISS · transit' },
    { id: 'moon', label: '0.165 g · Moon', sub: 'Base camp · pressurized rover' },
    { id: 'mars', label: '0.38 g · Mars', sub: 'Surface habitat' },
    { id: 'earth', label: '1 g · ground', sub: 'NASA-STD-6001 tests' },
  ]
  const atm = [
    { id: '21', label: '21 % · 14.7 psia', sub: 'ISS / Orion' },
    { id: '26', label: '26.5 % · 10.2 psia', sub: 'Intermediate' },
    { id: '34', label: '34 % · 8.2 psia', sub: 'Exploration (EAWG)' },
    { id: 'hi', label: '> 34 % O₂', sub: 'O₂-enriched / suit' },
  ]
  const cells: Record<string, string[]> = {
    'ug-21': ['PSI-98', 'PSI-99', 'PSI-100', 'PSI-26', 'PSI-25', 'PSI-102', 'PSI-101', 'PSI-69', 'PSI-68', 'PSI-39', 'PSI-107'],
    'ug-26': ['PSI-20'],
    'ug-34': ['PSI-20'],
    'ug-hi': ['PSI-159'],
    'earth-21': ['NASA-STD-6001'],
    'earth-34': ['20-ft chamber'],
    'moon-21': ['PSI-22*'],
  }
  return (
    <div className="p-3">
      <div className="mb-2 text-[12px] text-muted-foreground">
        Spacecraft is where the data is. <span className="text-flame">Base camp is where the danger is.</span> Partial-gravity cells are bounded by µg and 1 g until LUCI / FM2 fly.
      </div>
      <div className="grid grid-cols-[120px_repeat(4,1fr)] gap-1">
        <div />
        {atm.map((a) => (
          <div key={a.id} className="px-1 pb-1">
            <div className="mono text-[10.5px] text-ink">{a.label}</div>
            <div className="text-[9.5px] text-faint">{a.sub}</div>
          </div>
        ))}
        {g.map((row) => (
          <div key={row.id} className="contents">
            <div className="flex flex-col justify-center pr-1">
              <div className="mono text-[10.5px] text-ink">{row.label}</div>
              <div className="text-[9.5px] text-faint">{row.sub}</div>
            </div>
            {atm.map((a) => {
              const ids = cells[`${row.id}-${a.id}`] ?? []
              const partial = row.id === 'moon' || row.id === 'mars'
              const danger = partial && (a.id === '34' || a.id === '26')
              return (
                <div
                  key={a.id}
                  className={cn(
                    'min-h-[58px] rounded-md border p-1.5',
                    ids.length ? 'border-ug/30 bg-ug/5' : danger ? 'border-flame/50 bg-flame/10' : 'border-dashed border-line-2 bg-surface/40',
                  )}
                >
                  {ids.length ? (
                    <div className="flex flex-wrap gap-0.5">
                      {ids.map((id) => (
                        <span key={id} className="mono rounded bg-surface-3 px-1 text-[9px] text-ug">
                          {BY_ID[id]?.c.short ?? id}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className={cn('mono text-[9.5px]', danger ? 'text-flame' : 'text-faint')}>{danger ? 'NO DATA · target zone' : 'no data'}</div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-faint">* E-FIELD mimics buoyancy with an electric field — the only partial-g proxy in PSI.</div>
    </div>
  )
}

function Detail({ inv, rank, onBack }: { inv: Investigation; rank?: Ranked; onBack: () => void }) {
  const Icon = FUEL_ICON[inv.c.fuel]
  const sections: [string, string | null][] = [
    ['Objectives', inv.objectives],
    ['Hypothesis', inv.hypothesis],
    ['Approach', inv.approach],
    ['Impacts · Earth benefits', inv.impacts],
  ]
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
        <button type="button" onClick={onBack} className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-ink">
          <ArrowLeft size={14} />
        </button>
        <Icon size={14} style={{ color: PILLAR_COLOR[inv.c.pillars[0]] }} />
        <span className="text-[13px] font-semibold">{inv.c.short}</span>
        <span className="mono text-[10px] text-faint">{inv.id}</span>
        <a href={inv.url} target="_blank" rel="noreferrer" className="mono ml-auto flex items-center gap-1 text-[10px] text-ug hover:underline">
          PSI <ExternalLink size={10} />
        </a>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        <div className="text-[14px] font-semibold leading-snug">{inv.title}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {inv.investigators.slice(0, 6).join(' · ')} · {inv.platform ?? inv.c.platform} · {inv.start?.slice(-4)}–{inv.end?.slice(-4)}
        </div>
        {rank?.why && <div className="mt-2 rounded-md border border-ug/30 bg-ug/5 px-2 py-1.5 text-[12px]">{rank.why}</div>}
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
          {(
            [
              ['Samples', inv.c.samples],
              ['O₂', inv.c.o2],
              ['Pressure', inv.c.pressure],
              ['Flow', inv.c.flow],
              ['Sensors', inv.c.sensors],
              ['Hardware', inv.hardware.map((h) => h.name).join(' · ')],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-md bg-surface-2 px-2 py-1">
              <div className="mono text-[9px] uppercase tracking-wider text-faint">{k}</div>
              <div className="text-muted-foreground">{v || '— in team dataset'}</div>
            </div>
          ))}
        </div>
        {inv.c.finding && (
          <div className="mt-3">
            <div className="mono text-[9.5px] uppercase tracking-widest text-faint">Key finding</div>
            <div className="text-[12.5px] leading-snug">{inv.c.finding}</div>
            {inv.c.source && (
              <a href={inv.c.source.url} target="_blank" rel="noreferrer" className="mono text-[10px] text-ug hover:underline">
                {inv.c.source.label}
              </a>
            )}
          </div>
        )}
        {sections.map(([k, v]) =>
          v ? (
            <div key={k} className="mt-3">
              <div className="mono text-[9.5px] uppercase tracking-widest text-faint">{k}</div>
              <div className="whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">{v}</div>
            </div>
          ) : null,
        )}
        {inv.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {inv.keywords.map((k) => (
              <span key={k} className="mono rounded bg-surface-3 px-1.5 text-[9.5px] text-muted-foreground">
                {k}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
