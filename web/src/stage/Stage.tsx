// 2 STAGE: the cabin from cabin.model.json with the sim layers on it, played through @remotion/player.
// Layers unlock as the agents produce them: materials (matrix), spread and pressure (@sim), what-if (@sim again).
import { Player, type PlayerRef } from '@remotion/player'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { stageRuns } from '@/demo/apollo1'
import { useSmokeStudy } from '@/lab/useSmokeStudy'
import { useMission, type Layer } from '@/live/store'
import { cn } from '@/lib/utils'
import { MATERIALS } from '@/sims/models'
import { FPS, StageComp, type StageLayer, type StageProps } from './StageComp'
import type { Variant } from './physics'

const LAYERS: { id: Layer; label: string; q: string; by: string }[] = [
  { id: 'materials', label: 'materials', q: 'What in here burns?', by: '@prevent' },
  { id: 'spread', label: 'spread', q: 'How fast does it take the cabin?', by: '@sim' },
  { id: 'pressure', label: 'pressure', q: 'Could the crew get out?', by: '@sim' },
  { id: 'smoke', label: 'smoke', q: 'Would the sensors see it, in µg, on the Moon and at 1 g?', by: '@detect' },
  { id: 'whatif', label: 'what-if', q: 'What would have changed it?', by: '@sim' },
]

const RANK = { pass: 0, retest: 1, fail: 2 } as const

function useSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 450 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(320, Math.round(e.contentRect.width))
      const h = Math.max(200, Math.round(e.contentRect.height))
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

export function Stage() {
  const pkg = useMission((s) => s.pkg)
  const cabin = useMission((s) => s.cabin)
  const matrix = useMission((s) => s.model.matrix)
  const sims = useMission((s) => s.model.sims)
  const layer = useMission((s) => s.layer)
  const setLayer = useMission((s) => s.setLayer)
  const variant = useMission((s) => s.variant)
  const setVariant = useMission((s) => s.setVariant)
  const stagePlay = useMission((s) => s.stagePlay)
  const hoverZone = useMission((s) => s.hoverZone)
  const setHoverZone = useMission((s) => s.setHoverZone)
  const [picked, setPicked] = useState<string>()
  const player = useRef<PlayerRef>(null)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [box, size] = useSize()
  const { study } = useSmokeStudy(pkg, cabin)
  const [smokeG, setSmokeG] = useState(pkg?.gravity.g ?? 1)
  const [smokeLayout, setSmokeLayout] = useState<'designed' | 'proposed'>('designed')

  const runs = useMemo(() => (pkg && cabin ? stageRuns(pkg, cabin) : []), [pkg, cabin])
  const has = (id: string) => sims.some((s) => s.id === id)
  const ready: Record<Layer, boolean> = { materials: matrix.length > 0, spread: has('cabin-spread'), pressure: has('cabin-pressure'), smoke: has('cabin-smoke') && !!study, whatif: has('cabin-whatif') }
  const shown: StageLayer = ready[layer] ? layer : 'none'
  const run = runs.find((r) => r.variant.id === (shown === 'whatif' ? variant : 'as-built')) ?? runs[0]

  const status = useMemo(() => {
    const out: Record<string, 'pass' | 'retest' | 'fail'> = {}
    for (const r of matrix) if (r.zone && (!out[r.zone] || RANK[r.status] > RANK[out[r.zone]])) out[r.zone] = r.status
    return out
  }, [matrix])

  useEffect(() => {
    const p = player.current
    if (!p) return
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    p.addEventListener('frameupdate', onFrame)
    p.addEventListener('play', onPlay)
    p.addEventListener('pause', onPause)
    p.addEventListener('ended', onPause)
    return () => {
      p.removeEventListener('frameupdate', onFrame)
      p.removeEventListener('play', onPlay)
      p.removeEventListener('pause', onPause)
      p.removeEventListener('ended', onPause)
    }
  }, [run])

  useEffect(() => {
    if (!stagePlay) return
    const t = setTimeout(() => {
      player.current?.seekTo(0)
      player.current?.play()
    }, 60)
    return () => clearTimeout(t)
  }, [stagePlay])

  if (!pkg || !cabin || !run) return null
  const duration = (shown === 'smoke' && study ? study.seconds : run.duration) * FPS
  const fire = shown === 'spread' || shown === 'pressure' || shown === 'whatif' || shown === 'smoke'
  const zoneInfo = picked ?? hoverZone
  const z = zoneInfo ? run.zones.find((x) => x.zone === zoneInfo) : undefined
  const props: StageProps = {
    model: cabin,
    run,
    layer: shown,
    status,
    highlight: zoneInfo,
    hatchTime: pkg.hatch?.openTime ?? 0,
    smoke: study ? { study, g: smokeG, layout: smokeLayout } : undefined,
    onPick: (zone) => {
      setPicked(zone)
      setHoverZone(undefined)
    },
  }
  const pctAt = (s?: number) => (s === undefined ? undefined : `${Math.min(100, (s / run.duration) * 100)}%`)

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 px-2 pb-1.5 text-label">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            type="button"
            disabled={!ready[l.id]}
            onClick={() => setLayer(l.id)}
            title={ready[l.id] ? l.q : `${l.q} · waiting for ${l.by}`}
            className={cn('whitespace-nowrap rounded-sm border px-2 py-0.5 transition', layer === l.id && ready[l.id] ? 'border-ug/70 bg-ug/10 text-ink' : 'border-line-2 text-muted-foreground hover:text-ink', !ready[l.id] && 'cursor-not-allowed opacity-35')}
          >
            {l.label}
          </button>
        ))}
        <span className="sans ml-2 truncate text-body text-muted-foreground">{shown === 'none' ? 'waiting for the agents' : LAYERS.find((l) => l.id === shown)?.q}</span>
        {shown === 'smoke' && study && (
          <span className="ml-auto flex items-center gap-1">
            {study.frames.map((c) => (
              <button key={c.gLabel} type="button" onClick={() => setSmokeG(c.g)} className={cn('whitespace-nowrap rounded-sm border px-1.5 py-0.5', smokeG === c.g ? 'border-ug/70 bg-ug/10 text-ink' : 'border-line-2 text-muted-foreground hover:text-ink')}>
                {c.gLabel}
              </button>
            ))}
            <span className="mx-1 text-faint">·</span>
            {(['designed', 'proposed'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setSmokeLayout(l)} className={cn('whitespace-nowrap rounded-sm border px-1.5 py-0.5', smokeLayout === l ? (l === 'proposed' ? 'border-ok/70 bg-ok/10 text-ok' : 'border-line-2 bg-surface-2 text-ink') : 'border-line-2 text-muted-foreground hover:text-ink')}>
                {l}
              </button>
            ))}
          </span>
        )}
        {shown === 'whatif' && (
          <span className="ml-auto flex items-center gap-1">
            {runs.map((r) => (
              <button
                key={r.variant.id}
                type="button"
                onClick={() => setVariant(r.variant.id as Variant['id'])}
                title={r.variant.label}
                className={cn('whitespace-nowrap rounded-sm border px-1.5 py-0.5', variant === r.variant.id ? 'border-k-ask/70 bg-k-ask/10 text-k-ask' : 'border-line-2 text-muted-foreground hover:text-ink')}
              >
                {r.variant.short}
              </button>
            ))}
          </span>
        )}
      </div>

      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden bg-viewport">
        <Player
          ref={player}
          component={StageComp}
          inputProps={props}
          durationInFrames={Math.max(FPS, duration)}
          fps={FPS}
          compositionWidth={size.w}
          compositionHeight={size.h}
          style={{ width: size.w, height: size.h }}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          acknowledgeRemotionLicense
        />
        {z && (
          <div className="absolute bottom-2 left-2 w-[250px] rounded-sm border border-line-2 bg-bg/90 p-2 text-body">
            <div className="flex items-center gap-2">
              <span className="lowercase text-ink">{z.zone}</span>
              {status[z.zone] && <span style={{ color: status[z.zone] === 'pass' ? 'var(--ok)' : status[z.zone] === 'retest' ? 'var(--warn)' : 'var(--bad)' }}>{status[z.zone]}</span>}
              <button type="button" className="ml-auto text-faint hover:text-ink" onClick={() => setPicked(undefined)}>
                ×
              </button>
            </div>
            {z.parts.length ? (
              z.parts.map((p) => (
                <div key={p.id} className="truncate text-muted-foreground">
                  {p.item} · {MATERIALS[p.material].label}
                </div>
              ))
            ) : (
              <div className="text-faint">nothing listed here</div>
            )}
            <div className="mt-1 text-faint">
              {z.burns ? `catches at T+${run.ignite[z.zone]?.toFixed(1) ?? '—'} s · front ${(z.speed * 100).toFixed(0)} cm/s` : 'does not burn here'}
            </div>
          </div>
        )}
        {shown === 'whatif' && (
          <div className="absolute right-2 top-2 rounded-sm border border-line-2 bg-bg/90 p-2 text-label">
            <div className="label mb-1">same cabin, four atmospheres</div>
            {runs.map((r) => (
              <button key={r.variant.id} type="button" onClick={() => setVariant(r.variant.id)} className={cn('flex w-full gap-3 text-left', variant === r.variant.id ? 'text-ink' : 'text-muted-foreground hover:text-ink')}>
                <span className="w-[58px]">{r.variant.short}</span>
                <span className="w-[84px]">{r.zones.filter((x) => x.burns && r.ignite[x.zone] !== null).length} zones burn</span>
                <span style={{ color: r.rupture !== undefined ? 'var(--bad)' : 'var(--ok)' }}>{r.rupture !== undefined ? `rupture T+${r.rupture.toFixed(0)} s` : 'no rupture'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={cn('flex shrink-0 items-center gap-2 px-2 pt-1.5 text-label', !fire && 'opacity-40')}>
        <button type="button" disabled={!fire} onClick={() => (playing ? player.current?.pause() : (frame >= duration - 1 && player.current?.seekTo(0), player.current?.play()))} className="text-ink hover:text-ug">
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button type="button" disabled={!fire} onClick={() => player.current?.seekTo(0)} className="text-faint hover:text-ink">
          <RotateCcw size={12} />
        </button>
        <span className="w-[44px] text-faint">T+0</span>
        <div className="relative h-4 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-px bg-line-2" />
          <div className="absolute left-0 top-1/2 h-px bg-flame" style={{ width: `${(frame / Math.max(1, duration - 1)) * 100}%` }} />
          {run.fullAt !== undefined && <span className="absolute top-0 h-4 w-px bg-k-ask" style={{ left: pctAt(run.fullAt) }} title="whole cabin burning" />}
          {run.rupture !== undefined && <span className="absolute top-0 h-4 w-px bg-bad" style={{ left: pctAt(run.rupture) }} title="hull rupture" />}
          <input
            type="range"
            min={0}
            max={duration - 1}
            value={frame}
            disabled={!fire}
            onChange={(e) => {
              player.current?.pause()
              player.current?.seekTo(Number(e.target.value))
            }}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          />
          <span className="pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame" style={{ left: `${(frame / Math.max(1, duration - 1)) * 100}%` }} />
        </div>
        <span className="w-[60px] text-right text-faint">T+{run.duration} s</span>
        <span className="text-faint">illustrative model</span>
      </div>
    </div>
  )
}
