// MARKET RELATIONSHIPS — how key assets have moved together, measured.
//
// Correlations of daily changes over the last ~60 shared trading days, from
// the real daily series this build can reach:
//   AUD/USD      Frankfurter (ECB reference rates)
//   Gold         CoinGecko PAX Gold (PAXG), a token backed 1:1 by LBMA gold,
//                used because no free daily gold feed answers from a browser
//   BTC, ETH     CoinGecko
//   AU 10Y       RBA table F2, daily
//
// Prices use log returns; the bond yield uses the change in yield (a yield is
// already a rate, and a 1bp move from 4% is not a 0.25% "return").
//
// Pairs that need a series this build does not have — iron ore (no free daily
// feed), the ASX 200, S&P 500 and tech stocks (demo histories only) — are
// listed as not computed, rather than filled with a number from demo walks.

export const SERIES = [
  { id: 'AUDUSD', label: 'AUD/USD', kind: 'price', source: 'Frankfurter (ECB)' },
  { id: 'GOLD', label: 'GOLD', kind: 'price', source: 'CoinGecko PAXG (gold-backed token)' },
  { id: 'BTC', label: 'BTC', kind: 'price', source: 'CoinGecko' },
  { id: 'ETH', label: 'ETH', kind: 'price', source: 'CoinGecko' },
  { id: 'AU10Y', label: 'AU 10Y', kind: 'yield', source: 'RBA F2' },
]

export const WINDOW = 60

// → Map(date → value)
export function fromFrankfurter(data, ccy = 'USD') {
  const m = new Map()
  for (const [d, r] of Object.entries(data?.rates ?? {})) if (Number.isFinite(r?.[ccy])) m.set(d, r[ccy])
  return m
}
export function fromCoinGecko(data) {
  const m = new Map()
  for (const [ts, p] of data?.prices ?? []) if (Number.isFinite(p)) m.set(new Date(ts).toISOString().slice(0, 10), p)
  return m
}
export function fromF2(yields) {
  const m = new Map()
  for (const r of yields ?? []) if (Number.isFinite(r.y)) m.set(r.date, r.y)
  return m
}

function pearson(a, b) {
  const n = a.length
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : null
}

// Changes between consecutive dates both series share, last WINDOW of them.
export function correlate(x, y, kindX = 'price', kindY = 'price', window = WINDOW) {
  if (!x?.size || !y?.size) return null
  const dates = [...x.keys()].filter((d) => y.has(d)).sort()
  if (dates.length < 26) return null
  const chg = (m, kind, d0, d1) => (kind === 'yield' ? m.get(d1) - m.get(d0) : Math.log(m.get(d1) / m.get(d0)))
  const a = [], b = []
  for (let i = 1; i < dates.length; i++) {
    a.push(chg(x, kindX, dates[i - 1], dates[i]))
    b.push(chg(y, kindY, dates[i - 1], dates[i]))
  }
  const n = Math.min(window, a.length)
  const r = pearson(a.slice(-n), b.slice(-n))
  return r == null ? null : { r, n, from: dates[dates.length - n - 1], to: dates[dates.length - 1] }
}

export const strength = (r) => {
  const v = Math.abs(r)
  return v < 0.2 ? 'UNCORRELATED' : v < 0.4 ? 'WEAK' : v < 0.7 ? 'MODERATE' : 'STRONG'
}

// The pairs the panel explains, with what each sign means for an Australian
// investor. `pos`/`neg` are read when |r| ≥ 0.2; `none` below that.
export const PAIRS = [
  {
    a: 'AUDUSD', b: 'GOLD', title: 'Gold vs AUD/USD',
    pos: 'Gold and the Aussie dollar have been rising and falling together — usually both reacting to the US dollar. For an Australian holder, gold priced in A$ moves less than the US$ price suggests.',
    neg: 'Gold has tended to rise when the AUD falls — the classic hedge: a weaker Aussie dollar lifts gold in A$ terms twice over.',
    none: 'Gold and the AUD have moved largely independently lately, so gold has offered little currency hedge either way.',
  },
  {
    a: 'AUDUSD', b: 'BTC', title: 'Bitcoin vs AUD/USD',
    pos: 'Bitcoin has been trading with the Aussie dollar — both behaving as "risk-on" assets that rise when global appetite for risk improves.',
    neg: 'Bitcoin has moved against the AUD — when the currency weakens, BTC in A$ terms has held up better.',
    none: 'Bitcoin and the AUD have moved independently — no strong risk-appetite link in this window.',
  },
  {
    a: 'AU10Y', b: 'AUDUSD', title: 'AU 10Y yield vs AUD/USD',
    pos: 'Higher Australian bond yields have come with a firmer AUD — the rate-differential story: when markets price more RBA tightening, the currency tends to lift.',
    neg: 'Rising AU yields have coincided with a weaker AUD — a sign that global risk, not the RBA, has been driving the currency.',
    none: 'Bond yields and the AUD have not moved together lately — the RBA rate path has not been what is moving the currency.',
  },
  {
    a: 'BTC', b: 'ETH', title: 'Bitcoin vs Ether',
    pos: 'The two largest cryptocurrencies are moving almost in lockstep — holding both diversifies less than it looks.',
    neg: 'BTC and ETH have diverged — unusual, and usually driven by a coin-specific event.',
    none: 'BTC and ETH have decoupled in this window — unusual for the two largest coins.',
  },
  {
    a: 'GOLD', b: 'BTC', title: 'Gold vs Bitcoin',
    pos: 'Gold and Bitcoin have been rising and falling together — both acting as alternatives to fiat currency in this window.',
    neg: 'Gold and Bitcoin have moved in opposite directions — the "digital gold" idea has not held up here.',
    none: 'Gold and Bitcoin have moved independently — they are not substitutes for each other in this window.',
  },
]

export const NOT_COMPUTED = [
  { title: 'AUD/USD vs Iron ore', why: 'No free daily iron ore price feed is connected. The relationship is usually positive — iron ore is Australia\'s largest export, so higher prices tend to support the AUD.' },
  { title: 'ASX 200 vs S&P 500', why: 'Index histories in this build are demo data, so a correlation would describe the demo, not the markets. Historically the two move together on most days.' },
  { title: 'BTC vs Tech stocks', why: 'US stock histories are demo data here. Bitcoin has often traded like a high-growth tech stock in risk-off periods.' },
]

export function explain(pair, r) {
  if (r == null) return null
  return Math.abs(r) < 0.2 ? pair.none : r > 0 ? pair.pos : pair.neg
}
