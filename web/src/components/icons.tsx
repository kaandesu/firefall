// firefall's own pictograms: simple geometry on a 16-unit grid, one stroke weight, round caps,
// like the glyphs printed on hardware keys. Drop-in for the lucide icons they replace (size, className).
import type { ReactNode, SVGProps } from 'react'

type P = { size?: number; className?: string; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'children'>

function glyph(paths: ReactNode) {
  return function Glyph({ size = 16, className, strokeWidth = 1.5, ...rest }: P) {
    return (
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
        {...rest}
      >
        {paths}
      </svg>
    )
  }
}

/** Review lead: a ring with a centre point (the one who holds the plan). */
export const LeadGlyph = glyph(
  <>
    <circle cx="8" cy="8" r="5.5" />
    <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
  </>,
)
/** Archive / research: three stacked records. */
export const ArchiveGlyph = glyph(
  <>
    <rect x="2.5" y="2.5" width="11" height="3" rx="1" />
    <rect x="2.5" y="6.5" width="11" height="3" rx="1" />
    <rect x="2.5" y="10.5" width="11" height="3" rx="1" />
  </>,
)
/** Materials: a hexagon (a molecule, a sample). */
export const MaterialGlyph = glyph(<path d="M8 2 13.2 5v6L8 14 2.8 11V5Z" />)
/** Detection: a point with two arcs. */
export const DetectGlyph = glyph(
  <>
    <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <path d="M4 7.5a4.5 4.5 0 0 1 4.5 4.5" />
    <path d="M4 3a9 9 0 0 1 9 9" />
  </>,
)
/** Suppression: a drop. */
export const DropGlyph = glyph(<path d="M8 2.2c2.6 3.2 4.3 5.6 4.3 7.6A4.3 4.3 0 0 1 3.7 9.8c0-2 1.7-4.4 4.3-7.6Z" />)
/** Simulation: an isometric cube. */
export const SimGlyph = glyph(
  <>
    <path d="M8 2 13.5 5v6L8 14 2.5 11V5Z" />
    <path d="M2.5 5 8 8l5.5-3M8 8v6" />
  </>,
)
/** Safety assurance: a shield with a tick. */
export const ShieldGlyph = glyph(
  <>
    <path d="M8 2 13 4v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4Z" />
    <path d="m5.8 8.2 1.6 1.6 3-3.2" />
  </>,
)
/** Report: a page with two lines. */
export const PageGlyph = glyph(
  <>
    <rect x="3.5" y="2" width="9" height="12" rx="1.5" />
    <path d="M6 6h4M6 9h4" />
  </>,
)
/** Lab / chamber: a square chamber with a flame point inside. */
export const ChamberGlyph = glyph(
  <>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
    <path d="M8 11.2c-1.4 0-2.2-.9-2.2-2 0-1.2 1-2 2.2-4 1.2 2 2.2 2.8 2.2 4 0 1.1-.8 2-2.2 2Z" />
  </>,
)
/** Network hub: three nodes joined to a centre. */
export const HubGlyph = glyph(
  <>
    <circle cx="8" cy="8" r="1.8" />
    <circle cx="8" cy="2.6" r="1.2" />
    <circle cx="3.2" cy="11.4" r="1.2" />
    <circle cx="12.8" cy="11.4" r="1.2" />
    <path d="M8 3.8v2.4M4.2 10.8l2.3-1.6M11.8 10.8 9.5 9.2" />
  </>,
)
/** A person: a head over shoulders. */
export const PersonGlyph = glyph(
  <>
    <circle cx="8" cy="5.5" r="2.6" />
    <path d="M3 14c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3" />
  </>,
)
/** A checklist (a task card). */
export const TaskGlyph = glyph(
  <>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <path d="m5 6 1.2 1.2L8.5 5M5 10.5h6" />
  </>,
)
