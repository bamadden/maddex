// Portfolio overhaul (Phase D, 16 Nov 2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\{\/\*)/.test(l)).join('\n')
const DIR = 'src/modules/portfolio'
const all = () => fs.readdirSync(DIR).filter((f) => /\.jsx?$/.test(f)).map((f) => read(`${DIR}/${f}`)).join('\n')

test('no AI portfolio builder; prompts describe only', () => {
  assert.ok(!fs.existsSync('src/services/portfolioBuilderService.js'))
  assert.ok(!fs.existsSync('src/components/portfolioBuilder/PortfolioBuilderModal.jsx'))
  const s = all()
  assert.doesNotMatch(s, /BUILD WITH AI|What should I consider|might consider|What should I know|what to watch next|suits the stated/)
})

test('no missing value as 0, no verdict colours, no invented score', () => {
  const s = all()
  assert.doesNotMatch(s, /q\.pct \?\? 0|dayPct = 0|diversificationScore|OVERWEIGHT|UNDERWEIGHT|market average of ~1\.0|beta > 1\.15 \? RED/)
  assert.doesNotMatch(read(`${DIR}/performanceModel.js`), /getMockFMPRow|\?\? 0\b/)
})

test('Sydney dates, friendly errors', () => {
  const s = all() + read('src/services/portfolioCsv.js') + read('src/services/transactionService.js')
  assert.doesNotMatch(s, /toISOString\(\)\.slice\(0, 10\)|toLocaleDateString\('en-CA'\)\)|e\.message \|\| 'DATA SOURCE ERROR'/)
})

test('News: prompts describe; tone is not a green/red verdict; no 0 for a missing move; no raw error', () => {
  const s = read('src/modules/news/NewsModule.jsx')
  assert.doesNotMatch(s, /likely market impact|what should I watch next|s\.label === 'BULLISH' \? PAL\.up|price_change_percentage_24h \?\? 0|setError\(e\.message/)
  assert.doesNotMatch(s, /ENERGY: PAL\.down|CRYPTO: PAL\.up/)
})

test('Brief and the MaddenAI system prompt describe; no "what to watch", no judgement, no 0 for missing moves', () => {
  const brief = fs.readFileSync('src/services/morningBriefService.js', 'utf8')
  const weekly = fs.readFileSync('src/services/weeklyReviewService.js', 'utf8')
  const sys = fs.readFileSync('src/services/systemPrompt.js', 'utf8')
  for (const [n, s] of [['brief', brief], ['weekly', weekly], ['system', sys]]) {
    assert.doesNotMatch(s, /WHAT TO WATCH|what to watch|Analytical, not descriptive|bull and bear cases each rest|do well or badly|key levels \(if relevant\)|senior financial analyst/, n)
  }
  assert.doesNotMatch(brief, /aud_24h_change \?\? 0|row\.pct \?\? 0|Time: 7:00 AM|\$\{nd\.time\} AEDT|autoGenerateBrief\s*\(/)
  assert.doesNotMatch(weekly, /export async function autoGenerateWeeklyReview/)
  const mod = fs.readFileSync('src/modules/brief/MorningBriefModule.jsx', 'utf8')
  assert.match(mod, /<ScoreNote method="outlook"/)
  assert.doesNotMatch(mod, /7am Sydney time|setError\(e\.message\)|MADDENAI OUTLOOK/)
})

test('Calendar: no unsourced consensus, no invented sensitivity, describe-only prompts, Sydney days', () => {
  const s = read('src/modules/calendar/CalendarModule.jsx')
  assert.doesNotMatch(s, /MARKET SENSITIVITY|>CONSENSUS<|likely market impact|bull case, and bear case|What should investors watch/)
  assert.match(s, /event\.forecastSource &&/)
  assert.doesNotMatch(s, /setHours\(0, 0, 0, 0\)\)\n|new Date\(now\.getFullYear\(\), now\.getMonth\(\), now\.getDate\(\)\)/)
  assert.doesNotMatch(read('src/services/calendarExtras.js'), /m\.setHours\(8/)
  assert.ok(!fs.existsSync('src/modules/calendar/EventImpact.jsx') && !fs.existsSync('src/services/eventImpact.js'), 'event impact scenarios removed')
})

test('Relationships: links validated, nodes keyboard-reachable, hop sources shown, no 0 cost', () => {
  const m = read('src/modules/relationships/RelationshipsModule.jsx')
  assert.match(m, /f && GRAPH\.byId\.has\(f\) \? f : null/)
  assert.match(m, /validRipple\(/)
  assert.match(m, /role="button" tabIndex=\{0\}/)
  assert.doesNotMatch(m, /role="img"|Number\(h\.avgCost\) \|\| 0|costCurrency \?\? 'AUD'/)
  assert.match(read('src/modules/relationships/RelPanels.jsx'), /data-hop-source/)
})

test('Screener: presets named by criteria, describe-only prompts, no 52W defaults, cash rate badged', () => {
  const s = read('src/modules/screener/ScreenerModule.jsx')
  assert.doesNotMatch(s, /RATE HIKE WINNERS|RATE HIKE VICTIMS|VALUE PLAYS|OVERSOLD QUALITY|DEFENSIVE QUALITY|pricing power|more likely sustainable|what should I consider|which ASX\/US stocks would match/)
  assert.doesNotMatch(s, /\* 100 : 50,|YIELD PREMIUM|bg-terminal-green/)
  assert.match(s, /<HandEnteredBadge dataKey="rba"/)
})

test('Scanner and Replay: no invented reasons or history, sourced rate and events, describe-only prompts', async () => {
  const ss = read('src/services/scannerService.js')
  assert.doesNotMatch(ss, /priced on hike expectations|losing appeal|STRONG UPTREND|TURNING UP| — stretched|"confirmation":|toISOString\(\)\.slice\(0, 10\)/)
  const ms = read('src/modules/scanner/MarketScannerModule.jsx')
  assert.doesNotMatch(ms, /' AEST'|Confirms:|Invalidates:|setError\(e\.message\)/)
  assert.match(ms, /simulated demo data in this build/)
  const R = await import('../src/services/replayService.js')
  assert.equal(R.rbaRateOn('2008-06-01'), 7.25)
  assert.equal(R.rbaRateOn('2007-06-01'), null)
  assert.equal(R.generateReplayMovers, undefined)
  assert.ok(R.EDUCATIONAL_EVENTS.length > 20 && R.EDUCATIONAL_EVENTS.every((e) => e.source && /^\d{4}-\d{2}-\d{2}$/.test(e.date)))
  assert.doesNotMatch(read('src/modules/replay/ScenarioPlayer.jsx'), /can learn from it/)
})
