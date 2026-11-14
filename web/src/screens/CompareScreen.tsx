// COMPARE: two cabins side by side. Pick the as-built case and a proposal (or any what-if) and read the same
// instruments for both: O₂ against what was ever tested, zones burning, time to rupture against the hatch,
// peak pressure against the hull, and (for the detector layouts) the worst first alarm.
import { useMemo, useState } from 'react'
import { RUN_COLOR } from '@/components/chart'
import { Gauge, OrbNote, Reading } from '@/components/Logo'
import { stageRuns } from '@/demo/apollo1'
import { useSmokeStudy } from '@/lab/useSmokeStudy'
import { useMission } from '@/live/store'
import type { FireRun } from '@/stage/physics'
import { cn } from '@/lib/utils'
import { useEvidenceRows } from './EvidenceScreen'
import { PressureChart } from './ReportScreen'

type Metric = {
  label: string
  /** 0..1 on the gauge. */
  value: number
  mark?: number
  reading: string
  unit?: string
  /** Lower is better for every metric here; used for the verdict column. */
  raw: number
  note: string
}

export function CompareScreen() {
  const pkg = useMission((s) => s.pkg)
  const cabin = useMission((s) => s.cabin)
  const loadExample = useMission((s) => s.loadExample)
  const { study } = useSmokeStudy(pkg, cabin)
  const evidence = useEvidenceRows()
  const runs = useMemo(() => (pkg && cabin ? stageRuns(pkg, cabin) : []), [pkg, cabin])
  const [a, setA] = useState('as-built')
  const [b, setB] = useState('proposal')

  if (!pkg || !cabin || !runs.length)
    return (
      <div className="flex flex-1 items-center justify-center">
        <OrbNote>
          Load a cabin to compare.{' '}
          <button type="button" onClick={() => void loadExample()} className="key ml-1 h-7 px-3 text-body">
            load the Apollo example
          </button>
        </OrbNote>
      </div>
    )

  const hatch = pkg.hatch?.openTime ?? 90
  const tested = Math.max(0, ...evidence.filter((e) => e.o2at === 'ambient').map((e) => e.o2))
  const left = runs.find((r) => r.variant.id === a) ?? runs[0]
  const right = runs.find((r) => r.variant.id === b) ?? runs[1] ?? runs[0]
  const alarmFor = (r: FireRun) => (r.variant.id === 'as-built' ? study?.worstDesigned : r.variant.id === 'proposal' ? study?.worstProposed : undefined)

  const metrics = (r: FireRun): Metric[] => {
    const burning = Object.values(r.ignite).filter((v) => v !== null).length
    const peak = Math.max(...r.pressure.map((p) => p.psia))
    const scale = r.burstPsia * 1.25
    const alarm = alarmFor(r)
    return [
      { label: 'cabin O₂', value: r.variant.o2, mark: tested || undefined, reading: `${Math.round(r.variant.o2 * 100)}`, unit: '%', raw: r.variant.o2, note: tested ? `tested up to ${Math.round(tested * 100)} %` : '' },
      { label: 'zones burning', value: burning / Math.max(1, r.zones.length), reading: `${burning}/${r.zones.length}`, raw: burning, note: r.fullAt !== undefined ? `whole cabin at T+${r.fullAt.toFixed(0)} s` : 'never fully involved' },
      {
        label: 'hull rupture',
        value: r.rupture === undefined ? 0 : Math.max(0.02, 1 - r.rupture / (hatch * 1.5)),
        mark: 1 - hatch / (hatch * 1.5),
        reading: r.rupture === undefined ? 'holds' : `T+${r.rupture.toFixed(0)}`,
        unit: r.rupture === undefined ? undefined : 's',
        raw: r.rupture === undefined ? 0 : 1 / Math.max(1, r.rupture),
        note: `hatch needs ${hatch} s`,
      },
      { label: 'peak pressure', value: peak / scale, mark: r.burstPsia / scale, reading: peak.toFixed(1), unit: 'psia', raw: peak, note: `hull bursts at ${r.burstPsia}` },
      {
        label: 'worst first alarm',
        value: alarm === undefined ? 0 : alarm === null ? 1 : Math.min(1, alarm / 60),
        mark: 0.5,
        reading: alarm === undefined ? '—' : alarm === null ? 'never' : alarm.toFixed(0),
        unit: alarm === undefined || alarm === null ? undefined : 's',
        raw: alarm === undefined ? Number.NaN : alarm === null ? 999 : alarm,
        note: alarm === undefined ? 'not studied for this case' : r.variant.id === 'proposal' ? 'proposed detector layout' : 'designed detector layout',
      },
    ]
  }
  const L = metrics(left)
  const R = metrics(right)

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-6 py-7">
        <div>
          <div className="label">compare</div>
          <h1 className="sans mt-1.5 text-display font-normal tracking-[-0.035em]">Same cabin, two answers.</h1>
          <p className="sans mt-1 max-w-[720px] text-body text-muted-foreground">
            Read the same instruments for two cases. Needles past a pink tick are past a limit: O₂ nobody has tested, a hull that bursts before the hatch opens, pressure over the hull rating, an alarm later than 30 s.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_160px_1fr] items-start gap-4">
          <Side runs={runs} pick={a} setPick={setA} other={b} />
          <div className="pt-[52px] text-center text-label text-faint">better</div>
          <Side runs={runs} pick={b} setPick={setB} other={a} />
        </div>

        <div className="flex flex-col gap-2">
          {L.map((l, i) => {
            const r = R[i]
            const tie = Number.isNaN(l.raw) || Number.isNaN(r.raw) || Math.abs(l.raw - r.raw) < 1e-6
            const winner = tie ? 0 : l.raw < r.raw ? -1 : 1
            return (
              <div key={l.label} className="grid grid-cols-[1fr_160px_1fr] items-stretch gap-4">
                <Cell m={l} win={winner === -1} />
                <div className="flex flex-col items-center justify-center gap-1">
                  <span className="text-body text-ink">{l.label}</span>
                  <span className={cn('text-label', winner ? 'text-you' : 'text-faint')}>{winner === -1 ? '← left' : winner === 1 ? 'right →' : 'same'}</span>
                </div>
                <Cell m={r} win={winner === 1} />
              </div>
            )
          })}
        </div>

        <div className="pane gap-2 p-3.5">
          <div className="pane-head text-body">
            <span className="font-medium text-ink">cabin pressure</span>
            <span className="text-faint">both cases · pink dashed: hull burst · grey dashed: hatch open</span>
          </div>
          <div className="lcd p-3">
            <PressureChart runs={[left, right]} hatch={hatch} h={170} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Side({ runs, pick, setPick, other }: { runs: FireRun[]; pick: string; setPick: (id: string) => void; other: string }) {
  const r = runs.find((x) => x.variant.id === pick) ?? runs[0]
  return (
    <div className="flex flex-col gap-2">
      <div className="slide flex-wrap text-body">
        {runs.map((x) => (
          <button key={x.variant.id} type="button" data-on={pick === x.variant.id} disabled={x.variant.id === other} onClick={() => setPick(x.variant.id)} className="normal-case disabled:opacity-35">
            {x.variant.short}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-body">
        <span className="h-3 w-[3px] rounded-full" style={{ background: RUN_COLOR[r.variant.id] }} />
        <span className="sans text-ink">{r.variant.label}</span>
      </div>
    </div>
  )
}

function Cell({ m, win }: { m: Metric; win: boolean }) {
  return (
    <div className={cn('pane flex-row items-center gap-3 px-3.5 py-3', win && 'you-card')}>
      <Gauge value={m.value} mark={m.mark} size={44} title={m.label} />
      <div className="min-w-0 flex-1">
        <Reading v={m.reading} u={m.unit} size={17} />
        <div className="mt-1 truncate text-label text-faint">{m.note}</div>
      </div>
    </div>
  )
}
