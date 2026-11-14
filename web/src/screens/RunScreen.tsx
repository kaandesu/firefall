// 3 RUN: Halo layout. Network, stage and agent on top, plan and findings as bars, comms as a strip.
import { useEffect, useRef, useState } from 'react'
import { PanelLayout, type PaneDef } from '@/components/shell/Panels'
import { AGENT } from '@/demo/crew'
import { PANELS, useMission, type PanelId } from '@/live/store'
import { Stage } from '@/stage/Stage'
import { AgentView } from '@/views/AgentView'
import { CommsView } from '@/views/CommsView'
import { FindingsView } from '@/views/FindingsView'
import { NetworkView } from '@/views/NetworkView'
import { PlanGraph } from '@/views/PlanGraph'

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

function useKeys(askRef: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (typing(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      const s = useMission.getState()
      const k = e.key
      if (k >= '1' && k <= '6') s.focusPanel(Number(k) as PanelId)
      else if (k === '+' || k === '=') s.grow(1)
      else if (k === '-' || k === '_') s.grow(-1)
      else if (k === 'h') s.cycleAgent(-1)
      else if (k === 'l') s.cycleAgent(1)
      else if (k === 'a' && s.model.waiting) s.answer(s.model.waiting.options[0])
      else if (k === '?') s.setHelp(!s.help)
      else if (k === 'Escape') {
        if (s.help) s.setHelp(false)
        else if (s.sizes[s.focus] === 'full') s.grow(-1)
      }
      else if (k === ' ') {
        if (s.status.playing) s.pause()
        else s.play()
      }
      else if (k === '/' || k === 'i') askRef.current?.focus()
      else if ((k === 'j' || k === 'k' || k === 'Enter') && s.focus === 5 && s.model.matrix.length) {
        const rows = s.model.matrix
        const i = rows.findIndex((r) => r.id === s.openRow)
        if (k === 'Enter') s.toggleRow(i >= 0 ? rows[i].id : rows[0].id)
        else {
          const n = rows[Math.max(0, Math.min(rows.length - 1, i + (k === 'j' ? 1 : -1)))]
          s.toggleRow(n.id)
          s.setHoverZone(n.zone)
        }
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [askRef])
}

function Help() {
  const help = useMission((s) => s.help)
  const setHelp = useMission((s) => s.setHelp)
  if (!help) return null
  const keys = [
    ['1–6', 'focus a panel'],
    ['+ / −', 'grow / shrink: bar → normal → column → full'],
    ['h / l', 'previous / next agent'],
    ['j / k · enter', 'move through / open findings rows'],
    ['a', 'answer the waiting question (first option)'],
    ['/ or i', 'ask the lead'],
    ['space', 'pause / resume the demo'],
    ['esc', 'close · leave full screen'],
  ]
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/70" onClick={() => setHelp(false)}>
      <div className="pane w-[420px] p-4 pt-5">
        <header className="pane-head text-[11px]">
          <span className="tracking-[0.14em] text-ink">KEYS</span>
        </header>
        {keys.map(([k, d]) => (
          <div key={k} className="flex gap-3 py-0.5 text-[12px]">
            <span className="w-[110px] text-k-ask">{k}</span>
            <span className="text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RunScreen() {
  const plan = useMission((s) => s.model.plan)
  const matrix = useMission((s) => s.model.matrix)
  const comms = useMission((s) => s.model.comms)
  const selected = useMission((s) => s.selectedAgent)
  const agents = useMission((s) => s.model.agents)
  const layer = useMission((s) => s.layer)
  const ask = useMission((s) => s.ask)
  const waiting = useMission((s) => s.model.waiting)
  const askRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  useKeys(askRef)

  const subs = plan?.subtasks.filter((s) => s.status !== 'skipped') ?? []
  const running = subs.find((s) => s.status === 'running')
  const burn = matrix.filter((r) => r.status !== 'pass').length
  const panes: Record<PanelId, PaneDef> = {
    1: { id: 1, title: 'NETWORK', right: <span>via lagrange</span>, summary: `${Object.values(agents).filter((a) => a.state === 'working').length} working`, body: <NetworkView /> },
    2: { id: 2, title: 'STAGE · CM-012', right: <span>{layer}</span>, summary: layer, body: <Stage /> },
    3: { id: 3, title: `AGENT @${selected}`, right: <span>{AGENT[selected]?.name}</span>, summary: agents[selected]?.doing, body: <AgentView /> },
    4: {
      id: 4,
      title: 'PLAN',
      summary: `${subs.filter((s) => s.status === 'done').length}/${subs.length}${running ? ` · ${running.id} ${running.title}` : ''}`,
      right: <span>{subs.filter((s) => s.status === 'done').length}/{subs.length} done</span>,
      body: plan ? <PlanGraph plan={plan} /> : null,
    },
    5: { id: 5, title: 'FINDINGS', summary: matrix.length ? `${burn}/${matrix.length} burn` : 'waiting for @prevent', right: <span>{matrix.length ? `${burn}/${matrix.length} burn` : ''}</span>, body: <FindingsView /> },
    6: { id: 6, title: 'COMMS', right: <span>agent ⇄ agent · {comms.length}</span>, summary: comms.length ? comms[comms.length - 1].text : 'quiet', body: <CommsView /> },
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PanelLayout panes={panes} />
      <form
        className="flex h-8 shrink-0 items-center gap-2 border-t border-line px-3 text-[11.5px]"
        onSubmit={(e) => {
          e.preventDefault()
          ask(q)
          setQ('')
        }}
      >
        <span className="text-k-ask">›</span>
        <input ref={askRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ask the lead…" className="sans min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
        {waiting && <span className="text-warn">@{waiting.from} is waiting on you · a</span>}
        <span className="text-faint">
          {PANELS.length > 0 && '1-6 panel  +/- size  h/l agent  a answer  ? keys'}
        </span>
      </form>
      <Help />
    </div>
  )
}
