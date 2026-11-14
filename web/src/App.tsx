import { useEffect } from 'react'
import { CommandBar } from '@/components/shell/CommandBar'
import { Roster } from '@/components/shell/Roster'
import { TileGrid } from '@/components/shell/TileGrid'
import { TopBar } from '@/components/shell/TopBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMission } from '@/live/store'
import { BriefView } from '@/views/BriefView'

export default function App() {
  const load = useMission((s) => s.load)
  useEffect(() => {
    // Deep links for the pitch: ?run=habitat|incident|apollo1&autoplay=1&speed=4&brief=1
    const q = new URLSearchParams(location.search)
    const run = q.get('run')
    load(run === 'incident' || run === 'apollo1' ? run : 'habitat', q.get('autoplay') === '1')
    if (q.get('speed')) useMission.getState().setSpeed(Number(q.get('speed')))
    if (q.get('brief') === '1') useMission.getState().setBrief(true)
  }, [load])
  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <Roster />
          <main className="flex min-w-0 flex-1 flex-col p-2">
            <TileGrid />
          </main>
        </div>
        <CommandBar />
      </div>
      <BriefView />
    </TooltipProvider>
  )
}
