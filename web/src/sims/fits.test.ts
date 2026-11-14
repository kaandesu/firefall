import { describe, expect, it } from 'vitest'
import { FITS, lsq } from './fits'

describe('published-data fits', () => {
  it('lsq recovers a line', () => {
    const [a, b] = lsq([[1, 0], [1, 1], [1, 2]], [1, 3, 5])
    expect(a).toBeCloseTo(1)
    expect(b).toBeCloseTo(2)
  })
  it('every fit reports residuals and does at least as well as the uncalibrated model', () => {
    for (const f of Object.values(FITS)) {
      expect(f.points.length).toBeGreaterThanOrEqual(3)
      expect(Number.isFinite(f.rmsFit)).toBe(true)
      expect(f.rmsFit).toBeLessThanOrEqual(f.rmsModel + 1e-9)
    }
  })
  it('FLEX burning rate grows with oxygen', () => {
    expect(FITS.droplet.params.n).toBeGreaterThan(0)
  })
})
