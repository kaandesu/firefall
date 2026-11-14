#!/usr/bin/env node
// Snapshots the public PSI combustion investigation metadata into data/psi/investigations.json.
// PSI's site is an Angular SPA backed by a public search API; data files themselves need a PSI login.
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'data/psi/investigations.json')
const url = 'https://psi.nasa.gov/geode-py/ws/repo/search?q=combustion&data_source=psi&data_type=investigation&size=200&from=0'

const res = await fetch(url, { headers: { 'User-Agent': 'firefall-snapshot/0.1' } })
if (!res.ok) throw new Error(`PSI search failed: ${res.status}`)
const body = await res.json()
const clean = (v) => (typeof v === 'string' ? v.replace(/\s{2,}/g, ' ').trim() : v)

// PSI flattens several people into one Person record and can't be re-paired reliably,
// so we keep the surnames (the citation-style list).
const people = (p) => (p?.['Last Name'] ?? '').split(/\s+/).filter(Boolean)
// Hardware packs several names/links into one record, joined by runs of spaces.
const hardware = (h) =>
  [h].flat().filter(Boolean).flatMap((x) => {
    const names = (x.Name ?? '').split(/\s{2,}/).map((n) => n.trim()).filter(Boolean)
    const links = (x.Link ?? '').split(/\s{2,}/).map((n) => n.trim()).filter(Boolean)
    return names.map((name, i) => ({ name, link: links[i] ?? null }))
  })

const items = body.hits.hits
  .map((h) => h._source)
  .filter((s) => /combustion/i.test(s['Research Area'] ?? ''))
  .map((s) => ({
    id: s.Accession,
    acronym: clean(s.Acronym) || null,
    title: clean(s.Title),
    investigators: people(s.Person),
    platform: clean(s['Flight Platform']) || null,
    subArea: clean(s['SubResearch Area']) || null,
    projectType: clean(s['Project Type']) || null,
    start: s['Investigation Start Date'] || null,
    end: s['Investigation End Date'] || null,
    keywords: (s.Keywords ?? '').split(/\s{2,}/).map((k) => k.trim()).filter(Boolean),
    related: (s['Related Investigations'] ?? '').split(/\s+/).filter((x) => /^PSI-\d+$/.test(x)),
    objectives: clean(s.Objectives) || null,
    approach: clean(s.Approach) || null,
    hypothesis: clean(s.Hypothesis) || null,
    impacts: clean(s['Research Impacts/Earth Benefits']) || null,
    hardware: hardware(s['Experiment Hardware']),
    publications: clean(s['Publication Title']) || null,
    thumbnail: s.Thumbnail ? `https://psi.nasa.gov${s.Thumbnail}` : null,
    url: `https://psi.nasa.gov/physci/repo/investigation/${s.Accession}`,
  }))
  .sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)))

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ fetchedAt: new Date().toISOString(), source: url, count: items.length, investigations: items }, null, 2) + '\n')
console.log(`wrote ${items.length} investigations to ${out}`)
