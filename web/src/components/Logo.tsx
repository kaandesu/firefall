// The firefall mark and the instruments built from it. The logo is an orb with a dark needle, so the same
// drawing doubles as the app's gauge: the needle turns to show a reading. Source artwork: public/logo.webp.
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

function OrbDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f08aa6" />
        <stop offset="0.45" stopColor="#5a2fd6" />
        <stop offset="1" stopColor="#1a2cff" />
      </linearGradient>
      <filter id={`${id}g`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </defs>
  )
}

/**
 * The logo. It is never quite still: a soft highlight drifts across the top, the blue band rises and falls inside
 * the orb and the glow breathes, each on its own loop length so the motion never visibly repeats. `busy` makes the
 * glow breathe harder (something is being worked on). `still` turns the motion off (tiny sizes, print).
 */
export function Logo({ size = 24, busy = false, dim = false, still = false, className }: { size?: number; busy?: boolean; dim?: boolean; still?: boolean; className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={cn('shrink-0 overflow-visible', !still && 'orb-alive', busy && 'orb-busy', dim && 'opacity-45 grayscale-[0.4]', className)} aria-label="firefall">
      <OrbDefs id={id} />
      <defs>
        <clipPath id={`${id}c`}>
          <circle cx="16" cy="16" r="11.5" />
        </clipPath>
        <filter id={`${id}s`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>
      <circle className="orb-glow" cx="16" cy="16" r="12" fill="#2340ff" opacity="0.85" filter={`url(#${id}g)`} />
      <circle cx="16" cy="16" r="11.5" fill={`url(#${id}b)`} />
      <g clipPath={`url(#${id}c)`}>
        {/* the deep blue band, slowly rising and falling */}
        <ellipse className="orb-band" cx="16" cy="21" rx="13" ry="4.2" fill="#1a2cff" opacity="0.55" filter={`url(#${id}s)`} />
        {/* the light on the cap, drifting side to side */}
        <ellipse className="orb-shine" cx="16" cy="7.4" rx="6.5" ry="2.6" fill="#ffd6e3" opacity="0.45" filter={`url(#${id}s)`} />
      </g>
      <path d="M15.1 9.6a.9.9 0 0 1 1.8 0l1 13.2h-3.8z" fill="#0a0a3a" />
    </svg>
  )
}

const A0 = -135
const SWEEP = 270
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [16 + r * Math.cos(a), 16 + r * Math.sin(a)] as const
}
const arc = (r: number, from: number, to: number) => {
  const [x0, y0] = polar(r, from)
  const [x1, y1] = polar(r, to)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/**
 * A reading on the logo: the orb is the dial face, its needle points at `value` (0..1) across a 270° scale.
 * `mark` puts a pink tick on the scale (a limit, a tested maximum). `over` draws the scale past the mark in pink.
 */
export function Gauge({ value, mark, size = 30, busy = false, title }: { value: number; mark?: number; size?: number; busy?: boolean; title?: string }) {
  const id = useId()
  const v = Math.max(0, Math.min(1, value))
  const deg = A0 + v * SWEEP
  const m = mark === undefined ? undefined : A0 + Math.max(0, Math.min(1, mark)) * SWEEP
  const over = m !== undefined && deg > m
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={cn('shrink-0 overflow-visible', busy && 'orb-busy')} role="img" aria-label={title}>
      {title && <title>{title}</title>}
      <OrbDefs id={id} />
      <path d={arc(14.6, A0, A0 + SWEEP)} fill="none" stroke="var(--line-2)" strokeWidth="1.6" strokeLinecap="round" />
      {v > 0.001 && <path d={arc(14.6, A0, over ? m! : deg)} fill="none" stroke="var(--you)" strokeWidth="1.6" strokeLinecap="round" />}
      {over && <path d={arc(14.6, m!, deg)} fill="none" stroke="var(--pink)" strokeWidth="1.6" strokeLinecap="round" />}
      {m !== undefined && <path d={`M ${polar(12.4, m).join(' ')} L ${polar(16.8, m).join(' ')}`} stroke="var(--pink)" strokeWidth="1.4" strokeLinecap="round" />}
      <circle className="orb-glow" cx="16" cy="16" r="10" fill="#2340ff" opacity="0.7" filter={`url(#${id}g)`} />
      <circle cx="16" cy="16" r="9.6" fill={`url(#${id}b)`} />
      <path className="gauge-needle" d="M15.05 17.6 L15.45 9.4 a.55.55 0 0 1 1.1 0 L16.95 17.6 Z" fill="#0a0a3a" style={{ transform: `rotate(${deg}deg)` }} />
    </svg>
  )
}

/** A measured number on a small black display: value in the dot-matrix face, unit beside it. */
export function Reading({ v, u, color, size = 13, className, title }: { v: ReactNode; u?: ReactNode; color?: string; size?: number; className?: string; title?: string }) {
  return (
    <span className={cn('lcd reading', className)} style={{ fontSize: size }} title={title}>
      <span className="v" style={color ? { color } : undefined}>
        {v}
      </span>
      {u && <span className="u">{u}</span>}
    </span>
  )
}

/** Empty or waiting state: the orb, quiet or breathing, with a line of text. */
export function OrbNote({ busy = false, children, className }: { busy?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2.5 p-6 text-center text-body text-faint', className)}>
      <Logo size={busy ? 30 : 26} busy={busy} dim={!busy} />
      <div className="max-w-[300px] leading-snug">{children}</div>
    </div>
  )
}

/**
 * Burn severity as heat: comfortable margins stay graphite, thin margins warm to orange,
 * and the worst burners run hot to the logo's pink. `margin` is limit − cabin, in O₂ fraction.
 */
export function heat(margin: number) {
  if (margin >= 0.1) return 'var(--graphite)'
  if (margin >= 0) return 'color-mix(in oklab, var(--graphite) 50%, var(--orange))'
  const t = Math.min(1, -margin / 0.8)
  return `color-mix(in oklab, var(--orange) ${Math.round((1 - t) * 100)}%, var(--pink))`
}
