// The cabin intro over the plan screen: plays once when a review starts, skippable (Esc, Enter or the button).
// The lead is already drafting the plan underneath; nothing runs before you approve it.
// Driven by our own clock through Remotion's Thumbnail (frameToDisplay): the composition stays a pure function of
// the frame, and playback never stalls on the player's buffering.
import { Thumbnail } from '@remotion/player'
import { SkipForward } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMission } from '@/live/store'
import { INTRO_FPS, IntroComp, introFrames } from '@/stage/IntroComp'

export function IntroScreen() {
  const pkg = useMission((s) => s.pkg)
  const cabin = useMission((s) => s.cabin)
  const skip = useMission((s) => s.skipIntro)
  const total = pkg && cabin ? introFrames(cabin, pkg) : 0
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!total) return
    const t0 = performance.now()
    let raf = 0
    const tick = () => {
      const f = Math.floor(((performance.now() - t0) / 1000) * INTRO_FPS)
      if (f >= total) return skip()
      setFrame(f)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [total, skip])
  useEffect(() => {
    const k = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && skip()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [skip])

  if (!pkg || !cabin) return null
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-viewport">
      <Thumbnail component={IntroComp} inputProps={{ model: cabin, pkg }} durationInFrames={total} fps={INTRO_FPS} compositionWidth={1600} compositionHeight={940} frameToDisplay={Math.min(frame, total - 1)} style={{ width: '100%', height: '100%' }} />
      <button type="button" onClick={skip} className="absolute right-5 top-4 flex items-center gap-1.5 rounded-sm border border-line-2 bg-surface/80 px-2.5 py-1 text-body text-muted-foreground hover:text-ink">
        <SkipForward size={12} /> skip to the plan <span className="kbd">esc</span>
      </button>
    </div>
  )
}
