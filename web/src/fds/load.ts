// Load one shipped FDS run from public/data/fds/<case>/<sub>/: input, Smokeview index, CSVs, slices and smoke.
import { useEffect, useState } from 'react'
import { readFdsCsv, type FdsCsv } from './csv'
import { parseFds, type FdsInput } from './namelist'
import { readSlice, type Slice } from './slice'
import { readSmoke3D, type Smoke3D } from './smoke3d'
import { readSmv, type Smv } from './smv'
import type { FdsSummary } from './summary'

export const FDS_BASE = '/data/fds/apollo-cm012'

export type FdsManifest = {
  fds: string
  generated: string
  machine: string
  cases: {
    id: string
    label: string
    g: number
    chid: string
    runtime_s: number
    cells: number
    ijk: number[]
    dx: number
    t_end: number
    steps: number
    burner: { xb: number[]; kw: number; offAt: number; under?: string }
    surfs: { id: string; zone: string; material: string; hrrpua: number; ignitionC: number }[]
    summary: FdsSummary
  }[]
}

export type FdsRun = {
  id: string
  chid: string
  source: string
  input: FdsInput
  smv: Smv
  hrr: FdsCsv
  devc: FdsCsv
  slices: (Slice & { file: string })[]
  smoke?: Smoke3D
  fire?: Smoke3D
}

const cache = new Map<string, Promise<FdsRun>>()

async function fetchOk(url: string) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r
}

export function loadRun(id: string, chid: string): Promise<FdsRun> {
  const key = `${id}/${chid}`
  let p = cache.get(key)
  if (!p) {
    const dir = `${FDS_BASE}/${id}`
    p = (async () => {
      const [source, smvText, hrr, devc] = await Promise.all([
        fetchOk(`${dir}/${chid}.fds`).then((r) => r.text()),
        fetchOk(`${dir}/${chid}.smv`).then((r) => r.text()),
        fetchOk(`${dir}/${chid}_hrr.csv`).then((r) => r.text()),
        fetchOk(`${dir}/${chid}_devc.csv`).then((r) => r.text()),
      ])
      const smv = readSmv(smvText)
      const bin = (f: string) => fetchOk(`${dir}/${f}`).then((r) => r.arrayBuffer())
      const slices = await Promise.all(smv.files.filter((f) => f.kind === 'slice').map(async (f) => ({ ...readSlice(await bin(f.file)), file: f.file })))
      const s3d = async (q: string) => {
        const f = smv.files.find((x) => x.kind === 'smoke3d' && x.quantity === q)
        if (!f) return undefined
        try {
          return readSmoke3D(await bin(f.file))
        } catch {
          return undefined
        }
      }
      const [smoke, fire] = await Promise.all([s3d('SOOT DENSITY'), s3d('HRRPUV')])
      return { id, chid, source, input: parseFds(source), smv, hrr: readFdsCsv(hrr), devc: readFdsCsv(devc), slices, smoke, fire }
    })()
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

export function useFdsManifest() {
  const [m, setM] = useState<FdsManifest>()
  const [err, setErr] = useState<string>()
  useEffect(() => {
    fetchOk(`${FDS_BASE}/manifest.json`)
      .then((r) => r.json())
      .then(setM, (e: Error) => setErr(e.message))
  }, [])
  return { manifest: m, error: err }
}

export function useFdsRun(id?: string, chid?: string) {
  const [run, setRun] = useState<FdsRun>()
  const [err, setErr] = useState<string>()
  useEffect(() => {
    if (!id || !chid) return
    let live = true
    loadRun(id, chid).then(
      (r) => live && setRun(r),
      (e: Error) => live && setErr(e.message),
    )
    return () => {
      live = false
    }
  }, [id, chid])
  return { run: run?.id === id ? run : undefined, error: err }
}
