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

test('Rates and Macro prompts describe: no "likely to do", "for an investor", positioning or direction of travel', () => {
  const files = ['src/modules/fx/FXModule.jsx', 'src/modules/macro/MacroModule.jsx', 'src/modules/macro/MacroDeepDive.jsx', 'src/components/macro/IndicatorForecaster.jsx', 'src/modules/macro/CpiPreviewPanel.jsx', 'src/services/aiDaily.js', 'src/services/marketRegime.js', 'src/services/macroThemeService.js']
  const banned = /likely to do|for an investor|for Australian investors|investors holding|direction of travel|what it means for Australian investors|For \{k\} investors|PORTFOLIO IMPLICATIONS|defensives and bonds usually lead|most supportive backdrop for equities|Watch for immediate repricing/
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), banned, f)
})

test('the RBA history in prompts is built from the decision record, so it cannot miss a decision', async () => {
  const { rbaYearInWords } = await import('../src/data/rbaDecisions.js')
  assert.match(rbaYearInWords(2026), /3 Nov raised to 4\.85%$/)
  for (const f of ['src/modules/fx/FXModule.jsx', 'src/modules/macro/MacroModule.jsx']) assert.match(fs.readFileSync(f, 'utf8'), /rbaYearInWords\(new Date\(\)\.getFullYear\(\)\)/, f)
})

test('conversation starters and the default ASK AI text describe; no rankings, forecasts or portfolio advice', async () => {
  const { GENERIC_STARTERS, getStarters } = await import('../src/services/aiStarters.js')
  const { DEFAULT_INSTRUCTION } = await import('../src/utils/askAI.js')
  const cards = [...GENERIC_STARTERS, ...['INCOME', 'GROWTH', 'BALANCED', 'SPECULATION'].flatMap((f) => getStarters({ focus: f, experience: 'beginner' }).cards)]
  assert.equal(cards.length, 20)
  const banned = /best risk-adjusted|right now|heading\?|\bsuits?\b|position sizing|what is missing|over-exposed|which offers the better|upside and downside cases|realistic downside|how should|priced in|outlook\b(?! and no| or)|technical levels/i
  for (const c of cards) {
    const t = `${c.title} ${c.subtitle} ${c.prompt}`.replace(/no outlook, no forecast/g, '')
    assert.doesNotMatch(t, banned, c.title)
    assert.match(c.prompt, /Describe only/, c.title)
    assert.equal(adviceIntent(c.prompt), false, c.title)
  }
  assert.doesNotMatch(DEFAULT_INSTRUCTION.replace(/no outlook, no forecast/, ''), /outlook|technical levels|direct and specific/i)
  assert.match(DEFAULT_INSTRUCTION, /Describe only/)
  assert.doesNotMatch(fs.readFileSync('src/utils/askAI.js', 'utf8'), /\$\{date\} AEST/)
})

test('daily Global prompts ask for description: no model-made severity, trend or dependence ratings', async () => {
  const src = fs.readFileSync('src/services/aiDaily.js', 'utf8')
  for (const kind of ['geo_risks', 'shipping_status']) {
    const body = src.slice(src.indexOf(`${kind}: narrative(`), src.indexOf('`),', src.indexOf(`${kind}: narrative(`)))
    assert.doesNotMatch(body, /CRITICAL|HIGH\|MEDIUM|ESCALATING|WORSENING|auTradeDependence|"severity"|"trend"|asxExposure/, kind)
    assert.match(body, /Describe only\. Do not rate/, kind)
  }
  const map = await import('../src/modules/global/intelMapData.js')
  for (const r of [...map.SHIPPING_DISRUPTIONS, ...map.GEOPOLITICAL_EVENTS]) {
    assert.equal(r.severity, undefined, `${r.id} carries a severity rating`)
    assert.equal(r.auTrade?.level, undefined, `${r.id} carries a trade-dependence rating`)
  }
  assert.deepEqual(map.GEO_NARRATIVE_FIELDS, ['summary', 'marketImpact'])
  assert.ok(!map.SHIPPING_NARRATIVE_FIELDS.includes('trend'))
})

test('RBA preview: no hike/hold scenarios or sector reactions (Ben, 16 Nov 2026)', () => {
  // The prompt moved to services/aiPrompts (19 Nov 2026), with the other
  // mode prompts.
  const s = fs.readFileSync('src/services/aiPrompts.js', 'utf8')
  const p = s.slice(s.indexOf('export const rbaPreviewInstruction'), s.indexOf('// Personas'))
  assert.doesNotMatch(p, /IF THE RBA HIKES|IF THE RBA HOLDS|SECTOR BY SECTOR|AND WHY|WHAT TO WATCH|genuine scenario/)
  assert.match(p, /no scenarios for what happens if the RBA moves or holds/)
})

test('RBA hero card: the market reading is a sourced, dated reading, not a "high hike probability" warning', () => {
  const s = fs.readFileSync('src/modules/fx/RbaHeroCard.jsx', 'utf8')
  const code = s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  assert.doesNotMatch(code, /⚠ HIGH HIKE PROBABILITY<|HIKE OF \{year\} PRICED IN|URGENT_PCT/)
  const strip = s.slice(s.indexOf('{sourcedPricing && ('), s.indexOf('data-tip="rba-hero"'))
  assert.doesNotMatch(strip, /fontSize: 9\b/)
  assert.match(strip, /minHeight: 44/)
  assert.match(s, /sourcedPricing = pricing && pricing\.marketSource && pricing\.marketAsOf/)
  assert.match(s, /\{sourcedPricing\.marketSource\}, \{fmtDate\(sourcedPricing\.marketAsOf\)\}/)
})

// WS2 re-audit, 26 Nov 2026: the Morning Call asked what events "could do"
// and for "things to watch".
test('the Morning Call describes: no event outcomes, nothing to watch, no recommendation', async () => {
  const src = fs.readFileSync('src/modules/dashboard/MorningCallButton.jsx', 'utf8')
  const prompt = /export const PROMPT = '([^']+)'/.exec(src)[1]
  const ask = prompt.split('Describe only:')[0] // what it asks for, not what it forbids
  assert.doesNotMatch(ask, /could do|to watch|likely|expect/i)
  assert.match(prompt, /Describe only: no forecast/)
  assert.doesNotMatch(fs.readFileSync('src/modules/dashboard/widgets/MorningBriefWidget.jsx', 'utf8'), /MADDENAI OUTLOOK/)
  assert.doesNotMatch(fs.readFileSync('src/modules/dashboard/widgets/ScannerSignalsWidget.jsx', 'utf8'), />No signals right now|scanner signals from/)
})

// 26 Nov 2026 (live sweep, docs/ai-eval/controls-*): the News morning brief
// asked the model to close on "what Australian investors should watch", and
// its own system prompt carried no advice line. No prompt or heading anywhere
// asks what to watch or monitor; mentions inside a "no …" rule are allowed.
test('no prompt or heading asks the model what to watch or monitor', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(jsx?|mjs)$/.test(e.name) ? [`${d}/${e.name}`] : [])
  const asks = /should watch|what (should I|to) watch for|themes to (watch|monitor)|to monitor today|keep an eye on|Catalysts to Watch|Investment Considerations|Watch the statement/i
  const negated = /\b(no|not|never|nor|nothing|without)\b[^.'"`]{0,40}$/i
  const hits = []
  for (const f of walk('src')) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line) || /const SECTION_LABEL/.test(line)) return
      const m = asks.exec(line)
      if (m && !negated.test(line.slice(0, m.index))) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`)
    })
  }
  assert.deepEqual(hits, [])
  const news = fs.readFileSync('src/modules/news/NewsModule.jsx', 'utf8')
  assert.match(news, /never tell the reader what to watch, monitor or treat as a signal/)
})
