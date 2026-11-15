// ETF data (15 Nov 2026): fee, index and fund size only as read from the
// issuer, with a link and dates; no typed returns, yields or holdings; the
// AI is asked to describe, never whether a fund suits anyone.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { AU_ETFS as ETF_UNIVERSE } from '../src/data/etfData.js'

test('every fee and fund size is the issuer\'s, dated and linked; nothing else is typed', () => {
  assert.ok(ETF_UNIVERSE.length >= 20)
  for (const e of ETF_UNIVERSE) {
    for (const k of ['yield', 'oneYear', 'threeYear', 'fiveYear', 'holdings']) assert.equal(e[k] ?? null, null, `${e.ticker}.${k}`)
    assert.ok(!('note' in e) && !('description' in e), `${e.ticker} carries no evaluative note`)
    if (e.mer != null || e.aum != null) {
      assert.match(e.checked, /^\d{4}-\d{2}-\d{2}$/, e.ticker)
      assert.match(e.sourceUrl, /^https:\/\/(www\.)?(blackrock|betashares|ssga|globalxetfs)\./, e.ticker)
    } else {
      assert.ok(e.unverified, `${e.ticker} says why it has no figures`)
    }
  }
  assert.ok(!ETF_UNIVERSE.some((e) => e.ticker === 'GLD'), 'GLD is not an ASX code (Global X trades as GOLD)')
})

test('ETF prompts describe; no suitability, yield or return columns', () => {
  const mod = fs.readFileSync('src/modules/etf/ETFModule.jsx', 'utf8')
  assert.doesNotMatch(mod, /and whether it suits|for an Australian long-term investor|HIGHEST YIELD|key: 'yield'|key: 'oneYear'/)
  assert.match(mod, /do not say whether it suits anyone/)
})
