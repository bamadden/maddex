import { getMockFMPRow } from '../../services/mockData'
import {
  annualise, bondGrowth, cashGrowth, cgtEstimate, daysBetween, dividendsFor, heldTwelveMonths,
} from '../../services/performanceMath'

// ─── Returns per position and for the portfolio ────────────────────────────
//
// Everything the summary card, the returns table and the export read, built
// once from the holdings (merged by symbol), the individual lots and the
// transaction ledger.
//
// Lot-level throughout where it matters:
//   - cost basis is the units-weighted average across every lot (mergeLots
//     already sums cost and units, so avgCost = total cost / total units);
//   - days held for annualising is the COST-weighted mean of each lot's days,
//     so a large recent lot pulls the period toward today as it should;
//   - the CGT discount is decided lot by lot, since one position can hold a
//     parcel past twelve months and another short of it.

const yieldOf = (h) =>
  h.divYield ?? getMockFMPRow(h.type === 'asx' ? `${h.symbol}.AX` : h.symbol)?.dividendYield ?? 0

const lotKey = (h) => `${h.type}:${h.symbol}`

export function buildReturns({ holdings, lots, transactions, toAud, today, taxRate, yields }) {
  const lotsBy = new Map()
  for (const l of lots) if (l.mktVal != null) (lotsBy.get(lotKey(l)) ?? lotsBy.set(lotKey(l), []).get(lotKey(l))).push(l)

  const positions = []
  const parcels = []
  for (const h of holdings) {
    if (h.mktVal == null || !(h.totalCost > 0)) continue
    const ls = (lotsBy.get(lotKey(h)) ?? []).slice().sort((a, b) => (a.addedAt < b.addedAt ? -1 : 1))
    if (!ls.length) continue
    const cost = h.totalCost
    const lotDays = ls.map((l) => Math.max(0, daysBetween(l.addedAt, today)))
    const days = ls.reduce((s, l, i) => s + l.totalCost * lotDays[i], 0) / cost
    const { recorded, estimated } = dividendsFor(h, ls, transactions, { toAud, yieldPct: yieldOf(h), today })
    const divs = recorded + estimated
    const lotParcels = ls.map((l) => ({ gain: l.pnl, longTerm: heldTwelveMonths(l.addedAt, today) }))
    parcels.push(...lotParcels)
    const tax = cgtEstimate(lotParcels, taxRate).tax
    const priceRet = h.pnl / cost
    const totalRet = (h.pnl + divs) / cost
    const afterTaxRet = (h.pnl - tax + divs) / cost
    positions.push({
      key: lotKey(h),
      symbol: h.symbol,
      label: h.type === 'asx' ? `${h.symbol}.AX` : h.symbol,
      type: h.type,
      lots: ls.map((l, i) => ({ units: l.shares, price: l.avgCost, currency: l.costCurrency ?? 'AUD', date: l.addedAt, days: lotDays[i], cost: l.totalCost, longTerm: lotParcels[i].longTerm })),
      units: h.shares,
      avgCostAud: cost / h.shares,
      firstDate: ls[0].addedAt,
      cost, value: h.mktVal, pnl: h.pnl,
      divRecorded: recorded, divEstimated: estimated, divs,
      days,
      tax,
      priceRet, totalRet, afterTaxRet,
      annPrice: annualise(priceRet, days),
      annTotal: annualise(totalRet, days),
      annAfterTax: annualise(afterTaxRet, days),
      // Like-for-like benchmarks: the same money, on the same dates.
      cashGain: ls.reduce((s, l) => { const g = cashGrowth(l.addedAt, today); return g == null ? s : s + l.totalCost * (g - 1) }, 0),
      bondGain: yields ? ls.reduce((s, l) => { const g = bondGrowth(yields, l.addedAt, today); return g == null ? NaN : s + l.totalCost * (g - 1) }, 0) : null,
    })
  }
  if (!positions.length) return null

  const cost = positions.reduce((s, p) => s + p.cost, 0)
  const value = positions.reduce((s, p) => s + p.value, 0)
  const pnl = value - cost
  const divRecorded = positions.reduce((s, p) => s + p.divRecorded, 0)
  const divEstimated = positions.reduce((s, p) => s + p.divEstimated, 0)
  const divs = divRecorded + divEstimated
  const days = positions.reduce((s, p) => s + p.cost * p.days, 0) / cost
  // Portfolio tax nets every parcel together — a loss on one holding offsets
  // a gain on another — so it is less than the sum of the per-position
  // figures, which each stand alone.
  const cgt = cgtEstimate(parcels, taxRate)
  const priceRet = pnl / cost
  const totalRet = (pnl + divs) / cost
  const afterTaxRet = (pnl - cgt.tax + divs) / cost
  const cashGain = positions.reduce((s, p) => s + p.cashGain, 0)
  const bondGain = positions.every((p) => Number.isFinite(p.bondGain)) ? positions.reduce((s, p) => s + p.bondGain, 0) : null
  const firstDate = positions.reduce((m, p) => (p.firstDate < m ? p.firstDate : m), positions[0].firstDate)

  return {
    positions,
    portfolio: {
      cost, value, pnl, divRecorded, divEstimated, divs, days, firstDate, cgt,
      priceRet, totalRet, afterTaxRet,
      annPrice: annualise(priceRet, days),
      annTotal: annualise(totalRet, days),
      annAfterTax: annualise(afterTaxRet, days),
      cashRet: cashGain / cost,
      bondRet: bondGain == null ? null : bondGain / cost,
    },
  }
}

export const taxNoteFor = (rate) =>
  `After-tax return assumes a ${rate}% tax rate and the 50% CGT discount for parcels held at least 12 months. `
  + 'Unrealised gains only: dividends are shown before tax and franking credits are not modelled. Estimate only — seek tax advice.'

// Which return the card and table lead with.
export const basisOf = (afterTax) => (afterTax
  ? { ret: 'afterTaxRet', ann: 'annAfterTax', label: 'after-tax' }
  : { ret: 'totalRet', ann: 'annTotal', label: 'total' })

// ─── Export ─────────────────────────────────────────────────────────────────

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const pct = (v) => (v == null || !Number.isFinite(v) ? '' : (v * 100).toFixed(2))
const aud = (v) => (v == null || !Number.isFinite(v) ? '' : v.toFixed(2))

export function performanceCsv(model, { today, taxRate, taxNote, bondAsOf }) {
  const p = model.portfolio
  const rows = [
    ['# Maddex performance report', today],
    ['# Prices are DEMO data until a live equities feed is connected. General information only — not financial or tax advice.'],
    [],
    ['PORTFOLIO SUMMARY'],
    ['Since', p.firstDate],
    ['Cost (AUD)', aud(p.cost)],
    ['Value (AUD)', aud(p.value)],
    ['Price gain (AUD)', aud(p.pnl)],
    ['Dividends recorded (AUD)', aud(p.divRecorded)],
    ['Dividends estimated from yield (AUD)', aud(p.divEstimated)],
    ['Price return %', pct(p.priceRet)],
    ['Total return %', pct(p.totalRet)],
    ['Total return annualised %', pct(p.annTotal)],
    ['Cost-weighted days held', p.days.toFixed(0)],
    [],
    ['BENCHMARKS — the same purchases, on the same dates'],
    ['Cash at the RBA cash rate %', pct(p.cashRet)],
    ['10-year Commonwealth bond %', p.bondRet == null ? 'unavailable' : pct(p.bondRet), bondAsOf ? `RBA F2 yields to ${bondAsOf}` : ''],
    ['Portfolio total return vs cash (pp)', ((p.totalRet - p.cashRet) * 100).toFixed(2)],
    [],
    ['TAX-AWARE ESTIMATE'],
    ['Rate applied %', taxRate],
    ['Estimated CGT if sold today (AUD)', aud(p.cgt.tax)],
    ['After-tax total return %', pct(p.afterTaxRet)],
    ['Losses carried forward (AUD)', aud(p.cgt.carriedLoss)],
    ['Note', taxNote],
    [],
    ['HOLDINGS'],
    ['Ticker', 'First purchase', 'Lots', 'Units', 'Avg cost (AUD)', 'Cost (AUD)', 'Value (AUD)', 'Price return %', 'Dividends (AUD)', 'Dividends basis', 'Total return %', 'Days held', 'Annualised %', 'Est. CGT (AUD)', 'After-tax return %', 'Same money in cash %'],
    ...model.positions.map((x) => [
      x.label, x.firstDate, x.lots.length, x.units, aud(x.avgCostAud), aud(x.cost), aud(x.value),
      pct(x.priceRet), aud(x.divs), x.divRecorded > 0 ? 'recorded' : x.divEstimated > 0 ? 'estimated from yield' : 'none',
      pct(x.totalRet), x.days.toFixed(0), x.days < 30 ? 'under 30 days' : pct(x.annTotal), aud(x.tax), pct(x.afterTaxRet),
      pct(x.cashGain / x.cost),
    ]),
    [],
    ['LOTS'],
    ['Ticker', 'Date', 'Units', 'Price', 'Currency', 'Cost (AUD)', 'Days held', 'CGT discount eligible'],
    ...model.positions.flatMap((x) => x.lots.map((l) => [x.label, l.date, l.units, l.price, l.currency, aud(l.cost), l.days, l.longTerm ? 'yes' : 'no'])),
    [],
    ['DISCLAIMER', 'Estimate only. Unrealised gains, taxed parcel by parcel at each lot\'s own cost and date; no franking credits, no carried-forward losses from earlier years. Estimated dividends accrue the current yield and ignore ex-dividend dates. Seek tax advice.'],
  ]
  return rows.map((r) => r.map(cell).join(',')).join('\n')
}
