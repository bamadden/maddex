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
  assert.equal(g[0].category, 'GLOSSARY'); assert.match(g[0].preview.lines.join(' '), /Enter (opens|keeps the definition)/)
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
  assert.match(bar, /case 'saveview':[\s\S]{0,900}madden:save-view/)
})

// WS2 re-audit, 26 Nov 2026.
test('"view NAME" opens a saved view by name, "views" lists them, and a name saved again replaces the old one', async () => {
  const store = new Map()
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  const { viewStateService } = await import('../src/services/viewStateService.js')
  viewStateService.saveView('Morning rates', { activeModule: 'fx' })
  viewStateService.saveView('Macro dense', { activeModule: 'macro' })
  viewStateService.saveView('morning RATES', { activeModule: 'fx', layout: 'split' })
  const views = viewStateService.getSavedViews()
  assert.equal(views.length, 2, 'saved again under the same name: replaced')
  assert.equal(viewStateService.findByName('morning rates').state.layout, 'split')
  assert.equal(viewStateService.findByName('macro').name, 'Macro dense')        // the only one starting with it
  assert.equal(viewStateService.findByName('dense').name, 'Macro dense')        // the only one containing it
  viewStateService.saveView('Macro wide', { activeModule: 'macro' })
  assert.equal(viewStateService.findByName('macro'), null, 'two match: none chosen')
  assert.equal(viewStateService.findByName('nothing'), null)
  const bar = fs.readFileSync('src/components/layout/CommandBar.jsx', 'utf8')
  assert.match(bar, /kind: 'listviews'/)
  assert.match(bar, /kind: 'openview'/)
  assert.match(bar, /case 'openview':[\s\S]{0,300}viewStateService\.findByName\(nl\.name\)[\s\S]{0,300}madden:load-view/)
})

test('saved views keep the Dashboard, Scanner, Screener, Markets, Macro, News and Watchlist state, and the split layout', () => {
  const uses = {
    'src/modules/dashboard/DashboardModule.jsx': "useIntentState('dashboard', 'view'",
    'src/modules/dashboard/OverviewSurface.jsx': "useIntentState('dashboard', 'dense'",
    'src/modules/scanner/MarketScannerModule.jsx': "useIntentState('scanner', 'tab'",
    'src/modules/screener/ScreenerModule.jsx': "useIntentState('screener', 'filters'",
    'src/modules/markets/MarketsModule.jsx': "useIntentState('markets', 'index'",
    'src/modules/macro/MacroModule.jsx': "useIntentState('macro', 'calendarFilter'",
    'src/modules/news/NewsModule.jsx': "useIntentState('news', 'category'",
    'src/modules/watchlist/WatchlistModule.jsx': "useIntentState('watchlist', 'sortKey'",
  }
  for (const [f, u] of Object.entries(uses)) assert.ok(fs.readFileSync(f, 'utf8').includes(u), `${f}: ${u}`)
  const app = fs.readFileSync('src/App.jsx', 'utf8')
  assert.match(app, /\n    layout,\n  \}\), \[activeModule, chatOpen, aiMode, layout\]\)/)
  assert.match(app, /if \(state\.layout\) setLayout\(state\.layout\)/)
})

test('saved-view dates are Sydney dates, and the Overview keys stand aside for an open dialog', async () => {
  assert.doesNotMatch(fs.readFileSync('src/components/layout/globalSearch.js', 'utf8'), /toISOString\(\)\.slice\(0, 10\)/)
  const { overviewKey } = await import('../src/modules/dashboard/overviewOrder.js')
  let toggled = 0
  globalThis.document = { querySelector: (sel) => (/role="dialog"/.test(sel) ? {} : null) }
  assert.equal(overviewKey({ key: 'v' }, { panels: [], active: null, toggleDense: () => toggled++ }), false)
  globalThis.document = { querySelector: () => null }
  assert.equal(overviewKey({ key: 'v' }, { panels: [], active: null, toggleDense: () => toggled++ }), true)
  assert.equal(toggled, 1)
  delete globalThis.document
})

test('"delete view NAME" removes one saved view by name; the cost-less P&L is not 0.00%', async () => {
  const bar = fs.readFileSync('src/components/layout/CommandBar.jsx', 'utf8')
  assert.match(bar, /kind: 'deleteview'/)
  assert.match(bar, /case 'deleteview':[\s\S]{0,300}viewStateService\.deleteView\(v\.id\)/)
  assert.match(fs.readFileSync('src/modules/dashboard/portfolioSnapshot.js', 'utf8'), /pnlPct: cost \? \(\(value - cost\) \/ cost\) \* 100 : null/)
  const ov = fs.readFileSync('src/modules/dashboard/OverviewSurface.jsx', 'utf8')
  assert.match(ov, /minWidth: 44, minHeight: 44/)
  assert.match(ov, /ms <= -6 \* 3600_000/)
})

test('search finds company dates (results, AGMs, ex-dividend) by company, ticker or kind, upcoming only, with their source', async () => {
  const { companyDateRows } = await import('../src/components/layout/globalSearch.js')
  const actions = [
    { date: '2026-12-16', type: 'agm', ticker: 'WBC.AX', company: 'Westpac', detail: 'AGM.', source: 'Westpac financial calendar' },
    { date: '2026-11-05', type: 'dividend', ticker: 'WBC.AX', company: 'Westpac', detail: 'Ex-dividend.', source: 'Westpac financial calendar' },
    { date: '2026-12-10', type: 'listing', ticker: 'NEW.AX', company: 'Newco', detail: 'Listing.', source: 'ASX' },
  ]
  const rows = companyDateRows('westpac', actions, '2026-11-26')
  assert.deepEqual(rows.map((r) => r.desc), ['Westpac (WBC) · AGM'], 'past dates are left out')
  assert.match(rows[0].preview.lines[1], /From Westpac financial calendar \(checked /)
  assert.equal(companyDateRows('wbc', actions, '2026-11-26').length, 1)
  assert.equal(companyDateRows('agm', actions, '2026-11-26').length, 1)
  assert.equal(companyDateRows('newco', actions, '2026-11-26').length, 0, 'listings have their own panel')
})

test('a glossary result shows its definition where the reader is; it does not change module', () => {
  const bar = fs.readFileSync('src/components/layout/CommandBar.jsx', 'utf8')
  const g = bar.slice(bar.indexOf("case 'glossary':"), bar.indexOf("case 'view':"))
  assert.doesNotMatch(g, /setActiveModule/)
  assert.match(g, /20000/)
})

test('CUSTOM widgets move with ◀ ▶ (keyboard and touch), through the same checked swap as dragging', () => {
  const grid = fs.readFileSync('src/modules/dashboard/DashboardGrid.jsx', 'utf8')
  assert.match(grid, /const swap = \(from, to, dryRun = false\)/)
  assert.match(grid, /const handleDrop = \(dropIndex\) => \{ swap\(dragRef\.current, dropIndex\)/)
  assert.match(grid, /aria-label=\{`Move \$\{meta\?\.name \?\? widget\.widgetId\} \$\{word\}`\}/)
})

test('a view can be renamed; saving an eleventh new view warns first, naming the view it would drop', async () => {
  const store = new Map()
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  const { viewStateService, MAX_SAVED_VIEWS } = await import('../src/services/viewStateService.js')
  for (let i = 0; i < MAX_SAVED_VIEWS; i++) viewStateService.saveView(`View ${i}`, { activeModule: 'fx' })
  assert.equal(viewStateService.wouldDrop('A new one').name, 'View 0', 'the oldest')
  assert.equal(viewStateService.wouldDrop('view 5'), null, 'an existing name replaces, drops nothing')
  const v = viewStateService.findByName('View 3')
  assert.equal(viewStateService.renameView(v.id, 'Morning rates'), 'renamed')
  assert.equal(viewStateService.findByName('morning rates').id, v.id)
  assert.equal(viewStateService.renameView(v.id, 'View 4'), 'taken')
  assert.equal(viewStateService.renameView('nope', 'X'), 'missing')
  const bar = fs.readFileSync('src/components/layout/CommandBar.jsx', 'utf8')
  assert.match(bar, /kind: 'renameview'/)
  assert.match(bar, /viewStateService\.wouldDrop\(nl\.name\)[\s\S]{0,200}pendingDropRef\.current !== nl\.name\.toLowerCase\(\)/)
  assert.match(fs.readFileSync('src/components/layout/WorkspaceSwitcher.jsx', 'utf8'), /data-view-drop-warning/)
})
