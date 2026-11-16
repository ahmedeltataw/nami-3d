// Run Blender asset scripts headless, in parallel: node scripts/blender-headless.mjs portal_gate logo_3d [--serial]
// Each name maps to assets-model/scripts/<name>.py (they build a fresh scene and export into assets-model/export).
// Use the live Blender (MCP) only for visual review; use this for rebuilds/exports.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, createWriteStream } from 'node:fs'
import { join, resolve } from 'node:path'

const BLENDER = process.env.BLENDER_EXE ?? 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe'
const root = resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const serial = args.includes('--serial')
const names = args.filter((a) => !a.startsWith('--'))
if (!existsSync(BLENDER)) throw new Error(`Blender not found at ${BLENDER} (set BLENDER_EXE)`)
if (!names.length) throw new Error('usage: blender-headless.mjs <script-name>... [--serial]')
const logDir = join(root, 'test-results', 'blender'); mkdirSync(logDir, { recursive: true })

const run = (name) => new Promise((done) => {
  const script = join(root, 'assets-model', 'scripts', `${name}.py`)
  if (!existsSync(script)) return done({ name, code: 127, ms: 0 })
  const t0 = Date.now(), log = createWriteStream(join(logDir, `${name}.log`))
  const p = spawn(BLENDER, ['-b', '--factory-startup', '--python', script], { stdio: ['ignore', 'pipe', 'pipe'] })
  p.stdout.pipe(log); p.stderr.pipe(log)
  p.on('close', (code) => done({ name, code, ms: Date.now() - t0 }))
})
const results = []
if (serial) for (const n of names) results.push(await run(n))
else results.push(...await Promise.all(names.map(run)))
for (const r of results) console.log(`${r.code === 0 ? 'ok  ' : 'FAIL'} ${r.name} ${(r.ms / 1000).toFixed(1)}s (log: test-results/blender/${r.name}.log)`)
process.exit(results.every((r) => r.code === 0) ? 0 : 1)
