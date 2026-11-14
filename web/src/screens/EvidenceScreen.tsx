// EVIDENCE: every test point the review can stand on (143 ACME Flame Design chamber points + 39 CFI-G test days),
// scored against this cabin. Filter, sort, open a row, pin it: pinned rows land in the report's evidence section.
import { Pin, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { loadTestpoints } from '@/data/acme'
import { buildEvidence, match, type EvidenceRow } from '@/data/evidence'
import { PSI_KPA, targetOf, type Target } from '@/data/library'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

let cache: Promise<EvidenceRow[]> | undefined
export function useEvidenceRows() {
  const [rows, setRows] = useState<EvidenceRow[]>([])
  useEffect(() => {
    let on = true
    cache ??= loadTestpoints().then(buildEvidence)
    void cache.then((r) => on && setRows(r))
    return () => {
      on = false
    }
  }, [])
  return rows
}

const pct = (v: number) => `${Math.round(v * 100)} %`
type Sort = 'match' | 'o2' | 'psia' | 'date'

export function EvidenceScreen() {
  const pkg = useMission((s) => s.pkg)
  const pins = useMission((s) => s.pins)
  const togglePin = useMission((s) => s.togglePin)
  const rows = useEvidenceRows()
  const target = targetOf(pkg?.atmosphere.o2 ?? 1, pkg?.atmosphere.psi ?? 16.7)
  const [src, setSrc] = useState<'all' | EvidenceRow['src']>('all')
  const [ign, setIgn] = useState<'all' | 0 | 1>('all')
  const [ambient, setAmbient] = useState(true)
  const [qtext, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('match')
  const [sel, setSel] = useState<string>()
  const list = useMemo(() => {
    const out = rows
      .map((e) => ({ e, m: match(e, target) }))
      .filter(({ e }) => (src === 'all' || e.src === src) && (ign === 'all' || e.ign === ign) && (!ambient || e.o2at === 'ambient') && `${e.id} ${e.fuel} ${e.ref} ${e.date}`.toLowerCase().includes(qtext.toLowerCase()))
    const key: Record<Sort, (x: { e: EvidenceRow; m: number }) => number | string> = { match: (x) => -x.m, o2: (x) => -x.e.o2, psia: (x) => -x.e.psia, date: (x) => x.e.date }
    return out.sort((a, b) => (key[sort](a) < key[sort](b) ? -1 : key[sort](a) > key[sort](b) ? 1 : 0))
  }, [rows, src, ign, ambient, qtext, sort, target.o2, target.kpa]) // eslint-disable-line react-hooks/exhaustive-deps
  const s = rows.find((e) => e.id === sel)
  const maxO2 = Math.max(0, ...rows.filter((e) => e.o2at === 'ambient').map((e) => e.o2))

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col px-6 py-5">
        <div className="label text-ug">evidence explorer</div>
        <h1 className="sans mt-1 text-[22px] font-semibold text-ink">{rows.length} test points behind the verdict</h1>
        <div className="mt-1 text-[11.5px] text-muted-foreground">
          Real ACME Flame Design chamber log (PSI-10) and CFI-G test days (PSI-159). Match = how close the test atmosphere is to this cabin ({pct(target.o2)} O₂ · {(target.kpa / PSI_KPA).toFixed(1)} psia). The highest ambient O₂ ever tested here is <span className="text-warn">{pct(maxO2)}</span>: the cabin sits outside the evidence.
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          {(['all', 'Flame Design', 'CFI-G'] as const).map((v) => (
            <Chip key={v} on={src === v} onClick={() => setSrc(v)}>
              {v}
            </Chip>
          ))}
          <span className="mx-1 text-line-2">|</span>
          {(['all', 1, 0] as const).map((v) => (
            <Chip key={String(v)} on={ign === v} onClick={() => setIgn(v)}>
              {v === 'all' ? 'any outcome' : v ? 'ignited' : 'no ignition'}
            </Chip>
          ))}
          <span className="mx-1 text-line-2">|</span>
          <Chip on={ambient} onClick={() => setAmbient((a) => !a)}>
            ambient O₂ only
          </Chip>
          <span className="ml-3 text-faint">sort</span>
          {(['match', 'o2', 'psia', 'date'] as const).map((v) => (
            <Chip key={v} on={sort === v} onClick={() => setSort(v)}>
              {v}
            </Chip>
          ))}
          <label className="ml-auto flex items-center gap-1.5 rounded-sm border border-line-2 px-2 py-0.5">
            <Search size={11} className="text-faint" />
            <input value={qtext} onChange={(e) => setQ(e.target.value)} placeholder="id, fuel, date" className="w-36 bg-transparent text-ink outline-none placeholder:text-faint" />
          </label>
        </div>
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-[1fr_340px] gap-4">
          <div className="scroll-thin min-h-0 overflow-y-auto">
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 bg-background text-left text-faint">
                <tr className="border-b border-line">
                  <th className="py-1 font-normal">test</th>
                  <th className="font-normal">source</th>
                  <th className="font-normal">date</th>
                  <th className="font-normal">fuel</th>
                  <th className="font-normal">O₂</th>
                  <th className="font-normal">psia</th>
                  <th className="font-normal">outcome</th>
                  <th className="w-[110px] font-normal">match</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map(({ e, m }) => (
                  <tr key={e.id} onClick={() => setSel(e.id)} className={cn('cursor-pointer border-b border-line/50 hover:bg-surface-2', sel === e.id && 'bg-surface-2')}>
                    <td className="py-1 text-ink">{e.id}</td>
                    <td className="text-muted-foreground">{e.src}</td>
                    <td className="text-faint">{e.date}</td>
                    <td className="text-muted-foreground">{e.fuel}</td>
                    <td className="tnum">
                      {pct(e.o2)} <span className="text-faint">{e.o2at === 'burner' ? 'burner' : ''}</span>
                    </td>
                    <td className="tnum">{e.psia}</td>
                    <td className={e.ign ? 'text-flame' : 'text-faint'}>{e.ign ? 'ignited' : 'none'}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 flex-1 rounded bg-surface-3">
                          <div className="h-full rounded bg-ug" style={{ width: `${Math.max(2, m * 100)}%` }} />
                        </div>
                        <span className="w-9 text-right text-faint tnum">{m < 0.01 ? '<.01' : m.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="pl-2">
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          togglePin(e.id)
                        }}
                        title={pins.includes(e.id) ? 'unpin from the report' : 'pin to the report'}
                        className={pins.includes(e.id) ? 'text-k-ask' : 'text-faint hover:text-ink'}
                      >
                        <Pin size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="scroll-thin min-h-0 space-y-3 overflow-y-auto">
            <div className="rounded-sm border border-line bg-viewport p-2">
              <TestpointScatter rows={list.map((x) => x.e)} target={target} selected={sel} onPick={setSel} h={240} />
              <div className="mt-1 text-[10px] text-faint">x: O₂ · y: pressure (log) · orange ignited · grey none · white cross = this cabin</div>
            </div>
            {s ? (
              <div className="space-y-1.5 rounded-sm border border-line-2 bg-surface-2 p-3 text-[11.5px]">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-ink">{s.id}</span>
                  <span className="text-faint">{s.src}</span>
                  <button type="button" onClick={() => togglePin(s.id)} className={cn('ml-auto flex items-center gap-1 rounded-sm border px-1.5 py-0.5', pins.includes(s.id) ? 'border-k-ask/60 text-k-ask' : 'border-line-2 text-muted-foreground hover:text-ink')}>
                    <Pin size={10} /> {pins.includes(s.id) ? 'pinned to report' : 'pin to report'}
                  </button>
                </div>
                {(
                  [
                    ['date', s.date],
                    ['configuration', s.cfg],
                    ['fuel', s.fuel],
                    ['O₂', `${pct(s.o2)} (${s.o2at})`],
                    ['pressure', `${s.psia} psia · ${(s.psia * PSI_KPA).toFixed(0)} kPa`],
                    ['outcome', s.ign ? 'ignited' : 'no ignition'],
                    ['reference', s.ref],
                    ['file', s.file],
                    ['values', s.nominal ? 'nominal (final report table)' : 'measured (chamber log)'],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <span className="w-24 shrink-0 text-faint">{k}</span>
                    <span className="text-ink">{v}</span>
                  </div>
                ))}
                <div className="pt-1 text-muted-foreground">
                  match to this cabin <span className="text-ug">{match(s, target).toFixed(3)}</span>
                  {s.o2 < target.o2 - 0.2 && <span className="text-warn"> · {pct(target.o2 - s.o2)} less O₂ than the cabin</span>}
                </div>
              </div>
            ) : (
              <div className="text-[11.5px] text-faint">Pick a row or a point.</div>
            )}
            <div className="text-[11px] text-muted-foreground">
              {pins.length} pinned · they appear in the report under §3
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-sm border px-2 py-0.5', on ? 'border-ug/60 bg-ug/10 text-ink' : 'border-line-2 text-muted-foreground hover:text-ink')}>
      {children}
    </button>
  )
}

/** O₂ (x) against pressure (y, log), ignited in orange; the cabin as a white cross. */
export function TestpointScatter({ rows, target, selected, onPick, h = 200 }: { rows: EvidenceRow[]; target: Target; selected?: string; onPick?: (id: string) => void; h?: number }) {
  const W = 320
  const pad = 22
  const p0 = Math.log(4)
  const p1 = Math.log(50)
  const X = (o2: number) => pad + o2 * (W - pad - 6)
  const Y = (psia: number) => h - pad - ((Math.log(psia) - p0) / (p1 - p0)) * (h - pad - 6)
  const tp = target.kpa / PSI_KPA
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full">
      {[0, 0.21, 0.4, 0.6, 0.85, 1].map((o) => (
        <g key={o}>
          <line x1={X(o)} x2={X(o)} y1={6} y2={h - pad} stroke="#1b2430" />
          <text x={X(o)} y={h - 8} fill="#4a5665" fontSize={8} textAnchor="middle">
            {Math.round(o * 100)}%
          </text>
        </g>
      ))}
      {[5, 10, 14.7, 30, 44].map((p) => (
        <g key={p}>
          <line x1={pad} x2={W - 6} y1={Y(p)} y2={Y(p)} stroke="#1b2430" />
          <text x={pad - 3} y={Y(p) + 3} fill="#4a5665" fontSize={8} textAnchor="end">
            {p}
          </text>
        </g>
      ))}
      {rows.map((e) => (
        <circle
          key={e.id}
          cx={X(e.o2)}
          cy={Y(e.psia)}
          r={selected === e.id ? 4.5 : 2.6}
          fill={e.ign ? '#ff7a3d' : '#4a5665'}
          fillOpacity={e.o2at === 'burner' ? 0.35 : 0.85}
          stroke={selected === e.id ? '#e6edf3' : 'none'}
          onClick={() => onPick?.(e.id)}
          className={onPick ? 'cursor-pointer' : undefined}
        >
          <title>{`${e.id} · ${Math.round(e.o2 * 100)} % O₂ · ${e.psia} psia`}</title>
        </circle>
      ))}
      <g stroke="#e6edf3" strokeWidth={1.6}>
        <line x1={X(target.o2) - 6} x2={X(target.o2) + 6} y1={Y(tp)} y2={Y(tp)} />
        <line x1={X(target.o2)} x2={X(target.o2)} y1={Y(tp) - 6} y2={Y(tp) + 6} />
      </g>
      <text x={X(target.o2) - 8} y={Y(tp) - 8} fill="#e6edf3" fontSize={8.5} textAnchor="end">
        this cabin
      </text>
    </svg>
  )
}
