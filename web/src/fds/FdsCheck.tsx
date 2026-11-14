// The report's "FDS check": real FDS pressure (1 g and µg) beside the quick model's, and the detector times.
import { useEffect, useState } from 'react'
import { useMission } from '@/live/store'
import type { FireRun } from '@/stage/physics'
import { TimeChart } from './charts'
import { loadRun, type FdsRun } from './load'
import { FDS_MANIFEST, fdsCase } from './manifest'
import { PA_PER_PSI } from './summary'

function useRuns() {
  const [runs, setRuns] = useState<{ g1?: FdsRun; ug?: FdsRun }>({})
  useEffect(() => {
    const a = fdsCase('1g'), b = fdsCase('ug')
    if (a && b) void Promise.all([loadRun(a.id, a.chid), loadRun(b.id, b.chid)]).then(([g1, ug]) => setRuns({ g1, ug }), () => undefined)
  }, [])
  return runs
}

export function FdsPressureCheck({ quick, h = 140 }: { quick?: FireRun; h?: number }) {
  const { g1, ug } = useRuns()
  const burst = quick?.burstPsia ?? 29
  if (!g1 || !ug) return <div className="text-[10.5px] text-faint">loading the FDS run…</div>
  const p = (r: FdsRun) => r.devc.cols.P_cabin.map((v) => v / PA_PER_PSI)
  return (
    <TimeChart
      h={h}
      yMin={14}
      yMax={Math.max(31, burst + 2)}
      yLabel="psia"
      markers={[{ y: burst, label: `hull burst ${burst} psia`, color: '#ff6b6b' }]}
      series={[
        { label: 'FDS 1 g', t: g1.devc.cols.Time, y: p(g1), color: '#ffb547', width: 1.8 },
        { label: 'FDS µg', t: ug.devc.cols.Time, y: p(ug), color: '#5aa9ff' },
        ...(quick ? [{ label: 'quick model 1 g', t: quick.pressure.filter((x) => x.t <= 30).map((x) => x.t), y: quick.pressure.filter((x) => x.t <= 30).map((x) => x.psia), color: '#7d8a99', width: 1 }] : []),
      ]}
    />
  )
}

export function FdsCheckBlock({ quick, lines }: { quick?: FireRun; lines: string[] }) {
  const setView = useMission((s) => s.setView)
  return (
    <div className="rounded-sm border border-line bg-viewport p-3">
      <div className="mb-1 flex items-center gap-2 text-[11px]">
        <span className="label text-ug">FDS check</span>
        <span className="text-faint">{FDS_MANIFEST.fds}</span>
        <button type="button" onClick={() => setView('fds')} className="ml-auto text-ug hover:underline">
          open in FDS →
        </button>
      </div>
      <FdsPressureCheck quick={quick} />
      <ul className="mt-2 space-y-1 text-[11.5px] leading-snug text-muted-foreground">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}
