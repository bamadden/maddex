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
