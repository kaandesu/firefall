// The report: what the review found, section by section, with the data behind it (real ACME frames, the smoke CFD,
// the fire runs) and who decided what. A table of contents on the left, the chat on the right that can pull any of it
// up. Replaces the old one-card verdict.
import { Thumbnail } from '@remotion/player'
import { ArrowLeft, Download, MessageSquare, Pin, Printer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AgentTag, CiteChip, StatusPill } from '@/components/bits'
import { ReportChat, type Pull } from '@/components/ReportChat'
import { match, type EvidenceRow } from '@/data/evidence'
import { useEvidenceRows } from './EvidenceScreen'
import { targetOf } from '@/data/library'
import { stageRuns } from '@/demo/apollo1'
import { NODES, ORGS, agentColor, agentName } from '@/demo/crew'
import { BrightnessChart, FrameCanvas, SectionCanvas, useAcmeFrames } from '@/lab/tiles'
import type { SmokeStudy } from '@/lab/smokeStudy'
import { useSmokeStudy } from '@/lab/useSmokeStudy'
import { useMission } from '@/live/store'
import type { MatrixRow } from '@/live/types'
import { SECTIONS, buildReport, numberOf, scripted, type ReportInput, type SectionId } from '@/report/build'
import { FPS, StageComp } from '@/stage/StageComp'
import type { FireRun } from '@/stage/physics'
import { cn } from '@/lib/utils'

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const q = (s: string | number) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s))
export function matrixCsv(rows: MatrixRow[]) {
  const head = ['id', 'part', 'material', 'zone', 'qty', 'test1_21pct', 'limit_o2_pct', 'cabin_o2_pct', 'status', 'action', 'citations']
  return [head.join(','), ...rows.map((r) => [r.id, r.item, r.material, r.zone ?? '', r.qty, r.test1, (r.limitO2 * 100).toFixed(1), (r.targetO2 * 100).toFixed(1), r.status, r.action, (r.cites ?? []).map((c) => c.id).join(' ')].map(q).join(','))].join('\n')
}

const pct = (x: number) => `${Math.round(x * 100)} %`
const alarm = (t: number | null) => (t === null ? 'never' : `${t.toFixed(0)} s`)

export function ReportScreen() {
  const model = useMission((s) => s.model)
  const pkg = useMission((s) => s.pkg)
  const cabin = useMission((s) => s.cabin)
  const acme = useMission((s) => s.acme)
  const pins = useMission((s) => s.pins)
  const togglePin = useMission((s) => s.togglePin)
  const showVerdict = useMission((s) => s.showVerdict)
  const reset = useMission((s) => s.reset)
  const startedAt = useMission((s) => s.startedAt)
  const { study } = useSmokeStudy(pkg, cabin)
  const frames = useAcmeFrames()
  const evidence = useEvidenceRows()
  const runs = useMemo(() => (pkg && cabin ? stageRuns(pkg, cabin) : []), [pkg, cabin])
  const input: ReportInput | undefined = pkg ? { model, pkg, runs, study, events: frames?.ev ?? acme?.events ?? [], sensors: acme?.sensors, evidence, pins } : undefined
  const r = useMemo(() => (input ? buildReport(input) : undefined), [input?.model, input?.study, input?.events, input?.evidence, input?.pins, runs]) // eslint-disable-line react-hooks/exhaustive-deps

  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<SectionId>('summary')
  const [seed, setSeed] = useState<string>()
  const [flash, setFlash] = useState<string>()

  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const io = new IntersectionObserver(
      (es) => {
        const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(vis[0].target.id.slice(2) as SectionId)
      },
      { root, rootMargin: '0px 0px -65% 0px' },
    )
    root.querySelectorAll('section[id^="r-"]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [r !== undefined])

  const go = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setFlash(id)
    setTimeout(() => setFlash(undefined), 1600)
  }

  if (!pkg || !cabin || !r || !input) return <div className="flex flex-1 items-center justify-center text-faint">No review to report on yet.</div>

  const ask = (id: SectionId) => {
    setActive(id)
    setSeed(SECTIONS.find((s) => s.id === id)!.ask)
  }
  const target = targetOf(pkg.atmosphere.o2, pkg.atmosphere.psi)
  const minutes = startedAt && model.run ? Math.max(1, Math.round((model.now - model.run.at) / 60000)) : undefined

  const markdown = () =>
    [
      `# Fire hazard review · ${pkg.vehicle}`,
      '',
      `${pkg.atmosphere.label} · ${pkg.gravity.label} · ${pkg.volume} · crew ${pkg.crew}`,
      '',
      `**${r.verdict?.headline ?? 'Review'}**`,
      '',
      ...SECTIONS.flatMap((s) => [`## ${numberOf(s.id) ? `${numberOf(s.id)}. ` : ''}${s.title}`, '', ...r.brief[s.id].map((l) => `- ${l}`), '']),
    ].join('\n')

  const renderPull = (p: Pull): ReactNode => {
    if (p.kind === 'section') {
      const s = SECTIONS.find((x) => x.id === p.id)
      if (!s) return null
      return (
        <button type="button" onClick={() => go(`r-${s.id}`)} className="flex w-full items-center gap-2 rounded-sm border border-ug/30 bg-ug/5 px-2 py-1 text-left text-[11px] text-ug hover:border-ug/70">
          <span className="text-faint">§{numberOf(s.id)}</span>
          {s.title}
          <span className="ml-auto">jump →</span>
        </button>
      )
    }
    if (p.kind === 'row') {
      const row = model.matrix.find((x) => x.zone === p.id || x.id === p.id || x.material === p.id)
      if (!row) return null
      return (
        <button type="button" onClick={() => go(`row-${row.id}`)} className="w-full rounded-sm border border-line-2 bg-surface-2 px-2 py-1.5 text-left text-[11px] hover:border-ug/60">
          <div className="flex items-center gap-2">
            <span className="text-ink">{row.item}</span>
            <span className="text-faint">{row.material}</span>
            <StatusPill status={row.status} className="ml-auto" />
          </div>
          <MarginBar lim={row.limitO2} cabin={row.targetO2} />
        </button>
      )
    }
    if (p.kind === 'evidence') {
      const e = evidence.find((x) => x.id === p.id)
      if (!e) return null
      return <EvidenceCard e={e} m={match(e, target)} pinned={pins.includes(e.id)} onPin={() => togglePin(e.id)} />
    }
    if (p.id === 'pressure') return <Figure caption="cabin pressure after ignition" onOpen={() => go('r-fire')}><PressureChart runs={runs} hatch={r.hatch} h={110} /></Figure>
    if (p.id === 'smoke' && study) return <Figure caption="first alarm per source × gravity" onOpen={() => go('r-smoke')}><AlarmGrid study={study} compact /></Figure>
    if (p.id === 'acme' && frames) return <Figure caption="ACME 21256C2 · brightness, events detected" onOpen={() => go('r-evidence')}><BrightnessChart f={frames.f} ev={frames.ev} upTo={72} h={110} /></Figure>
    return null
  }

  const n = numberOf
  const asBuilt = r.asBuilt
  const ev = frames?.ev ?? []
  const pick = (t: number) => frames?.f.burst.reduce((a, b) => (Math.abs(b.t_s - t) < Math.abs(a.t_s - t) ? b : a))
  const status: Record<string, 'pass' | 'retest' | 'fail'> = {}
  const RANK = { pass: 0, retest: 1, fail: 2 }
  for (const row of model.matrix) if (row.zone && (!status[row.zone] || RANK[row.status] > RANK[status[row.zone]])) status[row.zone] = row.status

  return (
    <div className="flex min-h-0 flex-1">
      {/* table of contents */}
      <nav className="scroll-thin hidden w-[210px] shrink-0 overflow-y-auto border-r border-line px-3 py-6 text-[11.5px] lg:block print:hidden">
        <div className="label mb-2">on this page</div>
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => go(`r-${s.id}`)} className={cn('flex w-full items-baseline gap-2 rounded-sm px-1.5 py-1 text-left', active === s.id ? 'bg-surface-2 text-ink' : 'text-muted-foreground hover:text-ink')}>
            <span className="w-5 shrink-0 text-faint tnum">{n(s.id) || '★'}</span>
            <span className="sans leading-snug">{s.title}</span>
          </button>
        ))}
        <div className="mt-5 space-y-1.5 border-t border-line pt-3">
          <button type="button" onClick={() => download('hazard-report.md', markdown(), 'text/markdown')} className="flex items-center gap-1.5 text-muted-foreground hover:text-ink">
            <Download size={11} /> hazard-report.md
          </button>
          <button type="button" onClick={() => download('materials-matrix.csv', matrixCsv(model.matrix), 'text/csv')} className="flex items-center gap-1.5 text-muted-foreground hover:text-ink">
            <Download size={11} /> matrix.csv
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 text-muted-foreground hover:text-ink">
            <Printer size={11} /> print / PDF
          </button>
          <button type="button" onClick={() => showVerdict(false)} className="flex items-center gap-1.5 pt-2 text-muted-foreground hover:text-ink">
            <ArrowLeft size={11} /> back to the run
          </button>
          <button type="button" onClick={reset} className="text-faint hover:text-ink">
            new review
          </button>
        </div>
      </nav>

      {/* the article */}
      <div ref={scroller} className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <article className="mx-auto max-w-[860px] space-y-7 px-8 pb-24 pt-8">
          <header id="r-summary-head" className="space-y-3">
            <div className="label tracking-[0.16em] text-flame">fire hazard review · design stage</div>
            <h1 className="sans text-[28px] font-semibold leading-tight text-ink">{r.verdict?.headline ?? `${pkg.vehicle}: review`}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="text-ink">{pkg.vehicle}</span>
              <span>{pkg.atmosphere.label}</span>
              <span>{pkg.gravity.label}</span>
              <span>{pkg.volume}</span>
              <span>crew {pkg.crew}</span>
              <span className="text-faint">·</span>
              <span>{r.orgsUsed.length} orgs · {Object.keys(model.agents).length} agents</span>
              {minutes && <span>{minutes} min</span>}
              <span className="text-ok">≈ {Math.round(model.saved.tokens / 1000)}k tokens saved</span>
            </div>
          </header>

          <section id="r-summary" className={cn('scroll-mt-6 rounded-sm border border-line-2 bg-surface-2 p-5', flash === 'r-summary' && 'border-ug/60')}>
            <div className="flex items-center">
              <div className="label text-ug">the review in 30 seconds</div>
              <button type="button" onClick={() => ask('summary')} className="ml-auto flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-ink print:hidden">
                <MessageSquare size={10} /> Ask
              </button>
            </div>
            <ul className="sans mt-3 space-y-2 text-[14px] leading-snug text-ink">
              {r.tldr.map((l) => (
                <li key={l} className="flex gap-2.5">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-flame" />
                  {l}
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <Big n={`${r.fails.length}/${model.matrix.length}`} label="materials burn" color="var(--bad)" />
              <Big n={asBuilt?.rupture !== undefined ? `T+${asBuilt.rupture.toFixed(0)} s` : 'none'} label="hull rupture" color="var(--flame)" />
              <Big n={`${r.hatch} s`} label="to open the hatch" color="var(--warn)" />
              <Big n={study ? `${study.cases.length - r.designedNever.length}/${study.cases.length}` : '—'} label="smoke cases the designed sensors see" color="var(--k-ask)" />
            </div>
          </section>

          <ReportSection flash={flash} onAsk={ask} id="cabin" by={['flight']}>
            <div className="grid grid-cols-[1.25fr_1fr] gap-4">
              <div className="overflow-hidden rounded-sm border border-line bg-viewport">
                {asBuilt && <Thumbnail component={StageComp} inputProps={{ model: cabin, run: asBuilt, layer: 'materials', status, hatchTime: pkg.hatch?.openTime ?? 90, orbit: false }} compositionWidth={640} compositionHeight={380} frameToDisplay={0} durationInFrames={FPS * 2} fps={FPS} style={{ width: '100%' }} />}
                <div className="border-t border-line px-2 py-1 text-[10px] text-faint">cabin.model.json · coloured by matrix status · red = burns</div>
              </div>
              <div className="space-y-2 text-[12px]">
                <KV k="atmosphere" v={pkg.atmosphere.label} />
                <KV k="gravity" v={pkg.gravity.label} />
                <KV k="ventilation" v={`${pkg.ventFlow} cm/s`} />
                <KV k="ignition zones" v={(pkg.ignitionZones ?? []).join(', ') || '—'} />
                <KV k="hatch" v={`${pkg.hatch?.type ?? '—'} · ${pkg.hatch?.openTime ?? '—'} s`} />
                <KV k="hull" v={`${pkg.hull?.burstPsia ?? '—'} psia burst`} />
                <KV k="detectors" v={(pkg.sensors ?? []).map((s) => `${s.id} ${s.type} · ${s.zone}`).join(' / ') || 'none'} />
                <div className="pt-1 text-[10.5px] text-faint">from cabin.yaml · materials.csv · cabin.model.json</div>
              </div>
            </div>
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="materials" by={['prevent', 'archivist']}>
            <Callout kind="finding">
              {r.fails.length} of {model.matrix.length} parts sustain flame at {pkg.atmosphere.label}. Every polymer that passes NASA-STD-6001 Test 1 in air is pushed past its limiting O₂ by the cabin atmosphere.
            </Callout>
            <table className="w-full text-[11.5px]">
              <thead className="text-left text-faint">
                <tr className="border-b border-line">
                  <th className="py-1 font-normal">part</th>
                  <th className="font-normal">material</th>
                  <th className="font-normal">zone</th>
                  <th className="font-normal">Test 1 (air)</th>
                  <th className="w-[180px] font-normal">limiting O₂ vs cabin</th>
                  <th className="font-normal">status</th>
                </tr>
              </thead>
              <tbody>
                {model.matrix.map((row) => (
                  <tr key={row.id} id={`row-${row.id}`} className={cn('border-b border-line/60 align-top', flash === `row-${row.id}` && 'bg-ug/10')}>
                    <td className="sans py-1.5 text-ink">
                      {row.item}
                      <div className="text-[10.5px] text-faint">{row.action}</div>
                    </td>
                    <td className="text-muted-foreground">{row.material}</td>
                    <td className="text-muted-foreground">{row.zone ?? row.location}</td>
                    <td className={row.test1 === 'pass' ? 'text-ok' : row.test1 === 'fail' ? 'text-bad' : 'text-faint'}>{row.test1}</td>
                    <td className="pr-3">
                      <MarginBar lim={row.limitO2} cabin={row.targetO2} />
                    </td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="evidence" by={['archivist']}>
            <Callout kind="caveat">Real data, processed here: the ACME camera series and sensor log are the NASA files, and the events below are found by code. Saffire, BASS-II and FLEX stay catalogue fits.</Callout>
            {frames && (
              <div className="rounded-sm border border-line bg-viewport p-3">
                <div className="mb-2 flex items-baseline gap-2 text-[11px]">
                  <span className="text-ink">ACME CFI-G · test 21256C2 · intensified camera</span>
                  <span className="text-faint">{frames.f.series.length} samples · {frames.f.burst.length} frames · PSI-159</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {ev
                    .filter((e) => e.id !== 'flash')
                    .map((e) => {
                      const b = pick(e.t)
                      return (
                        <figure key={e.id} className="space-y-1">
                          {b && <FrameCanvas src={b.src} className="w-full rounded-sm border border-line" />}
                          <figcaption className="text-[10px] leading-tight">
                            <span className="text-k-ask">{e.label}</span> <span className="text-faint">T+{e.t.toFixed(1)} s</span>
                            <div className="text-faint">{e.note}</div>
                          </figcaption>
                        </figure>
                      )
                    })}
                </div>
                <div className="mt-2">
                  <BrightnessChart f={frames.f} ev={ev} upTo={72} h={150} w={740} />
                </div>
                {acme?.sensors && (
                  <div className="mt-2 grid grid-cols-5 gap-1.5 text-[10.5px]">
                    <Mini n={`${acme.sensors.fuelOn?.toFixed(1)} s`} l="fuel on (19175A4)" />
                    <Mini n={`${acme.sensors.ignition?.toFixed(1)} s`} l="ignition · ion current" />
                    <Mini n={`${acme.sensors.burn?.toFixed(1)} s`} l="burn time" />
                    <Mini n={`${acme.sensors.fuelOff?.toFixed(1)} s`} l="fuel off" />
                    <Mini n={String(acme.sensors.channels)} l="sensor channels read" />
                  </div>
                )}
              </div>
            )}
            <div>
              <div className="label mb-1.5">nearest test points to this cabin ({pct(pkg.atmosphere.o2)} O₂ · {pkg.atmosphere.psi} psia) · of {evidence.length} rows</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[...r.near.map((x) => x.e), ...r.pinned.filter((p) => !r.near.some((x) => x.e.id === p.id))].map((e) => (
                  <EvidenceCard key={e.id} e={e} m={match(e, target)} pinned={pins.includes(e.id)} onPin={() => togglePin(e.id)} />
                ))}
              </div>
              <div className="mt-1.5 text-[10.5px] text-faint">Pin rows from the Evidence explorer and they land here. Nothing in the archive is above {pct(Math.max(0, ...evidence.filter((e) => e.o2at === 'ambient').map((e) => e.o2)))} ambient O₂.</div>
            </div>
            <div>
              <div className="label mb-1.5">studies that fit this cabin best</div>
              <div className="space-y-1">
                {r.fit.map((f) => (
                  <div key={f.study.id} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-[200px] truncate text-ink">{f.study.name}</span>
                    {f.study.psi && <CiteChip id={f.study.psi} />}
                    <div className="h-1 flex-1 rounded bg-surface-3">
                      <div className="h-full rounded bg-ug" style={{ width: `${f.total * 100}%` }} />
                    </div>
                    <span className="w-9 text-right text-faint tnum">{f.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <JobsTable jobs={model.jobs.filter((j) => j.kind === 'data')} />
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="fire" by={['sim']}>
            <Callout kind="finding">
              From the listed ignition zone the fire reaches {r.burning} zones. Pressure crosses the {asBuilt?.burstPsia} psia hull limit at {asBuilt?.rupture !== undefined ? `T+${asBuilt.rupture.toFixed(0)} s` : 'no point'}; the hatch takes {r.hatch} s.
            </Callout>
            <div className="rounded-sm border border-line bg-viewport p-3">
              <PressureChart runs={runs} hatch={r.hatch} h={170} />
            </div>
            <JobsTable jobs={model.jobs.filter((j) => j.kind === 'sim' && /spread|flame/.test(j.scene ?? ''))} />
            <Callout kind="caveat">Spread and pressure are lumped models checked against the Apollo 204 Review Board timeline: use them for ordering, not for exact times.</Callout>
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="smoke" by={['detect', 'sim']}>
            {study ? (
              <>
                <Callout kind={r.designedNever.length ? 'finding' : 'decision'}>
                  The designed layout misses {r.designedNever.length} of {study.cases.length} cases ({r.designedNever.map((c) => `${c.source} · ${c.gLabel}`).join(', ') || 'none'}). Without buoyancy smoke drifts with the vent jet instead of rising, and {study.smokeD} µm PTFE smoke is below what a photoelectric head sees.
                </Callout>
                <div className="grid grid-cols-2 gap-3">
                  {(['designed', 'proposed'] as const).map((l) => (
                    <figure key={l} className="rounded-sm border border-line bg-viewport p-2">
                      <SectionCanvas study={study} field={arrivalField(study)} sensors={l} className="w-full rounded-sm" scale={4} />
                      <figcaption className="mt-1 text-[10.5px]">
                        <span className={l === 'proposed' ? 'text-ok' : 'text-ink'}>{l}</span>
                        <span className="text-faint"> · worst-case first alarm </span>
                        <span className={l === 'proposed' ? 'text-ok' : 'text-bad'}>{alarm(l === 'proposed' ? study.worstProposed : study.worstDesigned)}</span>
                        <div className="text-faint">{(l === 'proposed' ? study.proposed : study.designed).map((s) => `${s.id} ${s.type} (${s.x.toFixed(2)}, ${s.y.toFixed(2)}) m`).join(' · ')}</div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <div className="text-[10.5px] text-faint">Cabin cross-section at z = 0 from cabin.model.json. Colour: in how many of the {study.cases.length} cases ({study.sources.length} sources × µg / Moon / 1 g) smoke reaches each cell within {study.seconds} s. Green = all, red = few. A good detector sits in green.</div>
                <AlarmGrid study={study} />
                <JobsTable jobs={model.jobs.filter((j) => j.scene === 'smoke-cfd' || j.scene === 'sensor-opt')} />
              </>
            ) : (
              <div className="text-faint">The smoke study is still running.</div>
            )}
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="suppression" by={['suppress']}>
            <Callout kind="finding">{r.brief.suppression[0]}</Callout>
            <div className="sans text-[13px] leading-relaxed text-muted-foreground">{r.brief.suppression[1]} A portable extinguisher cannot make this cabin safe: the fix is removing oxygen or fuel, not fighting the fire.</div>
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="lab" by={['wstf']}>
            {r.chamber ? (
              <div className="grid grid-cols-[1fr_1.2fr] gap-3">
                <div className="space-y-1 text-[12px]">
                  <KV k="test" v={r.chamber.title} />
                  <KV k="where" v={`${r.chamber.node} · ${ORGS.wstf.name}`} />
                  {Object.entries(r.chamber.stats).map(([k, v]) => (
                    <KV key={k} k={k} v={v} />
                  ))}
                </div>
                <Callout kind="decision">A person ran this: the WSTF technician booked chamber 3 when the lead asked, burned the samples, and entered the burn lengths. The agents waited.</Callout>
              </div>
            ) : (
              <div className="text-faint">No physical test was run in this review.</div>
            )}
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="decisions" by={['flight', 'skeptic']}>
            <div className="space-y-2">
              {r.human.map((c) => (
                <div key={c.id} className="flex items-baseline gap-2 text-[12px]">
                  <span className="w-16 shrink-0 text-faint tnum">T+{Math.max(0, Math.round((c.at - (model.run?.at ?? c.at)) / 1000))} s</span>
                  <span className="w-24 shrink-0 text-ink">{c.from === 'you' ? 'You (lead engineer)' : c.from === 'lab' ? 'WSTF technician' : c.from}</span>
                  <span className="sans text-muted-foreground">{c.text}</span>
                </div>
              ))}
            </div>
            {model.proposals.map((p) => (
              <div key={p.id} className="rounded-sm border border-line-2 p-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-faint">{p.id}</span>
                  <span className="sans text-[14px] font-medium text-ink">{p.title}</span>
                  <span className="ml-auto text-[11px]" style={{ color: p.status === 'accepted' ? 'var(--ok)' : p.status === 'rejected' ? 'var(--bad)' : 'var(--warn)' }}>
                    {p.status}
                    {p.decidedBy ? ` · ${p.decidedBy}` : ''}
                  </span>
                </div>
                <div className="sans mt-1 text-[12.5px] text-muted-foreground">{p.change}</div>
                <div className="mt-2 flex flex-wrap gap-x-4 text-[11px]">
                  {p.impact.map((i) => (
                    <span key={i.label}>
                      <span className="text-faint">{i.label}</span> <span className="text-bad">{i.before}</span> → <span className="text-ok">{i.after}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-2 space-y-1">
                  {p.reviews.map((rv, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-[11.5px]">
                      <span style={{ color: agentColor(rv.by) }}>{agentName(rv.by)}</span>
                      <span className={rv.stance === 'endorse' ? 'text-ok' : rv.stance === 'object' ? 'text-bad' : 'text-faint'}>{rv.stance}s</span>
                      <span className="sans text-muted-foreground">{rv.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="whatif" by={['sim']}>
            <div className="grid grid-cols-2 gap-1.5">
              {runs
                .filter((x) => x.variant.id !== 'as-built')
                .map((x) => (
                  <div key={x.variant.id} className="rounded-sm border border-line bg-surface-2 px-2.5 py-2 text-[11.5px]">
                    <div className="text-ink">{x.variant.label}</div>
                    <div className="mt-0.5 text-faint">
                      {Object.values(x.ignite).filter((v) => v !== null).length}/{x.zones.length} zones burn · rupture {x.rupture === undefined ? <span className="text-ok">none</span> : <span className="text-bad">T+{x.rupture.toFixed(0)} s</span>}
                    </div>
                  </div>
                ))}
            </div>
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="open" by={['scribe']}>
            <ul className="space-y-1.5">
              {r.brief.open.map((l) => (
                <li key={l} className="sans flex gap-2 text-[13px] text-ink">
                  <span className="text-warn">○</span>
                  {l}
                </li>
              ))}
            </ul>
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="how" by={['flight']}>
            <div className="grid grid-cols-4 gap-2">
              <Mini n={String(model.comms.length)} l="messages" />
              <Mini n={String(r.cross.length)} l="across org lines" />
              <Mini n={`${model.saved.asks} · ${Math.round(model.saved.tokens / 1000)}k`} l="asks to owners · tokens saved" />
              <Mini n={String(model.jobs.length)} l={`jobs on ${new Set(model.jobs.map((j) => j.node).filter(Boolean)).size} machines`} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {r.orgsUsed.map((o) => {
                const org = ORGS[o!]
                return (
                  <div key={o} className="rounded-sm border border-line bg-surface-2 px-2.5 py-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-[3px] rounded" style={{ background: org.color }} />
                      <span className="text-ink">{org.name}</span>
                      <span className="ml-auto text-faint">{org.provider}</span>
                    </div>
                    <div className="mt-1 text-faint">
                      {NODES.filter((x) => x.org === o)
                        .map((x) => `${x.id}${x.gpus ? ` ${x.gpus}× ${x.gpu}` : ''}`)
                        .join(' · ')}
                    </div>
                    <div className="mt-0.5 text-muted-foreground">keeps private: {org.private.join(', ')}</div>
                  </div>
                )
              })}
            </div>
          </ReportSection>

          <ReportSection flash={flash} onAsk={ask} id="sources">
            <div className="flex flex-wrap gap-1.5">
              {r.cites.map((c) => (
                <CiteChip key={c.id} id={c.id} note={c.note} />
              ))}
              <span className="rounded-sm border border-line-2 px-1.5 py-px text-[10.5px] text-muted-foreground">ACME 21256C2 · 19175A4 · Flame Design test log (data files)</span>
            </div>
          </ReportSection>
        </article>
      </div>

      <ReportChat context={r.context} section={active} seed={seed} onSeedUsed={() => setSeed(undefined)} renderPull={renderPull} script={(question) => scripted(r, input, question)} />
    </div>
  )
}

// ── pieces ──

function ReportSection({ id, by, children, flash, onAsk }: { id: SectionId; by?: string[]; children: ReactNode; flash?: string; onAsk: (id: SectionId) => void }) {
  const s = SECTIONS.find((x) => x.id === id)!
  return (
    <section id={`r-${id}`} className={cn('scroll-mt-6 border-t border-line pt-7 transition-colors', flash === `r-${id}` && 'bg-ug/[0.04]')}>
      <div className="flex items-baseline gap-3">
        <span className="text-[12px] text-faint tnum">§{numberOf(id)}</span>
        <h2 className="sans text-[19px] font-semibold text-ink">{s.title}</h2>
        <span className="ml-auto flex items-center gap-1.5">
          {by?.map((h) => <AgentTag key={h} handle={h} />)}
          <button type="button" onClick={() => onAsk(id)} className="flex items-center gap-1 rounded-sm border border-line-2 px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:border-ug/60 hover:text-ink print:hidden">
            <MessageSquare size={10} /> Ask
          </button>
        </span>
      </div>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  )
}

/** Share of cases in which smoke reaches the cell: red (few) → amber → green (all). */
const arrivalField = (study: SmokeStudy) => (k: number): [number, number, number] => {
  const v = Math.max(0, study.reach[k])
  return v < 0.5 ? [Math.round(90 + 60 * v), Math.round(24 + 90 * v), 30] : [Math.round(120 - 200 * (v - 0.5)), Math.round(70 + 140 * (v - 0.5)), Math.round(30 + 40 * (v - 0.5))]
}

function Big({ n, label, color }: { n: string; label: string; color: string }) {
  return (
    <div className="rounded-sm border border-line-2 bg-surface p-2.5">
      <div className="text-[22px] leading-none tnum" style={{ color }}>
        {n}
      </div>
      <div className="mt-1 text-[10.5px] text-muted-foreground">{label}</div>
    </div>
  )
}
function Mini({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-sm border border-line bg-surface-2 px-2 py-1.5">
      <div className="text-[14px] text-ink tnum">{n}</div>
      <div className="text-[10px] text-faint">{l}</div>
    </div>
  )
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-[96px] shrink-0 text-faint">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  )
}

const CALLOUT = { finding: ['var(--bad)', 'finding'], caveat: ['var(--warn)', 'caveat'], decision: ['var(--ok)', 'people'], open: ['var(--k-ask)', 'open item'] } as const
function Callout({ kind, children }: { kind: keyof typeof CALLOUT; children: ReactNode }) {
  const [c, l] = CALLOUT[kind]
  return (
    <div className="rounded-sm border-l-2 bg-surface-2 px-3 py-2" style={{ borderColor: c }}>
      <div className="label" style={{ color: c }}>
        {l}
      </div>
      <div className="sans mt-0.5 text-[13px] leading-snug text-ink">{children}</div>
    </div>
  )
}

function MarginBar({ lim, cabin }: { lim: number; cabin: number }) {
  const X = (v: number) => `${Math.min(100, v * 100)}%`
  const burns = cabin > lim
  return (
    <div className="mt-1">
      <div className="relative h-1.5 rounded bg-surface-3">
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: X(lim), background: burns ? 'color-mix(in srgb, var(--bad) 35%, transparent)' : 'color-mix(in srgb, var(--ok) 35%, transparent)' }} />
        <div className="absolute -top-0.5 h-2.5 w-[2px] bg-ink" style={{ left: X(cabin) }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[9.5px] text-faint">
        <span>limit {pct(lim)}</span>
        <span className={burns ? 'text-bad' : 'text-ok'}>cabin {pct(cabin)}</span>
      </div>
    </div>
  )
}

function EvidenceCard({ e, m, pinned, onPin }: { e: EvidenceRow; m: number; pinned: boolean; onPin: () => void }) {
  return (
    <div className="rounded-sm border border-line-2 bg-surface-2 px-2 py-1.5 text-[11px]">
      <div className="flex items-center gap-2">
        <span className="text-ink">{e.id}</span>
        <span className="text-faint">{e.src}</span>
        <span className="text-faint">{e.date}</span>
        <button type="button" onClick={onPin} title={pinned ? 'unpin from the report' : 'pin to the report'} className={cn('ml-auto', pinned ? 'text-k-ask' : 'text-faint hover:text-ink')}>
          <Pin size={10} />
        </button>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 text-muted-foreground">
        <span>{e.fuel}</span>
        <span>
          {pct(e.o2)} O₂ {e.o2at}
        </span>
        <span>{e.psia} psia</span>
        <span className={e.ign ? 'text-flame' : 'text-faint'}>{e.ign ? 'ignited' : 'no ignition'}</span>
        <span className="ml-auto text-ug">match {m < 0.01 ? '< 0.01' : m.toFixed(2)}</span>
      </div>
      <div className="text-[10px] text-faint">{e.ref}</div>
    </div>
  )
}

function Figure({ caption, onOpen, children }: { caption: string; onOpen: () => void; children: ReactNode }) {
  return (
    <div className="rounded-sm border border-line-2 bg-viewport p-2">
      {children}
      <button type="button" onClick={onOpen} className="mt-1 flex w-full items-center text-[10px] text-faint hover:text-ink">
        {caption}
        <span className="ml-auto text-ug">open in report →</span>
      </button>
    </div>
  )
}

const RUN_COLOR: Record<string, string> = { 'as-built': '#ff6b6b', proposal: '#7ee787', '60-40': '#ffb547', ug: '#5aa9ff', base: '#c9a2ff' }
function PressureChart({ runs, hatch, h }: { runs: FireRun[]; hatch: number; h: number }) {
  if (!runs.length) return null
  const W = 600
  const tMax = Math.max(hatch + 10, ...runs.map((r) => r.pressure.at(-1)?.t ?? 0))
  const pMax = Math.max(...runs.map((r) => r.burstPsia), ...runs.flatMap((r) => r.pressure.map((p) => p.psia))) * 1.1
  const X = (t: number) => (t / tMax) * W
  const Y = (p: number) => h - (p / pMax) * h
  const burst = runs[0].burstPsia
  return (
    <svg viewBox={`0 0 ${W} ${h + 16}`} className="w-full">
      <line x1={0} x2={W} y1={Y(burst)} y2={Y(burst)} stroke="#ff6b6b" strokeDasharray="4 3" strokeWidth={0.8} />
      <text x={4} y={Y(burst) - 3} fill="#ff6b6b" fontSize={9}>
        hull burst {burst} psia
      </text>
      <line x1={X(hatch)} x2={X(hatch)} y1={0} y2={h} stroke="#ffb547" strokeDasharray="3 3" strokeWidth={0.8} />
      <text x={X(hatch) - 4} y={10} fill="#ffb547" fontSize={9} textAnchor="end">
        hatch open {hatch} s
      </text>
      {runs.map((r) => (
        <g key={r.variant.id}>
          <polyline points={r.pressure.map((p) => `${X(p.t).toFixed(1)},${Y(p.psia).toFixed(1)}`).join(' ')} fill="none" stroke={RUN_COLOR[r.variant.id] ?? '#7d8a99'} strokeWidth={r.variant.id === 'as-built' ? 1.8 : 1} opacity={r.variant.id === 'as-built' ? 1 : 0.75} />
          {r.rupture !== undefined && <circle cx={X(r.rupture)} cy={Y(burst)} r={3} fill={RUN_COLOR[r.variant.id] ?? '#7d8a99'} />}
        </g>
      ))}
      <text x={0} y={h + 12} fill="#4a5665" fontSize={9}>
        T+0 (ignition)
      </text>
      <text x={W} y={h + 12} fill="#4a5665" fontSize={9} textAnchor="end">
        T+{tMax.toFixed(0)} s · psia
      </text>
      <g transform={`translate(${W - 4}, ${h - 4})`}>
        {runs.map((r, i) => (
          <text key={r.variant.id} x={0} y={-i * 11} fill={RUN_COLOR[r.variant.id] ?? '#7d8a99'} fontSize={8.5} textAnchor="end">
            {r.variant.short}
          </text>
        ))}
      </g>
    </svg>
  )
}

function AlarmGrid({ study, compact }: { study: SmokeStudy; compact?: boolean }) {
  const gs = [...new Set(study.cases.map((c) => c.gLabel))]
  const cell = (t: number | null) => (t === null ? 'text-bad' : t > 30 ? 'text-warn' : 'text-ok')
  return (
    <table className={cn('w-full', compact ? 'text-[10.5px]' : 'text-[11.5px]')}>
      <thead className="text-left text-faint">
        <tr className="border-b border-line">
          <th className="py-1 font-normal">ignition source</th>
          {gs.map((g) => (
            <th key={g} className="font-normal">
              {g}
              {!compact && <span className="text-faint"> · designed / proposed</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {study.sources.map((s) => (
          <tr key={s.id} className="border-b border-line/60">
            <td className="py-1 text-ink">{compact ? s.zone : s.label}</td>
            {gs.map((g) => {
              const d = study.cases.find((c) => c.source === s.id && c.gLabel === g)?.firstAlarm ?? null
              const p = study.proposedCases.find((c) => c.source === s.id && c.gLabel === g)?.firstAlarm ?? null
              return (
                <td key={g} className="tnum">
                  <span className={cell(d)}>{alarm(d)}</span>
                  <span className="text-faint"> / </span>
                  <span className={cell(p)}>{alarm(p)}</span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function JobsTable({ jobs }: { jobs: ReturnType<typeof useMission.getState>['model']['jobs'] }) {
  if (!jobs.length) return null
  return (
    <div>
      <div className="label mb-1">jobs behind this section</div>
      <div className="space-y-0.5 text-[11px]">
        {jobs.map((j) => (
          <div key={j.id} className="flex items-baseline gap-2">
            <span className="w-[260px] truncate text-ink">{j.title}</span>
            <span style={{ color: agentColor(j.agent) }}>@{j.agent}</span>
            <span className="text-faint">
              {j.node ?? j.where}
              {j.gpus ? ` · ${j.gpus} GPU` : ''}
            </span>
            <span className="ml-auto truncate text-muted-foreground">
              {Object.entries(j.stats)
                .slice(-2)
                .map(([k, v]) => `${k} ${v}`)
                .join(' · ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

