// "How it works": who FIREFALL is for, what goes in, what comes out, and why it is a team of agents.
import { ArrowRight, ChevronDown, ExternalLink, FileInput, FileOutput, Users } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/bits'
import { CREW, LAB, HUMAN } from '@/demo/crew'
import { INCIDENTS, KIND_TONE } from '@/data/incidents'
import type { ScenarioId } from '@/demo/scenarios'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

const LIST = "list-none space-y-1 text-[12.5px] text-muted-foreground [&>li]:pl-3 [&>li]:-indent-3 [&>li]:before:mr-1.5 [&>li]:before:content-['·']"

const TODAY = [
  { n: 1, t: 'Materials test', d: 'Every non-metal material gets a pass/fail upward-burn test (NASA-STD-6001 Test 1) in Earth gravity, at the worst atmosphere it will see.', us: false },
  { n: 2, t: 'Configuration analysis', d: 'Materials that fail must be shown not to spread fire in the actual design: barriers, isolation, no ignition source (JSC 29353).', us: true },
  { n: 3, t: 'Hazard report', d: 'Causes, controls, verification and open items are written up for each fire hazard, with the evidence behind them.', us: true },
  { n: 4, t: 'Safety review panel', d: 'The panel reviews in phases and certifies the vehicle to fly. One ISS panel handled 449 data packages in a year.', us: false },
]

const EXISTING = [
  { what: 'PSI website', limit: 'Keyword search; data files behind a login; no comparison or interpretation.', us: 'Ranks and applies all 24 combustion investigations to your design.' },
  { what: 'General AI search (SDE / INDUS)', limit: 'Finds papers; no fire-safety reasoning, no sign-offs.', us: 'Department agents that argue, cite, and hand decisions to people.' },
  { what: 'FDS fire models', limit: 'Accurate but expert-only and slow; NASA Glenn: not suited to parametric studies.', us: 'Instant parametric triage, bounded between µg and 1 g data, before FDS.' },
  { what: 'One chatbot', limit: 'One black-box answer, no accountability.', us: 'A visible plan, delegation and audit trail over A2A (Lagrange).' },
]

export function GuideView() {
  const load = useMission((s) => s.load)
  const [history, setHistory] = useState(false)
  const start = (id: ScenarioId) => load(id, true)

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="label">How it works</div>
        <h1 className="mt-2 max-w-3xl text-[26px] font-semibold leading-tight tracking-tight">Fire safety review for crewed vehicles, run by a team of AI departments, with people in the loop.</h1>
        <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-muted-foreground">
          FIREFALL is for the <b className="font-medium text-ink">materials and safety engineers</b> who build crewed spacecraft, lunar habitats and rovers, and have to prove to a safety panel that a fire
          won’t start, spread or go unnoticed. It takes the team’s design package, applies two decades of NASA microgravity fire research (PSI) to it, and drafts what the panel asks for.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => start('habitat')} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
            Run the demo: PR-2 rover review <ArrowRight size={14} />
          </button>
          <button type="button" onClick={() => start('apollo1')} className="rounded-md border border-line px-4 py-2 text-[13px] hover:bg-surface-3">
            Apollo 1: would it have been caught?
          </button>
          <button type="button" onClick={() => start('incident')} className="rounded-md border border-line px-4 py-2 text-[13px] hover:bg-surface-3">
            Operations: smoke alarm
          </button>
        </div>

        <h2 className="mt-10 text-[15px] font-semibold">How it is done today</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {TODAY.map((s) => (
            <div key={s.n} className={cn('rounded-lg border p-3', s.us ? 'border-primary/40 bg-primary/5' : 'border-line bg-surface')}>
              <div className="flex items-center gap-2">
                <span className="tnum flex size-5 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold">{s.n}</span>
                <span className="text-[13px] font-semibold">{s.t}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{s.d}</p>
              {s.us && <div className="mt-2 text-[11.5px] font-medium text-primary">FIREFALL drafts this</div>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          <b className="font-medium text-ink">Why now:</b> Artemis plans a 34 % O₂ / 8.2 psia cabin to shorten EVA prep. Richer oxygen makes materials burn more easily, and a change of atmosphere means retesting.
          Test 1 runs in Earth gravity, NASA Glenn reports some materials burn at lower oxygen in lunar gravity, and PSI has no partial-gravity fire data at all.
        </p>

        <h2 className="mt-10 text-[15px] font-semibold">What goes in, who works on it, what comes out</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.3fr_1fr]">
          <Box icon={<FileInput size={15} />} title="Input · design package">
            <ul className={LIST}>
            <li>Cabin atmosphere, gravity, volume, ventilation</li>
            <li>Materials list (BOM) with location and quantity</li>
            <li>Ignition sources: batteries, avionics, heaters</li>
            <li>Existing test data (Test 1 results)</li>
            <li>Optional cabin layout (3D)</li>
            </ul>
          </Box>
          <Box icon={<Users size={15} />} title="The review team">
            <div className="grid grid-cols-2 gap-1.5">
              {CREW.map((a) => (
                <div key={a.handle} className="flex items-center gap-1.5">
                  <Avatar handle={a.handle} size={20} />
                  <span className="truncate text-[12px]">{a.name}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <Avatar handle={HUMAN} size={20} />
                <span className="text-[12px]">You · lead engineer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Avatar handle={LAB} size={20} />
                <span className="text-[12px]">Test lab (WSTF)</span>
              </div>
            </div>
          </Box>
          <Box icon={<FileOutput size={15} />} title="Output · for the safety panel">
            <ul className={LIST}>
            <li>Materials matrix: pass / retest / fails at your atmosphere</li>
            <li>Draft fire hazard report with citations</li>
            <li>Test requests for the lab</li>
            <li>Crew response card</li>
            <li>Simulations as triage evidence</li>
            </ul>
          </Box>
        </div>

        <h2 className="mt-10 text-[15px] font-semibold">Why a network of agents, not one chatbot</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[
            ['One agent per department', 'Materials, detection, suppression, research, simulation and safety each have their own tools, data and context — like the real review board.'],
            ['Agents ask each other, and people', 'Materials asks the test lab for missing data; Safety Assurance challenges claims; the lead hands trade-offs to you. You approve; nothing is decided silently.'],
            ['Across organisations', 'On Lagrange each agent is an address. The test lab’s agent can answer from lab data the vehicle team never sees.'],
            ['The conversation is the audit trail', 'Every request, answer, approval and citation is a message on the network: who decided what, and on which evidence.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-line bg-surface p-3">
              <div className="text-[13px] font-semibold">{t}</div>
              <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-[15px] font-semibold">Compared with what exists</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-line">
          <div className="grid grid-cols-[170px_1fr_1fr] gap-3 border-b border-line bg-surface-3 px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground">
            <span>Today</span>
            <span>Limitation</span>
            <span>FIREFALL</span>
          </div>
          {EXISTING.map((e) => (
            <div key={e.what} className="grid grid-cols-[170px_1fr_1fr] gap-3 border-b border-line bg-surface px-3 py-2 text-[12.5px] last:border-0">
              <div className="font-medium">{e.what}</div>
              <div className="text-muted-foreground">{e.limit}</div>
              <div>{e.us}</div>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => setHistory(!history)} className="mt-10 flex items-center gap-1.5 text-[15px] font-semibold">
          Sixty years of spacecraft fires <ChevronDown size={16} className={cn('transition', history && 'rotate-180')} />
        </button>
        {history && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {INCIDENTS.map((i) => (
              <div key={i.year + i.where} className="rounded-lg border border-line bg-surface p-3" style={{ borderLeft: `3px solid ${KIND_TONE[i.kind]}` }}>
                <div className="flex items-center gap-2">
                  <span className="tnum text-[13px] font-semibold">{i.year}</span>
                  <span className="text-[12px] text-muted-foreground">{i.where}</span>
                  {i.status === 'team' && <span className="rounded bg-warn/10 px-1 text-[10px] text-warn">to verify</span>}
                  {i.source && (
                    <a href={i.source.url} target="_blank" rel="noreferrer" className="ml-auto text-faint hover:text-ug" title={i.source.label}>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="mt-1 text-[12.5px] leading-snug">{i.what}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">→ {i.fix}</div>
                {i.caseFile && (
                  <button type="button" onClick={() => start(i.caseFile as ScenarioId)} className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                    Open case file <ArrowRight size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-10 border-t border-line pt-4 text-[12px] text-faint">
          Simulations and the materials matrix use simplified engineering models tuned to PSI trends. They tell you what to test first; they do not replace NASA-STD-6001 testing, FDS modelling or the
          safety panel.
        </p>
      </div>
    </div>
  )
}

function Box({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}
