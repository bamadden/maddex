// Every chart says where its data comes from and how current it is (WS3):
// SafeChart requires `provenance`, either a badge (class, source, date) or a
// stated reason the chart needs none of its own.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const SRC = fs.readdirSync('src', { recursive: true }).filter((f) => /\.jsx$/.test(f)).map((f) => `src/${f}`)

test('every chart declares its provenance', () => {
  const missing = []
  let n = 0
  for (const f of SRC) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/<SafeChart\b([^>]*)>/g)) {
      n++
      const p = m[1].match(/provenance=(\{[^}]*\}\}?|"(panel|sparkline|calculated)")/)
      if (!p) missing.push(`${f}: ${m[0].slice(0, 80)}`)
    }
  }
  assert.ok(n >= 30, `found ${n} charts`)
  assert.deepEqual(missing, [])
})

test('every chart drawn straight from recharts goes through SafeChart', () => {
  const direct = SRC.filter((f) => !/SafeChart\.jsx$/.test(f)).filter((f) => /<ResponsiveContainer\b/.test(fs.readFileSync(f, 'utf8')))
  assert.deepEqual(direct, [])
})

test('SafeChart renders the badge, the calculated caption and a labelled figure', () => {
  const s = fs.readFileSync('src/components/ui/SafeChart.jsx', 'utf8')
  assert.match(s, /role="figure" aria-label=\{label\}/)
  assert.match(s, /<DataBadge cls=\{provenance\.cls\} source=\{provenance\.source\} at=\{provenance\.at \?\? null\} manual=\{!!provenance\.manual\} \/>/)
  assert.match(s, /Calculated from your inputs/)
})

test('equity charts are DEMO while prices are simulated', async () => {
  const { equityProvenance } = await import('../src/utils/chartProvenance.js')
  const { USING_MOCK_DATA } = await import('../src/services/api.js')
  const p = equityProvenance(1)
  assert.equal(p.cls, USING_MOCK_DATA ? 'DEMO' : 'DELAYED')
  assert.equal(p.at, 1)
})

test('the components page, its baselines and the design doc are in step', () => {
  const page = fs.readFileSync('src/ComponentsPage.jsx', 'utf8')
  const ids = [...page.matchAll(/<Section id="([\w-]+)"/g)].map((m) => m[1])
  assert.ok(ids.length >= 7)
  const doc = fs.readFileSync('docs/DESIGN_SYSTEM.md', 'utf8')
  for (const id of ids) {
    assert.ok(fs.existsSync(`docs/components/${id}.png`), `baseline for ${id}`)
    assert.match(doc, new RegExp(`components/${id}\\.png`), `doc shows ${id}`)
  }
  assert.match(JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts['test:ui'], /visual\.ui\.mjs/, 'the gate runs the visual suite')
  assert.match(fs.readFileSync('src/App.jsx', 'utf8'), /includes\('components'\)\) return page\(<ComponentsPage \/>\)/)
})

test('one chart style: every tick and grid comes from the chart theme (ticks pass AA contrast)', async () => {
  const { CHART } = await import('../src/styles/chartTheme.js')
  const { PAL } = await import('../src/styles/palette.js')
  assert.equal(CHART.tick.fill, PAL.muted)
  assert.equal(CHART.tick.fontSize, 11)
  const bad = []
  for (const f of SRC) {
    const s = fs.readFileSync(f, 'utf8')
    for (const m of s.matchAll(/tick=\{\{[^}]*\}\}/g)) bad.push(`${f}: ${m[0].slice(0, 60)}`)
    for (const m of s.matchAll(/<CartesianGrid\b[^>]*\/>/g)) if (!/\{\.\.\.CHART\.grid\}/.test(m[0])) bad.push(`${f}: ${m[0].slice(0, 60)}`)
  }
  assert.deepEqual(bad, [])
})
