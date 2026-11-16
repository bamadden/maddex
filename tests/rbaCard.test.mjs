// The RBA hero card (Ben's acceptance criteria, 16 Nov 2026): one test per
// criterion. Source checks strip comments, so a note about something removed
// does not count.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DATASETS } from '../src/data/registry.js'
import { RIPPLE_EVENTS } from '../src/services/graphQuery.js'
import { ALL_NODES } from '../src/data/graph/nodes.js'
import { MORTGAGE_MARGIN, HOUSING_VARIABLE_RATE, F6_URL, F6_READ, MARGIN_SOURCE } from '../src/data/rbaLendingRates.js'
import * as calc from '../src/modules/calculators/calcMath.js'
import VC, { pendingRbaDecision } from '../src/data/verifiedConstants.js'
import { ANNOUNCE_AT, announcement, daysBetweenDays } from '../src/services/centralBankSchedule.js'

const code = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
const CARD = code('src/modules/fx/RbaHeroCard.jsx')

// Each `{cond && (` … `)}` block, found by matching brackets rather than by
// indentation, so a reformat cannot make a block run to the end of the file.
function blocks(src, opener) {
  const out = []
  let i = src.indexOf(opener)
  while (i >= 0) {
    let depth = 0, j = i
    for (; j < src.length; j++) {
      if (src[j] === '(' || src[j] === '{') depth++
      else if (src[j] === ')' || src[j] === '}') { depth--; if (depth === 0) break }
    }
    assert.ok(j < src.length, `unbalanced block at ${i}`)
    out.push(src.slice(i, j + 1))
    i = src.indexOf(opener, j)
  }
  return out
}

test('1. no forecast wording', () => {
  // The disclaimer "connected exposure, not forecast" is the one allowed use.
  assert.doesNotMatch(CARD.replace(/connected exposure, not forecast/g, ''), /probabilit|likely|expected to|may (hike|cut|rise|fall)|will (hike|cut|rise|fall)|priced in|key driver|outlook|consensus|forecast/i)
})

test('2. a market-pricing figure appears only with its value, source and date', () => {
  assert.match(CARD, /const sourcedPricing = pricing && pricing\.marketSource && pricing\.marketAsOf && pricing\.hikeRate != null\s*&& daysBetweenDays\(pricing\.marketAsOf, sydneyISO\(\)\) <= READING_MAX_DAYS/, 'source, date and an age limit')
  assert.match(CARD, /const READING_MAX_DAYS = 30\b/)
  // The age check counts forward: a reading 31 days old is past the limit.
  assert.equal(daysBetweenDays('2026-10-01', '2026-11-01'), 31)
  assert.ok(daysBetweenDays('2026-10-01', '2026-11-01') > 30 && daysBetweenDays('2026-10-17', '2026-11-16') <= 30)
  const uses = [...CARD.matchAll(/(\w+)\.(marketHikePct|hikeRate|marketSource|marketAsOf)/g)].map((m) => m[1])
  assert.deepEqual([...new Set(uses)].filter((u) => u !== 'sourcedPricing' && u !== 'pricing' && u !== 'nd'), [])
  // `pricing.` appears only in the line that defines sourcedPricing.
  assert.deepEqual(CARD.split('\n').filter((l) => /\bpricing\.(marketHikePct|hikeRate)/.test(l) && !/const sourcedPricing/.test(l)), [])
  // Every block that shows the reading is gated on it and names source and date.
  const shown = blocks(CARD, '{sourcedPricing && (')
  assert.equal(shown.length, 2, 'the strip and the bar')
  for (const b of shown) {
    assert.match(b, /sourcedPricing\.marketHikePct/); assert.match(b, /sourcedPricing\.marketSource/); assert.match(b, /sourcedPricing\.marketAsOf/)
    assert.ok(b.length < 3000, 'a block, not the rest of the file')
  }
  // Outside those blocks no pricing figure is shown.
  let rest = CARD
  for (const b of shown) rest = rest.replace(b, '')
  assert.doesNotMatch(rest.replace(/const sourcedPricing = [\s\S]*?\? pricing : null/, '').replace(/const pricing = .*/, ''), /marketHikePct|marketSource|marketAsOf/)
  assert.doesNotMatch(CARD, /100 - (sourcedPricing|pricing)\.marketHikePct/, 'no derived HOLD figure')
})

test('3. no warning symbol, and no colour that changes with the decision or the reading', () => {
  assert.doesNotMatch(CARD, /⚠|#E8A33D|text-terminal-(red|green)|PAL\.(up|down|amber)/)
  // No colour or style chosen by the decision or the reading: no ternary
  // on any of them that yields a colour.
  assert.doesNotMatch(CARD, /(verb|moved|strong|lastDecisionVerb|marketHikePct|sourcedPricing|pricing)\b[^\n?]{0,60}\?\s*['"`]?(#|rgba|text-terminal|PAL)/, 'no colour chosen by the decision or the reading')
  const colours = new Set([...CARD.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()))
  assert.deepEqual([...colours].filter((c) => !['#C9A84C', '#8BA3C4', '#4A6080'].includes(c)), [], 'only the gold and the two neutral greys')
  assert.doesNotMatch(CARD, /rgba\((232|217|168|45), ?(163|119|50|138)/, 'no amber, orange, red or green rgba')
})

test('4. the holdings link opens a valid ripple and describes exposure only', () => {
  const calls = [...CARD.matchAll(/openRipple\(([^)]*)\)/g)].map((m) => m[1])
  assert.ok(calls.length >= 2, 'both links call openRipple')
  for (const c of calls) {
    const m = c.match(/^setActiveModule, '([^']+)', '([^']+)'$/)
    assert.ok(m, `openRipple(${c})`)
    assert.ok(ALL_NODES.some((n) => n.id === m[1]), `node ${m[1]} exists`)
    assert.ok(RIPPLE_EVENTS[m[2]] && RIPPLE_EVENTS[m[2]].appliesTo.includes('macro'), `event ${m[2]} applies to a macro node`)
  }
  assert.match(CARD, /WHICH HOLDINGS CONNECT\? ⊶/)
  assert.match(CARD, /connected exposure, not forecast/)
  assert.match(code('src/modules/relationships/RelPanels.jsx'), /CONNECTED EXPOSURE, NOT FORECAST/)
  assert.match(CARD, /minHeight: 44/)
})

test('5. every figure on the card comes from a registered dataset with a source and date', () => {
  const vc = new Set(DATASETS.map((d) => d.asOf?.vc).filter(Boolean))
  for (const g of ['rba', 'centralBankOfficials', 'rbaNextDecision']) assert.ok(vc.has(g), `vc:${g} registered`)
  assert.ok(DATASETS.some((d) => d.id === 'cb-announce-times'))
  // The card reads only those: no typed rates, percentages or times.
  // No typed percentage (whole or decimal), rate or time in what is shown.
  assert.doesNotMatch(CARD.replace(/\$\{[^}]*\}%/g, '').replace(/.*gradient\(.*/g, ''), /(^|[^\w{$.])\d+(\.\d+)?\s?%|\b14:30|2:30\s*pm/im)
  assert.match(CARD, /announcement\('rba'/)
  // The registered time renders as the RBA states it, 2:30pm Sydney.
  assert.ok(Array.isArray(ANNOUNCE_AT.rba) && /^\d{2}:\d{2}$/.test(ANNOUNCE_AT.rba[0]) && ANNOUNCE_AT.rba[1] === 'Australia/Sydney')
  assert.equal(announcement('rba', '2026-12-08').at, Date.parse('2026-12-08T14:30:00+11:00'))
  const [h, mm] = ANNOUNCE_AT.rba[0].split(':').map(Number)
  assert.equal(`${h % 12 || 12}:${String(mm).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`, '2:30PM')
  assert.match(CARD, /ANNOUNCE_AT\.rba/)
  assert.match(CARD, /provenance\('rba'\)/)
  // The pricing comes from the registered reading itself.
  const ndv = VC.rbaNextDecision
  const nd = pendingRbaDecision(Date.parse(`${ndv.date}T00:00:00+11:00`) - 86_400_000)
  if ((VC.rba.lastDecision ?? '') >= ndv.date) {
    // A reading for a meeting already decided is not shown at all.
    assert.equal(nd, null, 'a spent reading is not pending')
    assert.equal(pendingRbaDecision(Date.now()), null)
  } else {
    assert.ok(nd, 'the reading is pending the day before its meeting')
    for (const k of ['marketHikePct', 'hikeRate', 'marketSource', 'marketAsOf']) assert.equal(nd[k], ndv[k], k)
  }
  assert.match(code('src/data/verifiedConstants.js'), /const nd = VERIFIED_CONSTANTS\.rbaNextDecision[\s\S]{0,200}\? nd : null/, 'pendingRbaDecision returns the registered reading itself')
  assert.equal(DATASETS.find((d) => d.asOf?.vc === 'rbaNextDecision').maxAgeDays, 30)
  const reads = [...CARD.matchAll(/VERIFIED_CONSTANTS\.(\w+)/g)].map((m) => m[1])
  for (const r of reads) assert.ok(vc.has(r), `VERIFIED_CONSTANTS.${r} is a registered dataset`)
})

test('6. the mortgage margin comes from RBA table F6, with its date and link', () => {
  // The figures as read from F6 (Sep 2026) and A2, and the result.
  assert.equal(HOUSING_VARIABLE_RATE.value, 6.2)
  assert.equal(HOUSING_VARIABLE_RATE.cashRateThen, 4.35)
  assert.equal(MORTGAGE_MARGIN, 1.85)
  assert.match(MARGIN_SOURCE, /manually checked \d{1,2} [A-Z][a-z]{2} \d{4}$/)
  assert.equal(calc.MORTGAGE_MARGIN, MORTGAGE_MARGIN)
  assert.equal(HOUSING_VARIABLE_RATE.series, 'FLRHOOVA')
  assert.match(F6_URL, /^https:\/\/www\.rba\.gov\.au\/statistics\/tables\/csv\/f6-data\.csv$/)
  assert.match(F6_READ, /^\d{4}-\d{2}-\d{2}$/)
  const ds = DATASETS.find((d) => d.asOf?.file === 'src/data/rbaLendingRates.js')
  assert.ok(ds && ds.maxAgeDays === 30 && ds.cls === 'official')
  assert.doesNotMatch(code('src/modules/calculators/calcMath.js'), /MORTGAGE_MARGIN = \d/)
  // Every screen that shows the margin names its source, date and link.
  const shows = ['src/modules/fx/RbaHikeImpact.jsx', 'src/modules/calculators/CalculatorsModule.jsx']
  const users = fs.readdirSync('src', { recursive: true }).filter((f) => /\.(js|jsx)$/.test(f)).map((f) => `src/${f}`).filter((f) => /MORTGAGE_MARGIN/.test(fs.readFileSync(f, 'utf8')))
  assert.deepEqual(users.filter((f) => !shows.includes(f) && !/rbaLendingRates|calcMath|verifiedConstants/.test(f)), [], 'no other screen uses the margin')
  assert.match(code('src/data/verifiedConstants.js'), /MARGIN_SOURCE/, "MaddenAI's context names the source too")
  assert.match(MARGIN_SOURCE, /one decimal place/)
  // The data itself is recent: F6 for a month no more than 70 days before it was read.
  assert.ok((Date.parse(F6_READ) - Date.parse(HOUSING_VARIABLE_RATE.periodEnd)) / 86_400_000 <= 70)
  assert.equal(ds.source.url, F6_URL, 'the registry links where the screens link')
  for (const f of shows) {
    const s = code(f)
    assert.match(s, /MARGIN_SOURCE/, f); assert.match(s, /F6_URL/, f)
    assert.doesNotMatch(s, /assumed \{?MORTGAGE_MARGIN|an estimate;/, f)
    assert.match(s, /MORTGAGE_MARGIN\.toFixed\(2\)\} \(±0\.05\)/, `${f}: the precision is stated`)
  }
})

test('7. the layout is otherwise unchanged: the same sections in the same order', () => {
  const order = ['data-rba-pricing', 'data-tip="rba-hero"', 'RBA CASH RATE', 'NEXT DECISION', 'MARKET PRICING ·', 'ASK MADDENAI']
  const at = order.map((k) => CARD.indexOf(k))
  assert.ok(at.every((i) => i >= 0), `${order.filter((k, i) => at[i] < 0)}`)
  assert.deepEqual([...at].sort((a, b) => a - b), at)
  // The card's geometry as it was: the 48px rate, the padding, the countdown.
  for (const k of ["fontSize: 48", "padding: '16px 20px'", 'fontSize: 17', "maxWidth: 380", "borderBottom: '1px solid rgba(201,168,76,0.12)'",
    // The strip and the bar row as they were on main.
    'className="font-mono text-terminal-gold flex items-center gap-2 flex-wrap flex-shrink-0"',
    "style={{ background: 'rgba(201,168,76,0.12)', borderLeft: '3px solid #C9A84C', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}",
    'className="font-bold w-9"', 'className="tabular-nums text-terminal-text-dim w-14">→ {rate.toFixed(2)}%']) assert.ok(CARD.includes(k), k)
})

test('4b. the holdings link is reachable with or without a market reading', () => {
  const links = CARD.match(/WHICH HOLDINGS CONNECT\? ⊶/g) ?? []
  assert.equal(links.length, 2)
  assert.match(CARD, /\{!sourcedPricing && \(\s*<button onClick=\{\(\) => openRipple/)
})
