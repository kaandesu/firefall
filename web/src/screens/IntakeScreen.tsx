// 1 INTAKE: the three files a team hands over plus one request line. Each slot shows what was understood.
import { Canvas, useFrame } from '@react-three/fiber'
import { AlertTriangle, Check, FileUp, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Group } from 'three'
import { cabinSummary, crossCheck, materialsSummary, modelSummary, type CabinModel, type Slot } from '@/intake/parse'
import { EXAMPLE_FILES, useMission } from '@/live/store'
import { cn } from '@/lib/utils'
import { MATERIALS } from '@/sims/models'
import { Cabin } from '@/stage/Cabin'

const SLOTS: { id: Slot; title: string; hint: string; accept: string }[] = [
  { id: 'cabin', title: 'CABIN SPEC', hint: 'O₂, pressure, gravity, volume, vents, crew, ignition sources, hatch', accept: '.yaml,.yml' },
  { id: 'materials', title: 'MATERIALS LIST', hint: 'part, material, rating, zone, quantity, distance to ignition', accept: '.csv' },
  { id: 'model', title: 'CABIN MODEL', hint: 'primitives, each a named zone', accept: '.json' },
]

function Spin({ model }: { model: CabinModel }) {
  const g = useRef<Group>(null)
  useFrame((_, dt) => g.current && (g.current.rotation.y += dt * 0.35))
  return (
    <group ref={g} position={[0, -1.4, 0]}>
      <Cabin model={model} look={() => ({ color: '#3a4a5e' })} />
    </group>
  )
}

function Thumb({ model }: { model: CabinModel }) {
  return (
    <Canvas camera={{ position: [4.6, 2.6, 4.6], fov: 36 }} className="!h-[150px]">
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 3]} intensity={0.9} />
      <Spin model={model} />
    </Canvas>
  )
}

function SlotCard({ slot }: { slot: (typeof SLOTS)[number] }) {
  const st = useMission((s) => s.intake[slot.id])
  const intake = useMission((s) => s.intake)
  const setSlot = useMission((s) => s.setSlot)
  const clearSlot = useMission((s) => s.clearSlot)
  const [raw, setRaw] = useState(false)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const issues = crossCheck(intake.cabin?.value, intake.materials?.value, intake.model?.value).filter((i) => i.slot === slot.id)
  const read = async (f?: File) => f && setSlot(slot.id, f.name, await f.text())

  const summary = st?.value
    ? slot.id === 'cabin'
      ? cabinSummary(intake.cabin!.value!)
      : slot.id === 'materials'
        ? materialsSummary(intake.materials!.value!, intake.model?.value)
        : modelSummary(intake.model!.value!)
    : undefined

  return (
    <div
      className={cn('pane min-h-[300px] p-3 pt-4', drag && 'border-ug', st?.error && 'border-bad/60')}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        void read(e.dataTransfer.files[0])
      }}
    >
      <header className="pane-head text-[11px]">
        <span className="tracking-[0.14em] text-ink">{slot.title}</span>
        <span className="ml-auto text-faint">{st?.name ?? EXAMPLE_FILES[slot.id]}</span>
      </header>
      <input ref={input} type="file" accept={slot.accept} className="hidden" onChange={(e) => void read(e.target.files?.[0])} />
      {!st ? (
        <button type="button" onClick={() => input.current?.click()} className="flex flex-1 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-line-2 text-faint transition hover:border-ug/60 hover:text-ink">
          <FileUp size={20} />
          <span className="text-[11.5px]">drop or choose {EXAMPLE_FILES[slot.id]}</span>
          <span className="sans max-w-[220px] text-center text-[11px] text-faint">{slot.hint}</span>
        </button>
      ) : st.error ? (
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-start gap-2 text-[11.5px] text-bad">
            <X size={13} className="mt-0.5 shrink-0" />
            {st.error}
          </div>
          <button type="button" onClick={() => input.current?.click()} className="self-start text-[11px] text-ug hover:underline">
            choose another file
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 text-[14px] text-ink">
            <Check size={13} className="text-ok" />
            {summary}
          </div>
          {slot.id === 'model' && intake.model?.value && (
            <div className="overflow-hidden rounded-sm border border-line bg-viewport">
              <Thumb model={intake.model.value} />
            </div>
          )}
          {slot.id === 'cabin' && intake.cabin?.value && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>vehicle</span>
              <span className="truncate text-ink">{intake.cabin.value.vehicle}</span>
              <span>volume · crew</span>
              <span className="text-ink">
                {intake.cabin.value.volume} m³ · {intake.cabin.value.crew}
              </span>
              <span>ignition</span>
              <span className="truncate text-ink">{intake.cabin.value.ignition.map((i) => i.zone).join(', ') || '—'}</span>
              <span>hatch</span>
              <span className="truncate text-ink">{intake.cabin.value.hatch.openTime} s · {intake.cabin.value.hatch.type}</span>
              <span>hull burst</span>
              <span className="text-ink">{intake.cabin.value.hull.burstPsia} psia</span>
            </div>
          )}
          {slot.id === 'materials' && intake.materials?.value && (
            <div className="scroll-thin max-h-[150px] overflow-y-auto text-[11px]">
              {intake.materials.value.map((r) => (
                <div key={r.line} className="flex gap-2">
                  <span className="w-[150px] truncate text-ink">{r.part}</span>
                  <span className="w-[90px] truncate text-muted-foreground">{r.key ? MATERIALS[r.key].label.split(' ')[0] : r.material}</span>
                  <span className="text-faint">{r.zone}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-auto space-y-0.5">
            {issues.length === 0 ? (
              <div className="text-[10.5px] text-ok">no issues</div>
            ) : (
              issues.map((i) => (
                <div key={i.text} className={cn('flex items-start gap-1.5 text-[10.5px]', i.level === 'error' ? 'text-bad' : 'text-warn')}>
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {i.text}
                </div>
              ))
            )}
            <div className="flex gap-3 pt-1 text-[10.5px]">
              <button type="button" onClick={() => setRaw(!raw)} className="text-ug hover:underline">
                {raw ? 'hide raw' : 'raw rows'}
              </button>
              <button type="button" onClick={() => clearSlot(slot.id)} className="text-faint hover:text-ink">
                remove
              </button>
            </div>
          </div>
          {raw && <pre className="scroll-thin max-h-[200px] overflow-auto rounded-sm border border-line bg-bg p-2 text-[10.5px] text-muted-foreground">{st.text}</pre>}
        </div>
      )}
    </div>
  )
}

export function IntakeScreen() {
  const intake = useMission((s) => s.intake)
  const request = useMission((s) => s.request)
  const setRequest = useMission((s) => s.setRequest)
  const loadExample = useMission((s) => s.loadExample)
  const start = useMission((s) => s.start)
  const realAgent = useMission((s) => s.realAgent)
  const errors = crossCheck(intake.cabin?.value, intake.materials?.value, intake.model?.value).filter((i) => i.level === 'error').length
  const ready = !!(intake.cabin?.value && intake.materials?.value && intake.model?.value) && errors === 0
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-6 py-8">
        <div className="flex items-end gap-4">
          <div>
            <div className="label">design-time fire safety review</div>
            <h1 className="sans mt-1 text-[26px] font-semibold leading-tight">Hand over the cabin. The agents review it.</h1>
            <p className="sans mt-1 text-[13px] text-muted-foreground">Three files and one question. The lead plans the review, you approve it, the departments run it over Lagrange.</p>
            <p className="mt-1.5 text-[11.5px]">
              {realAgent ? <span className="text-ok">real review · the work goes to @{realAgent} and the agents you assigned · about 4 minutes</span> : <span className="text-faint">scripted demo · the agents are simulated</span>}
            </p>
          </div>
          <button type="button" onClick={() => void loadExample()} className="ml-auto shrink-0 rounded-sm border border-k-ask/60 px-3 py-1.5 text-[12px] text-k-ask hover:bg-k-ask/10">
            load example: Apollo CM-012
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {SLOTS.map((s) => (
            <SlotCard key={s.id} slot={s} />
          ))}
        </div>
        <div className="pane flex-row items-center gap-3 px-3 py-2.5">
          <span className="text-k-ask">›</span>
          <input value={request} onChange={(e) => setRequest(e.target.value)} className="sans min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" placeholder="what should the review answer?" onKeyDown={(e) => e.key === 'Enter' && ready && start()} />
          <button type="button" disabled={!ready} onClick={start} className="shrink-0 rounded-sm bg-flame px-4 py-1.5 text-[12px] font-medium text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-faint">
            plan the review ▸
          </button>
        </div>
        {!ready && <div className="-mt-3 text-[11px] text-faint">{errors ? `${errors} issue${errors > 1 ? 's' : ''} to fix before the review can start` : 'add all three files, or load the example'}</div>}
      </div>
    </div>
  )
}
