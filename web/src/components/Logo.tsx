// The firefall mark: a glowing orb with a dark needle, drawn as SVG so it stays sharp at any size on both finishes.
// The source artwork is public/logo.webp.
import { useId } from 'react'

export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-label="firefall">
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
      <circle cx="16" cy="16" r="12" fill="#2340ff" opacity="0.85" filter={`url(#${id}g)`} />
      <circle cx="16" cy="16" r="11.5" fill={`url(#${id}b)`} />
      <path d="M15.1 9.6a.9.9 0 0 1 1.8 0l1 13.2h-3.8z" fill="#0a0a3a" />
    </svg>
  )
}
