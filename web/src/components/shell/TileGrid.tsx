// Four tiles, any view in any tile. Focus one (it grows), maximize one (it fills), minimize to the dock.
// Director mode moves focus to whatever the crew is doing (see store.directTo).
import { ChevronDown, Crosshair, Maximize2, Minimize2, Minus } from 'lucide-react'
import { motion } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { VIEWS, useMission, type ViewId } from '@/live/store'
import { cn } from '@/lib/utils'
import { CaseView } from '@/views/CaseView'
import { CommsView } from '@/views/CommsView'
import { DossierView } from '@/views/DossierView'
import { EvidenceView } from '@/views/EvidenceView'
import { FeedView } from '@/views/FeedView'
import { OrbitView } from '@/views/OrbitView'
import { PlanView } from '@/views/PlanView'
import { SimView } from '@/views/SimView'
import { WorkspaceView } from '@/views/WorkspaceView'

const RENDER: Record<ViewId, () => ReactNode> = {
  orbit: () => <OrbitView />,
  plan: () => <PlanView />,
  comms: () => <CommsView />,
  workspace: () => <WorkspaceView />,
  evidence: () => <EvidenceView />,
  sim: () => <SimView />,
  dossier: () => <DossierView />,
  feed: () => <FeedView />,
  case: () => <CaseView />,
}

function areas(visible: number[], focus: number | null): { grid: CSSProperties; place: Record<number, CSSProperties> } {
  const n = visible.length
  const place: Record<number, CSSProperties> = {}
  if (n === 0) return { grid: {}, place }
  if (n === 1) {
    place[visible[0]] = { gridColumn: '1', gridRow: '1' }
    return { grid: { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }, place }
  }
  const f = focus !== null && visible.includes(focus) ? focus : null
  if (n === 2) {
    visible.forEach((v, i) => (place[v] = { gridColumn: String(i + 1), gridRow: '1' }))
    const cols = visible.map((v) => (v === f ? '1.7fr' : '1fr')).join(' ')
    return { grid: { gridTemplateColumns: cols, gridTemplateRows: '1fr' }, place }
  }
  if (n === 4 && f === null) {
    visible.forEach((v, i) => (place[v] = { gridColumn: String((i % 2) + 1), gridRow: String(Math.floor(i / 2) + 1) }))
    return { grid: { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }, place }
  }
  // One big tile on the left, the rest stacked on the right.
  const big = f ?? visible[0]
  const rest = visible.filter((v) => v !== big)
  place[big] = { gridColumn: '1', gridRow: `1 / span ${rest.length}` }
  rest.forEach((v, i) => (place[v] = { gridColumn: '2', gridRow: String(i + 1) }))
  return { grid: { gridTemplateColumns: f !== null ? '2.1fr 1fr' : '1.4fr 1fr', gridTemplateRows: `repeat(${rest.length}, 1fr)` }, place }
}

export function TileGrid() {
  const tiles = useMission((s) => s.tiles)
  const focus = useMission((s) => s.focus)
  const max = useMission((s) => s.max)
  const minimized = useMission((s) => s.minimized)
  const visible = max !== null ? [max] : [0, 1, 2, 3].filter((i) => !minimized.includes(i))
  const { grid, place } = areas(visible, focus)
  return (
    <div className="grid min-h-0 flex-1 gap-2" style={grid}>
      {visible.map((i) => (
        <Tile key={`${i}-${tiles[i]}`} index={i} view={tiles[i]} style={place[i]} focused={focus === i} maxed={max === i} />
      ))}
    </div>
  )
}

function Tile({ index, view, style, focused, maxed }: { index: number; view: ViewId; style: CSSProperties; focused: boolean; maxed: boolean }) {
  const setTile = useMission((s) => s.setTile)
  const toggleFocus = useMission((s) => s.toggleFocus)
  const toggleMax = useMission((s) => s.toggleMax)
  const minimize = useMission((s) => s.minimize)
  const label = VIEWS.find((v) => v.id === view)?.label
  return (
    <motion.section
      layout="position"
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      style={style}
      className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-surface/80 backdrop-blur', focused ? 'border-ug/45 glow-ug' : 'border-line')}
    >
      <header className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-semibold hover:bg-surface-3">
            {label}
            <ChevronDown size={12} className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-36">
            {VIEWS.map((v) => (
              <DropdownMenuItem key={v.id} onClick={() => setTile(index, v.id)} className={cn('text-xs', v.id === view && 'text-ug')}>
                {v.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center">
          <TileBtn title={focused ? 'Unfocus' : 'Focus'} onClick={() => toggleFocus(index)} active={focused}>
            <Crosshair size={12} />
          </TileBtn>
          <TileBtn title={maxed ? 'Restore' : 'Maximize'} onClick={() => toggleMax(index)} active={maxed}>
            {maxed ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </TileBtn>
          <TileBtn title="Minimize" onClick={() => minimize(index)}>
            <Minus size={12} />
          </TileBtn>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">{RENDER[view]()}</div>
    </motion.section>
  )
}

function TileBtn({ children, onClick, title, active }: { children: ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick} className={cn('rounded p-1 transition hover:bg-surface-3', active ? 'text-ug' : 'text-muted-foreground hover:text-ink')}>
      {children}
    </button>
  )
}

export function Dock() {
  const tiles = useMission((s) => s.tiles)
  const minimized = useMission((s) => s.minimized)
  const restore = useMission((s) => s.restore)
  if (!minimized.length) return null
  return (
    <div className="flex items-center gap-1">
      {minimized.map((i) => (
        <button key={i} type="button" onClick={() => restore(i)} className="mono rounded-md border border-line bg-surface-2 px-2 py-1 text-[10.5px] text-muted-foreground hover:border-line-2 hover:text-ink">
          {VIEWS.find((v) => v.id === tiles[i])?.label} ↑
        </button>
      ))}
    </div>
  )
}
