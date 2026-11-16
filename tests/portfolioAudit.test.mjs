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
