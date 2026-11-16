import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VERIFIED_CONSTANTS as V } from '../src/data/verifiedConstants.js'
import { MAX_AGE_DAYS } from '../src/data/registry.js'
import { LAST_DECISIONS } from '../src/services/centralBankSchedule.js'

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

test('every bank names its own source and check date; no RBA badge stands in for the others', () => {
  for (const [bank, d] of Object.entries(LAST_DECISIONS)) {
    assert.ok(d.source, `${bank} has no source`)
    assert.match(d.checked ?? '', /^\d{4}-\d{2}-\d{2}$/, `${bank} has no check date`)
  }
  for (const f of ['modules/fx/CentralBankCards.jsx', 'modules/fx/CentralBankTracker.jsx']) {
    const s = src(f)
    assert.doesNotMatch(s, /HandEnteredBadge dataKey="rba"/, f)
    assert.match(s, /data-bank-source/, f)
    assert.match(s, /source="each central bank's site"[^>]*\bmanual\b/, f)
  }
})

test('the TWI carries its own RBA date, and is within the price limit', () => {
  const s = src('modules/fx/AudTwiCard.jsx')
  assert.match(s, /<DataBadge cls=\{twiStale \? 'STALE' : 'DELAYED'\} source="RBA F11.1" at=\{au\.twiAsOf\} \/>/)
  assert.doesNotMatch(s, /HandEnteredBadge dataKey="au"/)
  const age = (Date.now() - Date.parse(`${V.au.twiAsOf}T00:00:00Z`)) / 86_400_000
  assert.ok(age <= MAX_AGE_DAYS.price, `TWI is ${Math.round(age)} days old: re-read F11.1 and update au.twi`)
})
