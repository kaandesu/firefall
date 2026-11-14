// Halo's panel layout for the run screen: numbered box-frame panels that step through
// bar → normal → column → full with + / − (or the buttons in each title). Sizing follows
// halo/internal/tui/ui.go: growing one panel puts every other grown panel back to normal,
// moving the focus does the same, a bar stays a bar until you grow it.
import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { LADDER, useMission, type PanelId, type Size } from '@/live/store'
import { cn } from '@/lib/utils'

export type PaneDef = {
  id: PanelId
  title: string
  /** Right-hand note in the title line. */
  right?: ReactNode
  /** What the one-line bar shows when the panel is minimised. */
  summary?: ReactNode
  body: ReactNode
}

export function Pane({ def, size, vertical = false }: { def: PaneDef; size: Size; vertical?: boolean }) {
  const focus = useMission((s) => s.focus === def.id)
  const focusPanel = useMission((s) => s.focusPanel)
  const grow = useMission((s) => s.grow)
  const i = LADDER.indexOf(size)

  if (size === 'bar') {
    return (
      <button
        type="button"
        onClick={() => grow(1, def.id)}
        data-focus={focus}
        className={cn(
          'key group shrink-0 overflow-hidden text-left',
          vertical ? 'w-[34px] flex-col items-center justify-start rounded-[12px] py-2.5' : 'h-[32px] flex-row items-center justify-start gap-2 rounded-[10px] px-2.5',
        )}
        title={`${def.id} ${def.title} · click or + to open`}
      >
        {vertical ? (
          <span className="flex items-center gap-2 whitespace-nowrap text-[11.5px] [writing-mode:vertical-rl]">
            <span className={cn('tnum font-medium', focus ? 'text-orange' : 'text-faint')}>{def.id}</span>
            <span className="lowercase text-ink">{def.title}</span>
          </span>
        ) : (
          <>
            <span className={cn('tnum text-[12px] font-medium', focus ? 'text-orange' : 'text-faint')}>{def.id}</span>
            <span className="text-[11.5px] lowercase text-ink">{def.title}</span>
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">{def.summary}</span>
            <span className="ml-auto text-faint group-hover:text-orange">+</span>
          </>
        )}
      </button>
    )
  }

  return (
    <section data-focus={focus} className="pane flex-1" onMouseDown={() => !focus && focusPanel(def.id)}>
      <header className="pane-head shrink-0 px-3 pt-2.5 text-[11.5px]">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'tnum flex size-[20px] items-center justify-center rounded-full text-[11px] font-medium',
              focus ? 'bg-orange text-white' : 'bg-surface-3 text-muted-foreground',
            )}
          >
            {def.id}
          </span>
          <span className="font-medium text-ink">{def.title}</span>
        </span>
        <span className="ml-auto flex items-center gap-2 text-faint">
          {def.right}
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => grow(-1, def.id)} disabled={i === 0} className="key size-[20px] rounded-full p-0" title="shrink (−)">
              <Minus size={10} />
            </button>
            <span className="w-[44px] text-center text-[10px] lowercase">{size}</span>
            <button type="button" onClick={() => grow(1, def.id)} disabled={i === LADDER.length - 1} className="key size-[20px] rounded-full p-0" title="grow (+)">
              <Plus size={10} />
            </button>
          </span>
        </span>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden pt-1.5">{def.body}</div>
    </section>
  )
}

const TOP_WEIGHT: Record<number, number> = { 1: 3, 2: 5, 3: 3 }

/** Lays the six panels out: three columns on top, lab and findings in the middle, comms as a strip. */
export function PanelLayout({ panes }: { panes: Record<PanelId, PaneDef> }) {
  const sizes = useMission((s) => s.sizes)
  const full = (Object.keys(sizes).map(Number) as PanelId[]).find((id) => sizes[id] === 'full')
  if (full) {
    return (
      <div className="flex min-h-0 flex-1 p-2.5">
        <Pane def={panes[full]} size="full" />
      </div>
    )
  }

  // A top panel grown to its column takes the height of the rows below too: they drop to bars.
  const topColumn = ([1, 2, 3] as PanelId[]).some((id) => sizes[id] === 'column')
  const eff = (id: PanelId): Size => (topColumn && id >= 4 ? 'bar' : sizes[id])
  const mid = [eff(4), eff(5)]
  const midOpen = mid.some((z) => z !== 'bar')
  const midH = mid.includes('column') ? '58%' : '40%'
  const comms = eff(6)
  const commsH = comms === 'column' ? '46%' : '17%'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-2.5">
      <div className="flex min-h-0 flex-1 gap-2.5">
        {([1, 2, 3] as PanelId[]).map((id) =>
          sizes[id] === 'bar' ? (
            <Pane key={id} def={panes[id]} size="bar" vertical />
          ) : (
            <div key={id} className="flex min-w-0" style={{ flex: `${TOP_WEIGHT[id] * (sizes[id] === 'column' ? 2.2 : 1)} 1 0` }}>
              <Pane def={panes[id]} size={sizes[id]} />
            </div>
          ),
        )}
      </div>
      <div className={cn('flex shrink-0 gap-2.5', midOpen ? 'items-stretch' : 'items-center')} style={midOpen ? { height: midH } : undefined}>
        {([4, 5] as PanelId[]).map((id) =>
          eff(id) === 'bar' ? (
            <div key={id} className={cn('flex min-w-0', midOpen ? 'w-[230px] shrink-0 self-start' : 'flex-1')}>
              <div className="flex min-w-0 flex-1 flex-col">
                <Pane def={panes[id]} size="bar" />
              </div>
            </div>
          ) : (
            <div key={id} className="flex min-w-0" style={{ flex: `${id === 4 ? 3 : 2} 1 0` }}>
              <Pane def={panes[id]} size={eff(id)} />
            </div>
          ),
        )}
      </div>
      {comms === 'bar' ? (
        <Pane def={panes[6]} size="bar" />
      ) : (
        <div className="flex shrink-0" style={{ height: commsH }}>
          <Pane def={panes[6]} size={comms} />
        </div>
      )}
    </div>
  )
}
