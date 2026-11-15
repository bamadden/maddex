// Every quick prompt the terminal sends to MaddenAI asks for description
// only (15 Nov 2026): no outlook, price targets, positioning, "what to
// watch", suitability or rankings, and none trips the advice guard's own
// request check. These were found asking for "reasonable price targets" and
// "BUY NOW OR WAIT?".

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { adviceIntent } from '../src/services/adviceGuard.js'

const FILES = ['src/components/layout/AIPanel.jsx', 'src/services/marketRegime.js', 'src/services/investorProfile.js']
// Labels and prompts as written: { label: '…', prompt: `…` } or q('…', '…').
function prompts() {
  const out = []
  for (const f of FILES) {
    const src = fs.readFileSync(f, 'utf8')
    for (const m of src.matchAll(/label:\s*(['"`])((?:(?!\1).)*)\1,\s*prompt:\s*(['"`])((?:\\.|(?!\3)[\s\S])*?)\3/g)) out.push({ f, label: m[2], prompt: m[4] })
    for (const m of src.matchAll(/\bq\(\s*'((?:\\.|[^'])*)',\s*'((?:\\.|[^'])*)'\)/g)) out.push({ f, label: m[1], prompt: m[2] })
  }
  return out
}

const BANNED = /\boutlook\b(?!,? forecast| or forecast)|price targets?|\bposition(ing)?\b|to watch|should (i|an?\b.*investor)|\bsuits?\b|buy now|or wait\b|\btop \d\b|matter most|benefits? most|read between the lines|\bcatalysts?\b/i

test('there are quick prompts to check', () => {
  assert.ok(prompts().length >= 40, `found ${prompts().length}`)
})

test('no quick prompt asks for an outlook, a target, positioning, suitability or a ranking', () => {
  const bad = prompts().filter((p) => {
    // "no outlook" / "do not suggest" style refusals are allowed.
    const text = `${p.label} ${p.prompt}`.replace(/\b(no|not|without|do not|nor)\b[^.:;]*?(outlook|price target|position(ing)?|watch|suits?|rank|catalysts?)\w*/gi, '')
    return BANNED.test(text)
  }).map((p) => `${p.f}: ${p.label}`)
  assert.deepEqual(bad, [])
})

test('no quick prompt trips the advice guard', () => {
  const flagged = prompts().filter((p) => adviceIntent(p.prompt)).map((p) => `${p.f}: ${p.label}`)
  assert.deepEqual(flagged, [])
})

test('scanner prompts explain what was measured; they never ask whether a move will hold, fill, reverse or is worth acting on', () => {
  const src = fs.readFileSync('src/modules/scanner/MarketScannerModule.jsx', 'utf8')
  const asks = [...src.matchAll(/analyseSignal\([^,]+,[^,]+,\s*\n?\s*`([\s\S]*?)`\)/g)].map((m) => m[1])
  assert.ok(asks.length >= 5, `found ${asks.length}`)
  for (const a of asks) {
    assert.doesNotMatch(a, /likely to (hold|fill)|worth acting|reversal setup|confirm or invalidate|is breaking out/i, a.slice(0, 80))
    assert.match(a, /Describe only: no forecast, no price and no suggestion of any action\./, a.slice(0, 80))
  }
})
