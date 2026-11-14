// Lab tile for the FDS job: the real temperature slice through the cabin (FDS y = 0), advancing with the job.
import { useEffect, useRef, useState } from 'react'
import type { Job } from '@/live/types'
import { heat } from './FdsScene'
import { loadRun, type FdsRun } from './load'
import { fdsCase } from './manifest'
import { PA_PER_PSI } from './summary'

export function FdsTile({ job }: { job: Job }) {
  const c = fdsCase('1g')
  const [run, setRun] = useState<FdsRun>()
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (c) void loadRun(c.id, c.chid).then(setRun, () => undefined)
  }, [c])
  const slice = run?.slices.find((s) => s.quantity === 'TEMPERATURE' && s.dims[1] === 1)
  const n = slice ? Math.min(slice.frames.length - 1, Math.floor((job.done ? 1 : job.progress) * (slice.frames.length - 1))) : 0
  const t = slice?.times[n] ?? 0
  useEffect(() => {
    const cv = ref.current
    if (!cv || !slice) return
    const [nx, , nz] = slice.dims
    cv.width = nx
    cv.height = nz
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(nx, nz)
    const f = slice.frames[n]
    for (let k = 0; k < nz; k++)
      for (let i = 0; i < nx; i++) {
        const v = (f[i + nx * k] - 20) / 880
        const [r, g, b] = heat(v)
        const o = (i + nx * (nz - 1 - k)) * 4
        img.data.set([r, g, b, 255], o)
      }
    ctx.putImageData(img, 0, 0)
  }, [slice, n])
  const at = (tt: number[], y: number[] | undefined) => {
    if (!y) return 0
    let i = 0
    while (i < tt.length - 1 && tt[i + 1] <= t) i++
    return y[i]
  }
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="text-[9.5px] text-muted-foreground">NIST FDS 6.11 · {c?.cells.toLocaleString()} cells · temperature at the cabin mid-plane · 1 g</div>
      <div className="relative min-h-0 flex-1">
        {slice ? <canvas ref={ref} className="h-full w-full object-contain" style={{ imageRendering: 'pixelated' }} /> : <div className="flex h-full items-center justify-center text-[10.5px] text-faint">loading FDS output…</div>}
        {run && (
          <div className="pointer-events-none absolute left-1 top-1 flex gap-2 text-[9px]">
            <span className="bg-bg/70 px-0.5 text-muted-foreground">
              T+<span className="text-ink">{t.toFixed(1)} s</span>
            </span>
            <span className="bg-bg/70 px-0.5 text-muted-foreground">
              HRR <span className="text-flame">{at(run.hrr.cols.Time, run.hrr.cols.HRR).toFixed(0)} kW</span>
            </span>
            <span className="bg-bg/70 px-0.5 text-muted-foreground">
              P <span className="text-ink">{(at(run.devc.cols.Time, run.devc.cols.P_cabin) / PA_PER_PSI).toFixed(1)} psia</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
