// One-off: pull the real ACME data embedded in the flame-in-freefall build into web/public/data/acme.
// usage: node scripts/extract-fif.mjs <path to flame-in-freefall/dist/index.html>
import fs from 'node:fs'
import path from 'node:path'

const src = process.argv[2]
if (!src) throw new Error('pass the path to flame-in-freefall/dist/index.html')
const html = fs.readFileSync(src, 'utf8')
const m = html.match(/<script id="fif-data" type="application\/json">([\s\S]*?)<\/script>/)
if (!m) throw new Error('no fif-data block')
const d = JSON.parse(m[1])
const out = path.resolve(import.meta.dirname, '../web/public/data/acme')
fs.mkdirSync(path.join(out, '21256C2'), { recursive: true })

const { burst, ...frames } = d.frames
for (const b of burst) fs.writeFileSync(path.join(out, '21256C2', `f${b.frame}.png`), Buffer.from(b.png.split(',')[1], 'base64'))
frames.burst = burst.map(({ png, ...b }) => ({ ...b, src: `21256C2/f${b.frame}.png` }))
fs.writeFileSync(path.join(out, '21256C2.json'), JSON.stringify(frames))
fs.writeFileSync(path.join(out, '19175A4.json'), JSON.stringify(d.sensor))
fs.writeFileSync(path.join(out, 'testpoints.json'), JSON.stringify(d.testpoints))
console.log('wrote', out, burst.length, 'frames')
