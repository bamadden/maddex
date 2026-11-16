// The source fetchers (scripts/data/sources) parse each agency's format and
// compare it with the constants; mocked responses only (no network in tests).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SOURCES } from '../scripts/data/sources/index.mjs'
import { recordingFetch, shapeOf, row } from '../scripts/data/lib.mjs'

const VC = {
  rba: { cashRate: 4.85 }, bonds: { au10y: 5.04, au10yAsOf: '2026-11-11' },
  au: { cpi: 4.3, cpiTrimmedMean: 3.6, cpiPeriod: 'Sep 2026', unemployment: 4.7, unemploymentPeriod: 'Sep 2026', gdpQoQ: 0.4, gdpAnnual: 2.1, gdpPeriod: 'Jun 2026 quarter' },
  us: { cpi: 3.7, cpiCore: 2.6, cpiPeriod: 'Sep 2026', unemployment: 4.1, unemploymentPeriod: 'Oct 2026' },
  ecb: { cashRate: 2.5 }, boc: { cashRate: 2.25 },
}

const csv = (rows) => rows.join('\n')
const abs = (rows) => csv(['DATAFLOW,TIME_PERIOD,OBS_VALUE', ...rows.map(([p, v]) => `X,${p},${v}`)])
const RESPONSES = [
  [/a2-data/, csv(['A2 MONETARY POLICY CHANGES', 'Title,Change,New cash rate target', '30-Sep-2026,0.25,4.60', '04-Nov-2026,0.25,4.85'])],
  [/f2-data/, csv(['F2', 'Title,Australian Government 2 year bond,Australian Government 10 year bond', 'Series ID,FCMYGBAG2D,FCMYGBAG10D', '10-Nov-2026,4.744,4.989', '11-Nov-2026,4.808,5.044'])],
  [/3\.10001\.10\.50\.M/, abs([['2026-08', '4.1'], ['2026-09', '4.3']])],
  [/3\.999902\.20\.50\.M/, abs([['2026-09', '3.6']])],
  [/2\.10001\.10\.50\.Q/, abs([['2026-Q3', '1.1']])],
  [/M13\.3\.1599/, abs([['2026-09', '4.7']])],
  [/M2\.GPM/, abs([['2026-Q2', '0.4']])],
  [/M1\.GPM/, abs([['2025-Q2', '100'], ['2026-Q2', '102.1']])],
  [/api\.bls\.gov/, JSON.stringify({ status: 'REQUEST_SUCCEEDED', Results: { series: [
    { seriesID: 'CUUR0000SA0', data: [{ year: '2026', period: 'M10', value: '337.5' }, { year: '2026', period: 'M09', value: '320.0' }, { year: '2025', period: 'M09', value: '308.6' }] },
    { seriesID: 'CUUR0000SA0L1E', data: [{ year: '2026', period: 'M09', value: '100' }, { year: '2025', period: 'M09', value: '97.466' }] },
    { seriesID: 'LNS14000000', data: [{ year: '2026', period: 'M10', value: '4.1' }] },
  ] } })],
  [/data-api\.ecb/, csv(['KEY,FREQ,TIME_PERIOD,OBS_VALUE', 'FM.D,D,2026-11-16,2.5'])],
  [/bankofcanada/, JSON.stringify({ observations: [{ d: '2026-11-12', V39079: { v: '2.50' } }] })],
]
globalThis.fetch = async (url) => {
  const hit = RESPONSES.find(([re]) => re.test(String(url)))
  return new Response(hit ? hit[1] : 'not found', { status: hit ? 200 : 404 })
}

for (const [id, src] of Object.entries(SOURCES)) {
  test(`${id}: parses its format and compares with the constants`, async () => {
    const shapes = {}
    const rec = { source: id, ...(await src.fetchRecord(recordingFetch(shapes))) }
    const rows = src.verify(rec, VC)
    assert.ok(rows.length > 0)
    assert.ok(Object.keys(shapes).length > 0, 'response shapes recorded for the format check')
    for (const r of rows) assert.ok(['match', 'drift', 'missing', 'unavailable', 'period'].includes(r.status), `${r.label}: ${r.status}`)
    if (id === 'boc') assert.equal(rows[0].status, 'drift', 'a changed rate is reported as drift')
    else assert.deepEqual(rows.filter((r) => r.status !== 'match').map((r) => `${r.label}: ${r.status}`), [])
  })
}

test('BLS: the 12-month change needs a year-earlier index; a month without one is not invented', async () => {
  const rec = await SOURCES.bls.fetchRecord(recordingFetch({}))
  assert.deepEqual(rec.figures.cpi.map((o) => o.period), ['Sep 2026'])
})

test('a format change is visible in the recorded shape', () => {
  assert.deepEqual(shapeOf('TIME_PERIOD,OBS_VALUE\n2026-09,4.3'), { kind: 'csv', header: 'TIME_PERIOD,OBS_VALUE', seriesIds: null })
  assert.deepEqual(shapeOf('{"b":1,"a":2}'), { kind: 'json', keys: ['a', 'b'] })
  assert.equal(shapeOf('<html>').kind, 'csv')
  assert.equal(row('x', 'k', 1, null, 'p').status, 'unavailable')
  assert.equal(row('x', 'k', null, 1, 'p').status, 'missing')
})
