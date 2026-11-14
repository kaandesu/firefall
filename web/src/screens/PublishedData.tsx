// PUBLISHED DATA: the numbers we took from NASA's own papers (src/data/published/*.json), each row with where in the
// paper it came from and how it was read, plus the least-squares fit of our simple model to those rows.
import bass from '@/data/published/bass.json'
import flex from '@/data/published/flex.json'
import saffire from '@/data/published/saffire.json'
import { FITS, type Fit } from '@/sims/fits'

type Ref = { cite: string; ntrs?: string; url?: string }
type Row = { id: string; text: string; where: string; how: string; ref: string }
export type PublishedSet = { key: 'bass' | 'saffire' | 'flex'; source: string; refs: Record<string, Ref>; rows: Row[]; notes: string[]; fit: Fit }

const n = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '—' : v.toFixed(d))

export const PUBLISHED: Record<PublishedSet['key'], PublishedSet> = {
  bass: {
    key: 'bass',
    source: bass.source,
    refs: bass.refs,
    rows: bass.rows.map((r) => ({ id: r.id, text: `${r.fuel}: ${r.quantity} ${r.value} ${r.unit}${r.flow ? ` · ${r.flow} cm/s` : ''} · ${r.g} g`, where: r.where, how: r.how, ref: r.ref })),
    notes: [],
    fit: FITS.limitingO2,
  },
  saffire: {
    key: 'saffire',
    source: saffire.source,
    refs: saffire.refs,
    rows: saffire.rows.map((r) => ({
      id: r.id,
      text: `${r.fuel} · ${Math.round(r.o2 * 100)} % O₂ · ${r.kpa} kPa · burned ${r.burn_s} s · avg ${n(r.avg_w === null ? null : r.avg_w / 1000, 1)} kW · ${r.total_kj} kJ · CO ${r.co_ppm} ppm`,
      where: r.where,
      how: r.how,
      ref: r.ref,
    })),
    notes: saffire.notes,
    fit: FITS.spread,
  },
  flex: {
    key: 'flex',
    source: flex.source,
    refs: flex.refs,
    rows: flex.rows.map((r) => ({ id: r.id, text: `${r.fuel}${r.diluent ? ` / ${r.diluent}` : ''} · ${r.o2 !== undefined && r.o2 !== null ? `${Math.round(r.o2 * 100)} % O₂ · ` : ''}${r.quantity} ${r.value} ${r.unit}`, where: r.where, how: r.how, ref: r.ref })),
    notes: [],
    fit: FITS.droplet,
  },
}

export function publishedFor(studyId: string): PublishedSet | undefined {
  if (studyId.startsWith('bass')) return PUBLISHED.bass
  if (studyId.startsWith('saffire')) return PUBLISHED.saffire
  if (studyId.startsWith('flex')) return PUBLISHED.flex
  return undefined
}

/** Observed vs model vs fit, one row per point, with a dot strip. */
export function FitCard({ fit }: { fit: Fit }) {
  const all = fit.points.flatMap((p) => [p.observed, p.model, p.fit])
  const lo = Math.min(...all) * 0.9, hi = Math.max(...all) * 1.05
  const X = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`
  return (
    <div className="rounded-sm border border-line bg-surface-2 px-3 py-2">
      <div className="label">fit · {fit.name}</div>
      <div className="sans mt-0.5 text-[11px] text-muted-foreground">{fit.what}</div>
      <div className="mt-2 space-y-1.5">
        {fit.points.map((p) => (
          <div key={p.id} className="text-[10.5px]">
            <div className="flex gap-2">
              <span className="w-16 text-ink">{p.id}</span>
              <span className="flex-1 truncate text-faint">{p.x}</span>
              <span className="tnum text-ink">{n(p.observed, 3)}</span>
              <span className="tnum text-warn">{n(p.model, 3)}</span>
              <span className="tnum text-ok">{n(p.fit, 3)}</span>
            </div>
            <div className="relative mt-0.5 h-2 rounded bg-surface-3">
              <span className="absolute top-0 h-2 w-0.5 bg-ink" style={{ left: X(p.observed) }} />
              <span className="absolute top-0.5 h-1 w-1 rounded-full bg-warn" style={{ left: X(p.model) }} />
              <span className="absolute top-0.5 h-1 w-1 rounded-full bg-ok" style={{ left: X(p.fit) }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-[10.5px]">
        <span className="text-ink">| observed</span>
        <span className="text-warn">● our model · rms {n(fit.rmsModel, 3)}</span>
        <span className="text-ok">● fitted · rms {n(fit.rmsFit, 3)}</span>
      </div>
      <div className="mt-1 text-[10.5px] text-muted-foreground">
        fitted: {Object.entries(fit.params).filter(([k]) => !k.startsWith('model')).map(([k, v]) => `${k} ${n(v, 3)}`).join(' · ')}
        {Object.keys(fit.params).some((k) => k.startsWith('model')) && ` (model had ${Object.entries(fit.params).filter(([k]) => k.startsWith('model')).map(([k, v]) => `${k.slice(5).toLowerCase()} ${n(v, 2)}`).join(' · ')})`}
      </div>
      <div className="sans mt-1 text-[11px] leading-snug text-faint">{fit.caveat}</div>
    </div>
  )
}

export function PublishedPanel({ set }: { set: PublishedSet }) {
  return (
    <div className="space-y-3">
      <p className="sans text-[12.5px] leading-snug text-ink">
        Numbers read from NASA&apos;s published papers on this experiment. Every row says where in the paper it came from and how it was read (table, text or derived). Our model is then fitted to them.
      </p>
      <FitCard fit={set.fit} />
      <div>
        <div className="label mb-1">rows · {set.rows.length}</div>
        <div className="space-y-1">
          {set.rows.map((r) => (
            <div key={r.id} className="rounded-sm border border-line px-2 py-1 text-[10.5px]">
              <div className="flex gap-2">
                <span className="w-16 shrink-0 text-ink">{r.id}</span>
                <span className="sans text-[11px] text-ink">{r.text}</span>
              </div>
              <div className="ml-[72px] text-faint">
                {r.ref} · {r.where} · <span className="text-muted-foreground">{r.how}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {set.notes.length > 0 && (
        <ul className="sans list-disc space-y-0.5 pl-4 text-[11.5px] text-muted-foreground">
          {set.notes.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <div>
        <div className="label mb-1">sources</div>
        {Object.entries(set.refs).map(([k, r]) => (
          <div key={k} className="text-[10.5px] leading-snug">
            <span className="text-ink">{k}</span> <span className="sans text-muted-foreground">{r.cite}</span>{' '}
            {r.url && (
              <a href={r.url} target="_blank" rel="noreferrer" className="text-ug hover:underline">
                NTRS {r.ntrs ?? ''}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
