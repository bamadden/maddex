// Colours come from the tokens (WS3, 19 Nov 2026). Exact copies of a token
// inside JS strings were replaced with PAL references; what remains is mostly
// entity colours (coin brands, map layers, chart series) and CSS-variable
// fallbacks. This ratchet only lets the count of typed hex colours in modules
// and components go down: lower BASELINE when you remove some.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PAL } from '../src/styles/palette.js'

const BASELINE = 407
const files = ['src/modules', 'src/components'].flatMap((d) => fs.readdirSync(d, { recursive: true }).filter((f) => /\.jsx?$/.test(f)).map((f) => `${d}/${f}`))
const HELD = /Rba(HeroCard|DecisionCard|DecisionPreview|HikeImpact)|ReleaseWatchBanner/

test('the number of typed hex colours only goes down', () => {
  const n = files.reduce((t, f) => t + (fs.readFileSync(f, 'utf8').match(/#[0-9A-Fa-f]{6}\b/g) ?? []).length, 0)
  assert.ok(n <= BASELINE, `${n} typed hex colours, above the baseline of ${BASELINE}: use PAL (src/styles/palette.js)`)
})

test('no quoted string is a bare copy of a token', () => {
  const tokens = new Map(Object.entries(PAL).map(([k, v]) => [v.toUpperCase(), k]))
  const bad = []
  for (const f of files.filter((x) => !HELD.test(x))) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/(['"])(#[0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?\1/g)) if (tokens.has(m[2].toUpperCase())) bad.push(`${f}: ${m[0]} → PAL.${tokens.get(m[2].toUpperCase())}`)
  }
  assert.deepEqual(bad, [])
})
