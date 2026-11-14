// The Smokeview index (.smv): which slice/smoke3d file holds which quantity on which mesh. Minimal reader.
export type SmvFile = { kind: 'slice' | 'smoke3d'; file: string; quantity: string; shortName: string; units: string; mesh: number; ijk?: number[] }
export type Smv = { chid: string; version: string; grid: number[]; pdim: number[]; files: SmvFile[]; csv: Record<string, string> }

export function readSmv(text: string): Smv {
  const L = text.split(/\r?\n/)
  const out: Smv = { chid: '', version: '', grid: [], pdim: [], files: [], csv: {} }
  for (let i = 0; i < L.length; i++) {
    const key = L[i].trim().split(/\s+/)[0]
    const nums = (s: string) => s.trim().split(/\s+/).map(Number)
    if (key === 'CHID') out.chid = L[i + 1].trim()
    else if (key === 'FDSVERSION') out.version = L[i + 1].trim()
    else if (key === 'GRID' && !out.grid.length) out.grid = nums(L[i + 1]).slice(0, 3)
    else if (key === 'PDIM' && !out.pdim.length) out.pdim = nums(L[i + 1]).slice(0, 6)
    else if (key === 'CSVF') out.csv[L[i + 1].trim()] = L[i + 2].trim()
    else if (key === 'SLCF' || key === 'SMOKF3D' || key === 'SMOKG3D') {
      const head = L[i].trim().split(/\s+/)
      const amp = L[i].indexOf('&')
      const ijk = key === 'SLCF' && amp >= 0 ? nums(L[i].slice(amp + 1).split('!')[0]) : undefined
      out.files.push({ kind: key === 'SLCF' ? 'slice' : 'smoke3d', file: L[i + 1].trim(), quantity: L[i + 2].trim(), shortName: L[i + 3].trim(), units: L[i + 4].trim(), mesh: Number(head[1]), ijk })
    }
  }
  return out
}
