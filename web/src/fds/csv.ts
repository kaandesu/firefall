// FDS CSV outputs (_devc.csv, _hrr.csv): a units row, a names row, then numbers.
export type FdsCsv = { units: string[]; names: string[]; cols: Record<string, number[]> }

export function readFdsCsv(text: string): FdsCsv {
  const lines = text.trim().split(/\r?\n/)
  const split = (l: string) => l.split(',').map((s) => s.trim().replace(/^"|"$/g, ''))
  const units = split(lines[0])
  const names = split(lines[1])
  const cols: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]))
  for (const l of lines.slice(2)) {
    const v = split(l)
    names.forEach((n, i) => cols[n].push(Number(v[i])))
  }
  return { units, names, cols }
}

/** First time a column reaches `level` (linear interpolation), or undefined. */
export function firstCrossing(t: number[], y: number[], level: number): number | undefined {
  for (let i = 1; i < y.length; i++) {
    if (y[i - 1] < level && y[i] >= level) return t[i - 1] + ((level - y[i - 1]) / (y[i] - y[i - 1])) * (t[i] - t[i - 1])
  }
  return y[0] >= level ? t[0] : undefined
}
