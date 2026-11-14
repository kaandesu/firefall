// Spacecraft fire / smoke history for the pitch. `verified` = we read a NASA / primary-press source;
// `team` = from the team's research list, still to be checked against a primary source before the pitch.
export type Incident = {
  year: string
  where: string
  what: string
  fix: string
  kind: 'fire' | 'smoke' | 'false-alarm' | 'explosion'
  status: 'verified' | 'team'
  source?: { label: string; url: string }
  caseFile?: string
}

export const INCIDENTS: Incident[] = [
  { year: '1967', where: 'Apollo 1 · pad', what: 'Fire in 100 % O₂ at 16.7 psia; three crew lost. Combustibles next to ignition sources; hatch could not open.', fix: 'Restrict combustibles, outward hatch, no pure-O₂ pad cabin.', kind: 'fire', status: 'verified', source: { label: 'Apollo 204 Review Board', url: 'https://www.nasa.gov/missions/apollo/apollo-1/apollo-204-review-board-summary/' }, caseFile: 'apollo1' },
  { year: '1970', where: 'Apollo 13', what: 'O₂ tank short circuit and explosion; lunar module used as a lifeboat.', fix: 'Tank redesign before Apollo 14.', kind: 'explosion', status: 'verified', source: { label: 'AIP', url: 'https://ww2.aip.org/inside-science/apollo-13s-successful-failure' } },
  { year: '1971–78', where: 'Salyut 1 · Salyut 6', what: 'Smoke from a fan failure and electrical faults; one electrical fire fought with a water extinguisher.', fix: 'De-power affected equipment.', kind: 'smoke', status: 'team', source: { label: 'NASA SMA significant incidents', url: 'https://sma.nasa.gov/SignificantIncidents/assets/2018/SignificantIncidents_Zcard2018.pdf' } },
  { year: '1983–91', where: 'Space Shuttle', what: 'Several smoke events: blown wire fuse, short circuit, overheated resistor, failed fan.', fix: 'Locate source, remove power.', kind: 'smoke', status: 'team' },
  { year: '1997', where: 'Mir · Kvant-1', what: 'Solid-fuel O₂ generator fire: flames, sparks, heavy smoke. ~14 min per Linenger (official: 90 s). Extinguishers kicked like thrusters.', fix: 'Containment shields on ISS O₂ canisters; new crew/ground training.', kind: 'fire', status: 'verified', source: { label: 'NASA SMA · Trial by fire', url: 'https://sma.nasa.gov/news/safety-messages/safety-message-item/trial-by-fire' } },
  { year: '2005–08', where: 'ISS', what: 'Burning smells and smoke: a faulty lamp, a smouldering polymer bushing. Some smoke too faint for detectors — noticed by smell.', fix: 'Isolate equipment, sample atmosphere.', kind: 'smoke', status: 'verified', source: { label: 'Universe Today', url: 'https://www.universetoday.com/articles/fire-how-the-mir-incident-changed-space-station-safety' } },
  { year: '2009', where: 'ISS · Columbus', what: 'False depressurisation signal shut fans; stirred-up dust triggered a smoke alarm.', fix: 'Dust vs smoke discrimination (cf. DAFT).', kind: 'false-alarm', status: 'verified', source: { label: 'Poisk / ISS records', url: 'https://en.wikipedia.org/wiki/Poisk_(ISS_module)' } },
  { year: '2021', where: 'ISS · Zvezda', what: 'Smoke and burnt-plastic smell during battery charging; cause not disclosed.', fix: 'Air filters on, air sampled, module inspected.', kind: 'smoke', status: 'verified', source: { label: 'CBS News', url: 'https://www.cbsnews.com/news/space-station-smoke-burning-russian-zvezda/' } },
  { year: '2024', where: 'ISS · payload', what: 'Smoke detector false fire indication from foreign-object debris.', fix: 'Air measurements; detector cleaning.', kind: 'false-alarm', status: 'team' },
  { year: '2026', where: 'Artemis II · Orion', what: 'Smoke alarm ~80,000 miles from Earth; ventilation and power auto-shut. Cause not public.', fix: 'Crew reconfigured systems in minutes.', kind: 'smoke', status: 'verified', source: { label: 'SpacePolicyOnline', url: 'https://spacepolicyonline.com/news/artemis-ii-crew-says-lunar-landing-doable-soon/' } },
]

export const KIND_TONE: Record<Incident['kind'], string> = { fire: 'var(--flame)', smoke: 'var(--muted)', 'false-alarm': 'var(--k-ask)', explosion: 'var(--k-fail)' }
