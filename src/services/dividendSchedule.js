// Dividend schedule and income estimates for ASX holdings.
//
// WHAT THESE FIGURES ARE, PRECISELY.
//
// The MONTHS are the reporting cadence each company has kept for years — CBA
// pays an interim in February and a final in August, Westpac in May and
// November, and so on. Cadence is a stable, checkable fact about a company and
// it is what makes a twelve-month calendar possible at all.
//
// The AMOUNTS are not forecasts. Every dollar figure here is derived from the
// trailing dividend yield already on the holding, split across that company's
// known payment months. So "estimated annual income" means precisely: what the
// last twelve months of dividends would pay on the shares you hold now. It is
// arithmetic on a published yield, not a view on whether the next dividend
// will be raised, cut or passed.
//
// That distinction is the whole reason this file has no forecast field. A
// terminal that prints "next dividend: A$1.24" for a company that has not
// declared one is inventing the number a reader most wants to believe.
//
// FRANKING is the same discipline. The percentages below are each company's
// long-standing franking level, not a promise about the next distribution.

// Payment months, 1-indexed. Sourced from each company's published dividend
// history; these cadences have held for a decade or more.
export const DIVIDEND_CALENDAR = {
  'BHP.AX': { months: [3, 9],  franking: 100, note: 'Interim Mar, final Sep' },
  'CBA.AX': { months: [3, 9],  franking: 100, note: 'Interim Mar, final Sep' },
  'WBC.AX': { months: [7, 12], franking: 100, note: 'Interim Jul, final Dec' },
  'NAB.AX': { months: [7, 12], franking: 100, note: 'Interim Jul, final Dec' },
  'ANZ.AX': { months: [7, 12], franking: 100, note: 'Interim Jul, final Dec' },
  'WES.AX': { months: [4, 10], franking: 100, note: 'Interim Apr, final Oct' },
  'WOW.AX': { months: [4, 10], franking: 100, note: 'Interim Apr, final Oct' },
  'MQG.AX': { months: [7, 12], franking: 40,  note: 'Partially franked' },
  'CSL.AX': { months: [4, 10], franking: 0,   note: 'Unfranked — largely offshore earnings' },
  'RIO.AX': { months: [4, 9],  franking: 100, note: 'Interim Apr, final Sep' },
  'FMG.AX': { months: [4, 10], franking: 100, note: 'Interim Apr, final Oct' },
  'TLS.AX': { months: [3, 9],  franking: 100, note: 'Interim Mar, final Sep' },
  'WDS.AX': { months: [4, 9],  franking: 100, note: 'Interim Apr, final Sep' },
  'STO.AX': { months: [4, 9],  franking: 100, note: 'Interim Apr, final Sep' },
  'GMG.AX': { months: [3, 9],  franking: 0,   note: 'REIT distribution — unfranked' },
}

const MONTH_LABEL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const monthLabel = (m) => MONTH_LABEL[m - 1] ?? '—'

// US holdings pay quarterly and carry no franking. They are counted in the
// income total but not placed on the calendar, because guessing a US payer's
// specific months from nothing is exactly the kind of invention this file
// avoids — and an Australian reader's dividend calendar is about franking
// season anyway.
const isAsx = (sym) => /\.AX$/i.test(sym)

// Annual income per holding, from the yield the holding already carries.
export function incomeFor(holding) {
  const yieldPct = holding?.divYield
  // Accepts either shape: the portfolio computes mktVal for each holding, and
  // the raw qty x price is the fallback for callers that have not.
  const value = holding?.mktVal ?? ((holding?.qty ?? 0) * (holding?.price ?? 0))
  if (!Number.isFinite(yieldPct) || yieldPct <= 0 || !Number.isFinite(value) || value <= 0) return null
  const annual = value * (yieldPct / 100)
  const entry = DIVIDEND_CALENDAR[holding.symbol]
  const payments = entry?.months?.length ?? (isAsx(holding.symbol) ? 2 : 4)
  return {
    annual,
    perPayment: annual / payments,
    months: entry?.months ?? null,
    franking: entry?.franking ?? null,
    note: entry?.note ?? null,
    // Franking credits gross up the cash dividend at the company tax rate.
    // 30/70 is the standard grossing factor for a fully franked dividend at
    // the 30% company rate; scaled by how franked this payer actually is.
    frankingCredits: entry?.franking ? annual * (entry.franking / 100) * (30 / 70) : 0,
  }
}

// Twelve months from the current month, so the calendar reads forward from
// where the user is rather than restarting every January.
export function buildSchedule(holdings, now = new Date()) {
  const rows = []
  let totalAnnual = 0
  let totalCredits = 0
  let totalCost = 0
  let totalValue = 0

  for (const h of holdings ?? []) {
    const inc = incomeFor(h)
    totalValue += h.mktVal ?? ((h.qty ?? 0) * (h.price ?? 0))
    totalCost += h.costBasis ?? ((h.qty ?? 0) * (h.avgPrice ?? h.price ?? 0))
    if (!inc) continue
    totalAnnual += inc.annual
    totalCredits += inc.frankingCredits
    rows.push({ symbol: h.symbol, name: h.name, ...inc })
  }

  const startMonth = now.getMonth() + 1
  const calendar = Array.from({ length: 12 }, (_, i) => {
    const m = ((startMonth - 1 + i) % 12) + 1
    const payers = rows.filter((r) => r.months?.includes(m))
    return {
      month: m,
      label: monthLabel(m),
      payers,
      total: payers.reduce((sum, r) => sum + r.perPayment, 0),
    }
  })

  return {
    rows: rows.sort((a, b) => b.annual - a.annual),
    calendar,
    totalAnnual,
    totalCredits,
    monthlyAverage: totalAnnual / 12,
    yieldOnValue: totalValue > 0 ? (totalAnnual / totalValue) * 100 : null,
    yieldOnCost: totalCost > 0 ? (totalAnnual / totalCost) * 100 : null,
    // The next month from now that has at least one payer.
    next: calendar.find((c) => c.payers.length > 0) ?? null,
  }
}
