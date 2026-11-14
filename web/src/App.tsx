import { useEffect, useRef } from 'react'
import { Group, Panel, Separator, type PanelImperativeHandle } from 'react-resizable-panels'
import { CenterPanel } from '@/components/shell/CenterPanel'
import { ChatPanel } from '@/components/shell/ChatPanel'
import { LeftPanel } from '@/components/shell/LeftPanel'
import { TopBar } from '@/components/shell/TopBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMission } from '@/live/store'

function Handle() {
  return <Separator className="relative w-1.5 -mx-[3px] z-10 bg-transparent outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-line after:transition-colors hover:after:w-0.5 hover:after:bg-primary/60" />
}

export default function App() {
  const load = useMission((s) => s.load)
  const chatOpen = useMission((s) => s.chatOpen)
  const chat = useRef<PanelImperativeHandle>(null)

  useEffect(() => {
    // Deep links: ?run=habitat|incident|apollo1&autoplay=1&speed=4
    const q = new URLSearchParams(location.search)
    const run = q.get('run')
    if (q.get('speed')) useMission.getState().setSpeed(Number(q.get('speed')))
    load(run === 'incident' || run === 'apollo1' ? run : 'habitat', q.get('autoplay') === '1')
  }, [load])

  useEffect(() => {
    const p = chat.current
    if (!p) return
    if (chatOpen && p.isCollapsed()) p.expand()
    if (!chatOpen && !p.isCollapsed()) p.collapse()
  }, [chatOpen])

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full flex-col">
        <TopBar />
        <Group orientation="horizontal" className="min-h-0 flex-1">
          <Panel id="left" defaultSize={290} minSize={220} maxSize={420} collapsible collapsedSize={0}>
            <LeftPanel />
          </Panel>
          <Handle />
          <Panel id="center" minSize={420}>
            <CenterPanel />
          </Panel>
          <Handle />
          <Panel
            id="chat"
            panelRef={chat}
            defaultSize={360}
            minSize={280}
            maxSize={560}
            collapsible
            collapsedSize={0}
            onResize={(size) => {
              const open = size.inPixels > 0
              if (open !== useMission.getState().chatOpen) useMission.getState().setChatOpen(open)
            }}
          >
            <ChatPanel />
          </Panel>
        </Group>
      </div>
    </TooltipProvider>
  )
}
