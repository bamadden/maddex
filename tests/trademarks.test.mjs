// Third-party marks (legal-risk item 9): no Bloomberg in app or marketing
// copy (three strings in the held RBA panels are scheduled for 4 Nov), and
// the register of names exists.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (f) => fs.readFileSync(f, 'utf8')
const SCHEDULED = [/marketSource: 'Bloomberg data, as reported by ABC News'/, /source: 'Bloomberg via abc\.net\.au \(28 Oct\); rba\.gov\.au'/, /\(Bloomberg via ABC News, 28 Oct\)/]

test('no Bloomberg in app or marketing copy, outside code comments and the scheduled strings', () => {
  const files = ['README.md', 'index.html', ...fs.readdirSync('src', { recursive: true }).filter((f) => /\.(jsx?|json|md|html)$/.test(f) && !f.includes('graph/proposals')).map((f) => `src/${f}`)]
  const hits = []
  for (const f of files) {
    read(f).split('\n').forEach((line, i) => {
      line = line.replace(/\s\/\/\s.*$/, '') // a trailing comment, not a URL
      if (!/bloomberg/i.test(line)) return
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return // a maintainer's research note, not shown
      if (SCHEDULED.some((re) => re.test(line))) return
      hits.push(`${f}:${i + 1}`)
    })
  }
  assert.deepEqual(hits, [])
})

test('the register lists the removals, the scheduled strings and the names in use', () => {
  const t = read('docs/TRADEMARKS.md')
  for (const re of [/## Removed/, /## Scheduled/, /rbaNextDecision\.marketSource/, /## In use, and why/, /CoinGecko/, /S&P\/ASX 200/, /Anthropic/, /never states or implies it is licensed/]) assert.match(t, re)
})

test('basemap providers are credited on the map', () => {
  const m = read('src/modules/global/DeckGLMap.jsx')
  assert.match(m, /© OpenStreetMap contributors © CARTO/)
  assert.match(m, /data-map-credit/)
})
