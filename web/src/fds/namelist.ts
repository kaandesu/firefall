// FDS input (.fds) namelist parser for the groups the viewer draws: HEAD, TIME, MISC, MESH, OBST, VENT, SURF, MATL,
// REAC, SPEC, DEVC, PROP, SLCF, RAMP. Records are `&NAME key=value, … /`, can span lines, and `/` inside quotes
// does not end a record. Text outside records is a comment. Ported in spirit from fds-viewer js/fds-parser.js
// (MIT, Prof Rino Lovreglio); MULT expansion is not supported.
export type Value = string | number | boolean
export type Params = Record<string, Value | Value[]>
export type NamelistRecord = { group: string; params: Params; line: number }

export type FdsInput = {
  records: NamelistRecord[]
  head: Params
  time: Params
  misc: Params
  meshes: { ijk: number[]; xb: number[] }[]
  obsts: { id?: string; xb: number[]; surf?: string; surfs?: string[] }[]
  vents: { id?: string; xb?: number[]; mb?: string; surf?: string }[]
  surfs: Record<string, Params>
  devcs: { id: string; xyz?: number[]; quantity?: string; prop?: string }[]
  props: Record<string, Params>
  slcfs: Params[]
}

function records(text: string): NamelistRecord[] {
  const out: NamelistRecord[] = []
  let i = 0
  while (i < text.length) {
    // A record starts with `&` as the first non-blank character of a line.
    const m = /(^|\n)[ \t]*&/g
    m.lastIndex = i
    const hit = m.exec(text)
    if (!hit) break
    const amp = hit.index + hit[0].length - 1
    let e = amp + 1
    while (e < text.length && /\w/.test(text[e])) e++
    const group = text.slice(amp + 1, e).toUpperCase()
    let j = e, sq = false, dq = false
    while (j < text.length) {
      const c = text[j]
      if (c === "'" && !dq) sq = !sq
      else if (c === '"' && !sq) dq = !dq
      else if (c === '/' && !sq && !dq) break
      j++
    }
    if (group && j < text.length) {
      const line = text.slice(0, amp).split('\n').length
      if (group !== 'TAIL') out.push({ group, params: body(text.slice(e, j)), line })
    }
    i = j + 1
  }
  return out
}

function scalar(s: string): Value {
  const t = s.trim()
  if (/^'.*'$|^".*"$/s.test(t)) return t.slice(1, -1)
  if (/^\.?t(rue)?\.?$/i.test(t)) return true
  if (/^\.?f(alse)?\.?$/i.test(t)) return false
  const n = Number(t.replace(/d/i, 'e'))
  return Number.isFinite(n) && t !== '' ? n : t
}

function body(b: string): Params {
  // Tokens: quoted strings, or runs without commas/whitespace/equals; keep `=` as its own token.
  const toks = b.match(/'[^']*'|"[^"]*"|=|[^\s,=]+/g) ?? []
  const params: Params = {}
  let key: string | undefined
  let vals: Value[] = []
  const commit = () => {
    if (key) params[key] = vals.length === 1 ? vals[0] : vals
  }
  for (let i = 0; i < toks.length; i++) {
    if (toks[i + 1] === '=') {
      commit()
      key = toks[i].toUpperCase().replace(/\(.*\)$/, '')
      vals = []
      i++
    } else if (key) vals.push(scalar(toks[i]))
  }
  commit()
  return params
}

const nums = (v: Value | Value[] | undefined) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map(Number)
const strs = (v: Value | Value[] | undefined) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map(String)
const s1 = (v: Value | Value[] | undefined) => (v === undefined ? undefined : String(Array.isArray(v) ? v[0] : v))

export function parseFds(text: string): FdsInput {
  const recs = records(text.replace(/\r\n?/g, '\n'))
  const one = (g: string) => recs.find((r) => r.group === g)?.params ?? {}
  const all = (g: string) => recs.filter((r) => r.group === g).map((r) => r.params)
  const byId = (g: string) => Object.fromEntries(all(g).map((p) => [String(p.ID), p]))
  return {
    records: recs,
    head: one('HEAD'),
    time: one('TIME'),
    misc: one('MISC'),
    meshes: all('MESH').map((p) => ({ ijk: nums(p.IJK), xb: nums(p.XB) })),
    obsts: all('OBST').map((p) => ({ id: s1(p.ID), xb: nums(p.XB), surf: s1(p.SURF_ID), surfs: p.SURF_IDS ? strs(p.SURF_IDS) : undefined })),
    vents: all('VENT').map((p) => ({ id: s1(p.ID), xb: p.XB ? nums(p.XB) : undefined, mb: s1(p.MB), surf: s1(p.SURF_ID) })),
    surfs: byId('SURF'),
    devcs: all('DEVC').map((p) => ({ id: String(p.ID), xyz: p.XYZ ? nums(p.XYZ) : undefined, quantity: s1(p.QUANTITY), prop: s1(p.PROP_ID) })),
    props: byId('PROP'),
    slcfs: all('SLCF'),
  }
}

/** FDS named colours used by the generator, as hex. Others fall back to grey. */
export const FDS_COLORS: Record<string, string> = {
  ORANGE: '#ffa500', KHAKI: '#f0e68c', 'LIGHT BLUE': '#add8e6', GOLD: '#ffd700', 'DARK ORANGE': '#ff8c00', WHITE: '#f5f5f5',
  PINK: '#ffc0cb', RED: '#ff3030', 'GRAY 60': '#999999', 'GRAY 40': '#666666', INERT: '#cccccc',
}
