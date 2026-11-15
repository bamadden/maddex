// Global (Phase 5, docs/audit/global.md).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { portfolioExposure, costChannels, EXPOSURE_LABEL } from '../src/services/geopoliticalImpactService.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const store = (v) => ({ getItem: () => JSON.stringify(v) })

test('route exposure describes links; it never estimates a gain or loss', () => {
  const hormuz = { name: 'Strait of Hormuz', asxStocks: ['WDS.AX'], asxNote: 'Woodside sells LNG into Asia.', commodity: 'Crude oil' }
  const rows = portfolioExposure(hormuz, store([{ symbol: 'WDS', type: 'asx', shares: 100 }, { symbol: 'STO', type: 'asx', shares: 50 }, { symbol: 'CSL', type: 'asx', shares: 5 }, { symbol: 'AAPL', type: 'us', shares: 1 }]))
  assert.deepEqual(rows.map((r) => [r.symbol, EXPOSURE_LABEL[r.exposure]]), [['WDS', 'NAMED FOR THIS ROUTE'], ['STO', 'SECTOR LINK'], ['CSL', 'NO DIRECT LINK FOUND']])
  for (const r of rows) { assert.ok(!('impactValue' in r) && !('shockPct' in r) && !('value' in r)); assert.doesNotMatch(r.reason, /\d+(\.\d+)?%|A\$|\$\d/) }
  const svc = read('src/services/geopoliticalImpactService.js')
  assert.doesNotMatch(svc.slice(svc.indexOf('export')), /mulberry32|getMockFMPRow|Math\.random|shock/i, 'no seeded randomness, no prices')
})

test('cost channels carry no sizes, probabilities or forecasts', () => {
  for (const name of ['Strait of Hormuz', 'Taiwan Strait']) {
    for (const c of costChannels({ name })) assert.doesNotMatch(c.text, /\d|probab|likely|will |expect|estimate|outlook|cut/i, `${name}: ${c.text}`)
  }
  const ui = read('src/components/global/GeopoliticalImpact.jsx')
  assert.doesNotMatch(ui, /ESTIMATED IMPACT|Estimated portfolio impact|RBA IMPLICATIONS|what to watch/i)
  assert.match(ui, /not an estimate of gains or losses, and not a recommendation/)
  assert.match(ui, /do not forecast prices or suggest any action/)
})

test('route status has one dated source; route notes and map zones carry no unsourced figures', async () => {
  const { SHIPPING_ROUTES, routeFor, brentReading } = await import('../src/data/shippingRoutes.js')
  for (const r of SHIPPING_ROUTES) {
    assert.match(r.asOf, /^\d{4}-\d{2}-\d{2}$/, `${r.name} has an entry date`)
    assert.ok(['OPEN', 'MONITORED', 'DISRUPTED'].includes(r.status), r.name)
    for (const t of [r.note, r.history, r.asxNote]) assert.doesNotMatch(t, /%|\$|\d+\s*(day|Mt|mb|bn|B\b|T\b)|surged|\+\d/i, `${r.name}: ${t}`)
    assert.ok(!('cargoValue' in r) && !('impact' in r), `${r.name}: no hand-typed cargo values`)
  }
  assert.equal(routeFor('hormuz').status, 'DISRUPTED', 'Hormuz reads the same everywhere')
  const intel = read('src/modules/global/intelMapData.js')
  const zones = intel.slice(intel.indexOf('export const SHIPPING_DISRUPTIONS'), intel.indexOf('export const COMMODITY_SITES'))
  for (const line of zones.split('\n').filter((l) => /^\s+(detail|impact):/.test(l))) {
    assert.doesNotMatch(line, /%|US\$|A\$|\d{2,}\s*(vessels|ships|days)|\+\d|quarter|fifth|half of/i, line.trim())
  }
  const b = brentReading()
  assert.equal(typeof b.value, 'number'); assert.match(b.asOf, /^\d{4}-\d{2}-\d{2}$/); assert.ok(b.source)
  assert.equal(brentReading({ commodities: {} }), null, 'no Brent held: nothing shown, never 0')
  const mod = read('src/modules/global/GlobalModule.jsx')
  assert.doesNotMatch(mod, /\$25\.4T|price:76\.50|Monitor AU energy\/commodity exposure|freight cost outlook/)
  assert.match(mod, /\.\.\.held\('brentUSD'\)/, 'Commodity Flows Brent is the dated constant')
})

test('AI map narrative cannot carry a figure', async () => {
  const { overlayNarrative } = await import('../src/modules/global/intelMapData.js')
  const rows = [{ id: 'hormuz', name: 'Strait of Hormuz', detail: 'base', impact: 'base' }]
  const out = overlayNarrative(rows, [{ id: 'hormuz', name: 'Strait of Hormuz', detail: 'Tankers diverted.', impact: 'Freight rates +340%' }], ['detail', 'impact'])
  assert.equal(out[0].detail, 'Tankers diverted.')
  assert.equal(out[0].impact, 'base', 'a model string with a digit is dropped')
})

test('bilateral trade: ABS values for Australia\'s pairs only; nothing generated for other pairs', async () => {
  const { partnerTrade, auTradeWith } = await import('../src/services/bilateralTrade.js')
  const cn = partnerTrade('Australia', 'China')
  assert.equal(cn.exportsBn, 188.7); assert.equal(cn.importsBn, 120.0); assert.match(cn.source, /^ABS/); assert.equal(cn.period, '2024-25')
  assert.deepEqual(partnerTrade('China', 'Australia'), cn, 'the same pair read from either side')
  assert.equal(partnerTrade('Australia', 'USA').importsBn, 96.8, 'aliases resolve')
  assert.equal(partnerTrade('Australia', 'India').importsBn, null, 'outside the ABS top five: null, shown as —, never 0')
  assert.equal(partnerTrade('Germany', 'France'), null)
  assert.equal(auTradeWith('China', { auTrade: undefined }), null)
  const mod = read('src/modules/global/GlobalModule.jsx')
  assert.doesNotMatch(mod, /seededHash|partnerTradeStats|Illustrative bilateral estimates/)
})

test('map status names only a real feed as live; hand-entered layers and AI text are not counted', async () => {
  const { mapStatusLine } = await import('../src/modules/global/intelMapData.js')
  const src = [{ label: 'USGS seismic', cls: 'LIVE', ok: true }, { label: 'Exchange sessions', cls: 'REFERENCE', ok: true }, { label: 'Intel narrative (AI)', cls: 'AI', ok: true }]
  assert.equal(mapStatusLine(src).text, 'LIVE: USGS · OTHER LAYERS HAND-ENTERED')
  assert.equal(mapStatusLine([{ ...src[0], ok: false }, src[1]]).text, 'LIVE FEED DOWN: USGS · OTHER LAYERS HAND-ENTERED')
  const map = read('src/modules/global/DeckGLMap.jsx')
  assert.doesNotMatch(map, /`LIVE DATA ·|SOURCES ACTIVE`/)
  for (const m of map.matchAll(/\{ label: '[^']+',\s+(cls: '\w+')?/g)) assert.ok(m[1], `feed without a class: ${m[0]}`)
})

test('map clock: Sydney time with its own zone, and the reader\'s zone clearly labelled', async () => {
  const { sydneyClock, localClock } = await import('../src/utils/dateUtils.js')
  const nov = new Date('2026-11-05T06:12:00Z')
  assert.equal(sydneyClock(nov).text, '17:12 AEDT', 'November: Sydney is AEDT')
  assert.equal(sydneyClock(new Date('2026-07-01T06:12:00Z')).text, '16:12 AEST', 'July: AEST')
  assert.deepEqual(localClock(nov, 'Australia/Brisbane'), { time: '16:12', zone: 'Australia/Brisbane', offset: 'UTC+10', text: '16:12 Australia/Brisbane (UTC+10)' })
  assert.equal(localClock(nov, 'Asia/Kolkata').offset, 'UTC+05:30')
  assert.equal(localClock(nov, 'UTC').offset, 'UTC')
  const map = read('src/modules/global/DeckGLMap.jsx')
  assert.doesNotMatch(map, /timeZone: 'Australia\/Brisbane' \}\)\} AEST/, 'no Brisbane time labelled AEST')
  assert.match(map, /SYDNEY \{sydneyClock\(now\)\.text\}/)
  assert.match(map, /YOUR TIME \{local\.time\} · \{local\.zone/)
})

test('Commodity Flows: only rows with a held, dated price; no typed volumes, risk grades or momentum', () => {
  const src = fs.readFileSync('src/modules/global/GlobalModule.jsx', 'utf8')
  const panel = src.slice(src.indexOf('const COMMODITY_TABLE'), src.indexOf('COMMODITY_TABLE.map'))
  assert.doesNotMatch(panel, /price:\s*\d/, 'no typed prices')
  assert.doesNotMatch(panel, /vol:|risk:|~A\$76B|Momentum|Most at-risk/)
  assert.match(panel, /trade\.totalExportsBn/)
  assert.doesNotMatch(src, /disruption risk and market impact/)
})

test('map event text describes links; no trading-flavoured labels or unsourced shares', async () => {
  const { SHIPPING_DISRUPTIONS, GEOPOLITICAL_EVENTS } = await import('../src/modules/global/intelMapData.js')
  const text = JSON.stringify([SHIPPING_DISRUPTIONS.map((z) => z.asxImpact), GEOPOLITICAL_EVENTS.map((e) => [e.marketImpact, e.auTrade])])
  assert.doesNotMatch(text, /windfall|stocks? bid|at risk|momentum|monitor|recommend|escort|sensitiv|elevated/i)
  assert.doesNotMatch(text, /\d+%/, 'no shares without a source')
  assert.doesNotMatch(read('src/data/geopoliticalRisk.js'), /windfall/)
})

test('Global: no typed 0–100 severity or trade-risk score; editorial labels say what they are; the rubric average links its method', () => {
  const data = fs.readFileSync('src/modules/global/intelMapData.js', 'utf8')
  assert.doesNotMatch(data, /severityScore|riskScore/)
  const panel = fs.readFileSync('src/modules/global/MapDetailPanel.jsx', 'utf8')
  assert.doesNotMatch(panel, /ScoreNote method="country-risk"/)
  assert.match(panel, /Maddex editorial label/)
  const mod = fs.readFileSync('src/modules/global/GlobalModule.jsx', 'utf8')
  assert.doesNotMatch(mod, /Trade Risk Score|computeTradeRiskScore|return 'MODERATE'/)
  assert.match(mod, /<ScoreNote method="country-risk" asOf=\{formatDate\(RISK_LAST_REVIEWED\)\} \/>/)
})

test('Global: a source switched off for licence reasons is not polled and says it is off', () => {
  const mod = fs.readFileSync('src/modules/global/GlobalModule.jsx', 'utf8')
  const sky = mod.slice(mod.indexOf("queryKey: ['opensky']"), mod.indexOf("queryKey: ['opensky']") + 400)
  assert.match(sky, /enabled:\s+!licenceOff\('opensky'\)/)
  assert.match(mod, /licenceOff\('opensky'\)\) return <div[^\n]*<SwitchedOff what="Live air traffic"/)
  assert.match(mod, /if \(off\) return <SwitchedOff what="Weather"/)
  assert.match(mod, /enabled: !off && lat != null/)
})

test('Global: no typed exchange volume or market cap, and no hard-coded air-freight index', () => {
  assert.doesNotMatch(fs.readFileSync('src/modules/global/intelMapData.js', 'utf8'), /\bvolume: [\d.]+e\d|marketCap: [\d.]+e\d/)
  assert.doesNotMatch(fs.readFileSync('src/modules/global/MapDetailPanel.jsx', 'utf8'), /data\.volume|data\.marketCap/)
  assert.doesNotMatch(fs.readFileSync('src/modules/global/DeckGLMap.jsx', 'utf8'), /d\.marketCap/)
  assert.doesNotMatch(fs.readFileSync('src/modules/global/GlobalModule.jsx', 'utf8'), /Freightos Baltic Air Index · hardcoded|>127\.4</)
})

test('Global: keyword severity is shown as a word tag, never as an assessment of the event', () => {
  const mod = fs.readFileSync('src/modules/global/GlobalModule.jsx', 'utf8')
  assert.match(mod, /A word match, not an assessment of the event/)
  assert.doesNotMatch(mod, /⚠ CRITICAL EVENT|title="ACTIVE INTELLIGENCE"|No active disruptions/)
  assert.ok((mod.match(/data-tag-note/g) ?? []).length >= 2)
})

test('Global: a hand-entered country figure older than its cycle is marked, never shown as current', async () => {
  const { periodEnd, pastCycle } = await import('../src/modules/global/macroAge.js')
  const now = Date.UTC(2026, 10, 15)
  assert.equal(periodEnd('Q1 2026, Eurostat').toISOString().slice(0, 10), '2026-03-31')
  assert.equal(periodEnd('Apr 2025, NBU').toISOString().slice(0, 10), '2025-04-30')
  assert.equal(periodEnd('Jun 2026 quarter, ABS').toISOString().slice(0, 10), '2026-06-30')
  assert.equal(periodEnd('FY25, PBS').toISOString().slice(0, 10), '2025-06-30')
  assert.equal(periodEnd('2026-11-03, RBA').toISOString().slice(0, 10), '2026-11-03')
  assert.equal(periodEnd('as advised'), null)
  assert.ok(pastCycle('May 2026, BoK', 'rate', now), 'a May rate has had later meetings')
  assert.ok(!pastCycle('2026-11-03, RBA', 'rate', now))
  assert.ok(pastCycle('Apr 2026, BLS', 'release', now))
  assert.ok(!pastCycle('Sep 2026, ABS', 'release', now))
  assert.ok(!pastCycle('Jun 2026 quarter, ABS', 'release', now))
  assert.ok(pastCycle('Q4 2025, ONS', 'release', now))
  assert.ok(!pastCycle('2025, INDEC', 'release', now), 'an annual figure lasts a year past its period')
  assert.ok(!pastCycle('as advised', 'rate', now), 'an unparsed label is left unmarked, not guessed')
  const mod = read('src/modules/global/GlobalModule.jsx')
  for (const l of ['gdpLbl', 'inflLbl']) assert.match(mod, new RegExp(`<OutOfDate label=\\{${l}\\}`))
  assert.ok(mod.includes('<OutOfDate label={intRateChecked ? `${intRateChecked}, checked` : intRateLbl} kind="rate" />'), 'rates age from the date they were checked')
  assert.match(mod, /<DataBadge cls="DELAYED" source="national statistics agencies, checked" at=\{COUNTRY_STATS_CHECKED\} compact \/>/)
})

test('Global: no undated "Static fallback" line, no typed air volumes, rankings or route status, no port ranks', () => {
  const mod = read('src/modules/global/GlobalModule.jsx')
  assert.doesNotMatch(mod, /Static fallback|Jun 2026 · ACI\/IATA|Rank #|TOP_CARGO_|AU_AIRPORT_CARGO|\$6\.8T|Routes monitored|Click an arc|dailyFlights/)
  assert.doesNotMatch(mod, /type:'port',\s*rank:/)
  assert.match(mod, /\{ROUTE_STATUS_SOURCE\}, entered \{formatDate\(CHOKEPOINT_ENTRIES\[0\]\)\}/)
})

test('Global #13: open count follows the clock; close, pin and filter buttons are named; the ticker can be paused without a mouse; Esri cannot be chosen while off', () => {
  const mod = read('src/modules/global/GlobalModule.jsx')
  const summary = mod.slice(mod.indexOf('function WorldStatsSummary'), mod.indexOf('function WorldStatsSummary') + 400)
  assert.match(summary, /useNow\(60_000\)/)
  assert.doesNotMatch(summary, /useMemo\(\(\) => EXCHANGES\.filter/)
  for (const l of ['Close country panel', 'Close exchange panel', 'Close intelligence panel', 'Close detail panel', 'Pin intelligence panel open']) assert.match(mod, new RegExp(`aria-label="${l.replace(/[()]/g, '\\$&')}"`))
  assert.doesNotMatch(mod, /console\.log/)
  const intel = read('src/modules/global/IntelPanel.jsx')
  assert.match(intel, /onClick=\{\(\) => onChange\(f\)\} aria-pressed=\{value === f\}/)
  assert.match(intel, /aria-pressed=\{paused\}/)
  const css = read('src/index.css')
  assert.match(css, /\.intel-ticker:focus-within \.intel-ticker-track,\n\.intel-ticker\.is-paused \.intel-ticker-track \{ animation-play-state: paused; \}/)
  assert.match(read('src/modules/global/DeckGLMap.jsx'), /concat\(licenceOff\('esri'\) \? \[\] :/)
  assert.match(read('src/modules/global/DeckGLMap.jsx'), /useState\('dark'\)/, 'the basemap is not restored from storage, so a saved Esri choice cannot load')
})

test('Global: every policy rate shown was checked against its own bank; unverified ones are not shown; no typed rate remains', async () => {
  const { POLICY_RATES, POLICY_RATES_CHECKED } = await import('../src/data/verifiedConstants.js')
  const OWN = { rbi: 'rbi.org.in', bok: 'bok.or.kr', mas: 'mas.gov.sg', bcb: 'bcb.gov.br', banxico: 'banxico.org.mx', bcra: 'bcra.gob.ar', sama: 'sama.gov.sa', cbuae: 'centralbank.ae', cbe: 'cbe.org.eg', cbn: 'cbn.gov.ng', sarb: 'resbank.co.za', tcmb: 'tcmb.gov.tr', norges: 'norges-bank.no', cbr: 'cbr.ru', hkma: 'hkma.gov.hk', cbc: 'cbc.gov.tw', sbv: 'sbv.gov.vn', bot: 'bot.or.th', bnm: 'bnm.gov.my', bsp: 'bsp.gov.ph', bi: 'bi.go.id', sbp: 'sbp.org.pk', nbu: 'bank.gov.ua' }
  assert.deepEqual(Object.keys(POLICY_RATES).sort(), Object.keys(OWN).sort())
  assert.match(POLICY_RATES_CHECKED, /^\d{4}-\d{2}-\d{2}$/)
  for (const [k, p] of Object.entries(POLICY_RATES)) {
    assert.equal(new URL(p.url).hostname.replace(/^www\./, ''), OWN[k], `${k} is sourced from its own bank`)
    assert.match(p.decided, /^\d{4}-\d{2}-\d{2}$/, k)
    assert.ok(p.none ? p.rate == null : Number.isFinite(p.rate), k)
  }
  const mod = read('src/modules/global/GlobalModule.jsx')
  const start = mod.indexOf('const COUNTRY_DETAIL = {')
  const table = mod.slice(start, mod.indexOf('\n}\n', start))
  assert.doesNotMatch(table, /rate:\s*[\d.]+/, 'no typed policy rate in the country table')
  for (const bank of ['BCCh', 'BanRep']) assert.ok(table.includes(`rateNotRead('${bank}')`), bank)
  assert.doesNotMatch(mod, /enriched\?\.interestRate\b/)
  assert.doesNotMatch(read('src/data/countryDatabase.js'), /^\s*interestRate:/m)
  assert.doesNotMatch(read('src/hooks/useCountryData.js'), /interestRate:\s/)
})

test('Global country panel: GDP and CPI only as read from the agency, with a link; no typed figures, ratings, outlook or rankings remain', async () => {
  const { COUNTRY_STATS, COUNTRY_STATS_CHECKED } = await import('../src/data/verifiedConstants.js')
  const OWN = { AU: 'abs.gov.au', US: /bea\.gov|bls\.gov/, CN: 'stats.gov.cn', JP: /esri\.cao\.go\.jp|stat\.go\.jp/, GB: 'ons.gov.uk', EA: 'ec.europa.eu', DE: 'destatis.de', IN: 'mospi.gov.in', CA: 'statcan.gc.ca', NZ: 'stats.govt.nz', KR: /bok\.or\.kr|mods\.go\.kr/, SG: /mti\.gov\.sg|singstat\.gov\.sg/, BR: 'ibge.gov.br', MX: 'inegi.org.mx' }
  assert.deepEqual(Object.keys(COUNTRY_STATS).sort(), Object.keys(OWN).sort())
  assert.match(COUNTRY_STATS_CHECKED, /^\d{4}-\d{2}-\d{2}$/)
  for (const [k, v] of Object.entries(COUNTRY_STATS)) for (const f of ['gdp', 'cpi']) {
    const x = v[f]
    assert.ok(Number.isFinite(x.value) && x.measure && x.period && /^\d{4}-\d{2}-\d{2}$/.test(x.released) && x.agency, `${k}.${f}`)
    const host = new URL(x.url).hostname
    assert.ok(typeof OWN[k] === 'string' ? host.endsWith(OWN[k]) : OWN[k].test(host), `${k}.${f} is read from its agency (${host})`)
  }
  const db = read('src/data/countryDatabase.js')
  assert.doesNotMatch(db, /^\s*(population|area|gdpTotal|gdpPerCapita|gdpGrowth|inflation|unemployment|auTradeValue|politicalStability|economicOutlook|sanctionsStatus|conflictStatus|creditRating|topExports|topImports|topTradingPartners|description|auRelationship):/m)
  const mod = read('src/modules/global/GlobalModule.jsx')
  assert.match(mod, /data-stats-note>\s*GDP growth and inflation are shown only once read from the national statistics agency\. More countries will be added as they are verified\./)
  assert.doesNotMatch(mod, /Economic Outlook|Political Stability|Credit Rating|CONFLICT ZONE|SANCTIONED|Top Exports|Top Partners|GDP \/ Capita|GDP Total|initCountryDataRefresh/)
  const detail = mod.slice(mod.indexOf('const COUNTRY_DETAIL = {'), mod.indexOf('\n}\n', mod.indexOf('const COUNTRY_DETAIL = {')))
  assert.doesNotMatch(detail, /\bgdp:\s*-?\d|\bcpi:\s*-?\d|partners:\[/)
  assert.doesNotMatch(read('src/hooks/useCountryData.js'), /getCountryCache|wbData|imfData/)
  assert.match(read('src/data/sourceLicence.js'), /worldbank:/)
})
