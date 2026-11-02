// Interaction and layout fixes from the overhaul audit (P2-3, P2-5, P2-7, P2-8,
// P2-11, P2-13, P2-15, P3-5, P3-6). Source checks; the phone layout is also
// checked in a browser in tests/ui.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (f) => fs.readFileSync(f, 'utf8')

test('P2-11: a locked module has a way out besides the nav', () => {
  const gate = read('src/components/billing/ModuleGate.jsx')
  assert.match(gate, /onBack=\{backToOverview\}/)
  assert.match(gate, /'maddex:navigate', \{ detail: \{ module: 'dashboard' \} \}/)
  const up = read('src/components/ui/UpgradePrompt.jsx')
  assert.match(up, /onClose=\{onBack\} onBack=\{onBack\}/)
  assert.match(up, /BACK TO OVERVIEW/)
})

test('P2-13: one refresh control in the top bar — the dot is status only beside REFRESH ALL', () => {
  const top = read('src/components/layout/TopBar.jsx')
  assert.match(top, /<DataFreshnessBadge key="data" interactive=\{!canUse\('priorityRefresh'\)\} \/>/)
  assert.match(top, /if \(!interactive\)/)
})

test('P2-15: the tape leads with the market; crypto movers come last, from the 25 largest coins', () => {
  const tape = read('src/components/layout/TickerTape.jsx')
  assert.match(tape, /const ORDER = \['📊', '📈', '💱', '🛢', '◆', '▲▼'\]/)
  assert.match(tape, /\.sort\(\(a, b\) => b\.marketCap - a\.marketCap\)\.slice\(0, 25\)/)
  assert.match(tape, /!STABLE\.has\(c\.symbol\)/)
})

test('P2-7: Markets leaders show company names whole, legal suffix dropped', () => {
  const tm = read('src/modules/markets/TopMovers.jsx')
  assert.match(tm, /title=\{q\.name \?\? undefined\}>\{shortName\(q\.name\)\}/)
  assert.doesNotMatch(tm, /max-w-\[140px\]/)
})

test('P2-8: the Macro cash-rate chart is on a time axis', () => {
  const m = read('src/modules/macro/MacroModule.jsx')
  assert.match(m, /<AreaChart data=\{RATE_SERIES\}/)
  assert.match(m, /dataKey="ts" type="number" scale="time"/)
})

test('P2-5: the header AI button is labelled; subtitles list contents', () => {
  const h = read('src/components/ui/ModuleHeader.jsx')
  assert.match(h, />ASK AI<\/button>/)
  assert.doesNotMatch(h, />M<\/button>/)
  assert.doesNotMatch(read('src/modules/scanner/MarketScannerModule.jsx'), /Automated pattern & signal detection/)
})

test('P3-5 / P3-6: phones get whole index cards, and an ALL button for every module', () => {
  assert.match(read('src/modules/markets/IndicesTable.jsx'), /auto-cols-\[calc\(100%\/3\)\] snap-x snap-mandatory/)
  const nav = read('src/components/layout/NavBar.jsx')
  assert.match(nav, /aria-label="All modules"/)
  assert.match(nav, /data-all-modules/)
})

test('P2-3: day-month dates go through formatDate ("3 Nov 2026"), not en-AU\'s own "3 Sept"', () => {
  // The RBA decision-day files are held unchanged until after 3 Nov 2026.
  const HELD = /fx\/Rba(HeroCard|DecisionCard|DecisionPreview|HikeImpact)\.jsx$/
  const files = fs.readdirSync('src', { recursive: true }).filter((f) => /\.(jsx?|mjs)$/.test(f) && !HELD.test(f))
  const stray = files.filter((f) => /toLocaleDateString\('en-AU', \{ (weekday: 'short', )?day: 'numeric', month: 'short' /.test(read(`src/${f}`)))
  assert.deepEqual(stray, [])
})
