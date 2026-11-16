// Unified search from the command bar (WS2): glossary terms, saved views,
// calendar events and Relationships nodes, each with a preview of what Enter
// opens; loaded lazily so it stays out of first paint.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { GLOSSARY, searchGlossary } from '../src/data/glossary.js'
import { glossaryRows, viewRows, eventRows, nodeRows } from '../src/components/layout/globalSearch.js'

test('glossary: plain definitions, no advice or forecast, every label term defined', () => {
  assert.ok(GLOSSARY.length >= 40)
  const terms = new Set(GLOSSARY.map((g) => g.term))
  for (const t of ['LIVE', 'DELAYED', 'DEMO', 'STALE', 'Manually checked', 'Data health', 'Connected exposure', 'Cash rate', 'Trimmed mean', 'Franking credit']) assert.ok(terms.has(t), t)
  for (const g of GLOSSARY) {
    assert.ok(g.def.length > 20 && g.module, g.term)
    assert.doesNotMatch(g.def, /\byou should\b|\bconsider (buying|selling)\b|\brecommend|\blikely\b|\bexpect(ed)? to\b|\bwill (rise|fall)\b/i, g.term)
  }
  assert.equal(searchGlossary('bp')[0].term, 'Basis point')
  assert.equal(searchGlossary('franking')[0].term, 'Franking credit')
  assert.deepEqual(searchGlossary('x'), [])
})

test('every row carries a preview of what Enter opens', () => {
  const g = glossaryRows('trimmed')
  assert.equal(g[0].category, 'GLOSSARY'); assert.match(g[0].preview.lines.join(' '), /Enter opens/)
  const views = [{ id: 'v1', name: 'Morning rates', timestamp: Date.parse('2026-11-16T00:00:00Z'), state: { activeModule: 'fx', intent: { tab: 'curves' } } }]
  const v = viewRows('morning', views)
  assert.equal(v[0].id, 'v1'); assert.match(v[0].preview.lines[0], /RATES/)
  assert.equal(viewRows('views', views).length, 1, '"views" lists them all')
  const e = eventRows('cpi', [{ date: '2026-11-25', time: '11:30', event: 'AU CPI (Oct)', region: 'AU' }, { date: '2026-01-01', event: 'AU CPI (old)', region: 'AU' }], '2026-11-16')
  assert.equal(e.length, 1, 'past events are not offered'); assert.match(e[0].preview.lines[0], /11:30 Sydney time/)
  const n = nodeRows('commonwealth')
  assert.ok(n.length >= 1 && n[0].category === 'RELATIONSHIPS')
})

test('the command bar loads the unified search lazily and shows the preview', () => {
  const s = fs.readFileSync('src/components/layout/CommandBar.jsx', 'utf8')
  assert.match(s, /import\('\.\/globalSearch'\)/)
  assert.doesNotMatch(s, /^import .*globalSearch/m, 'not a static import: out of first paint')
  assert.match(s, /<PreviewPane item=\{suggestions\[suggestIdx\]\} \/>/)
  for (const t of ['glossary', 'view', 'event', 'node']) assert.match(s, new RegExp(`case '${t}':`))
})

test('saved views keep the module state it exposes, and are saved and found from the bar', async () => {
  const { recordIntentValue, currentIntent } = await import('../src/services/moduleIntent.js')
  recordIntentValue('futures', 'tab', 'options')
  recordIntentValue('futures', 'symbol', 'SPI-Dec26')
  assert.deepEqual(currentIntent('futures'), { tab: 'options', symbol: 'SPI-Dec26' })
  assert.equal(currentIntent('nothing'), null)
  const app = fs.readFileSync('src/App.jsx', 'utf8')
  assert.match(app, /intent: currentIntent\(activeModule\)/)
  assert.match(app, /if \(state\.activeModule && state\.intent\) sendModuleIntent\(state\.activeModule, state\.intent\)/)
  assert.match(fs.readFileSync('src/hooks/useModuleIntent.js', 'utf8'), /recordIntentValue\(module, field, value\)/)
  const bar = fs.readFileSync('src/components/layout/CommandBar.jsx', 'utf8')
  assert.match(bar, /\^save \(\?:this \|the \)\?view/)
  assert.match(bar, /case 'saveview':[\s\S]{0,200}madden:save-view/)
})
