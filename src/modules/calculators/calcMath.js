// Pure finance maths for the calculator suite. No React, no formatting — so
// every function here can be checked against a hand calculation, which is the
// only reason to trust a calculator that produces a number someone budgets on.

// Future value of a lump sum plus a regular contribution, compounded n times a
// year. The contribution is treated as end-of-period (ordinary annuity), which
// is the conservative convention and the one most published calculators use.
export function compound({ initial, contribution, contributionsPerYear, annualRate, years, compoundsPerYear }) {
  const n = compoundsPerYear
  const r = annualRate / 100 / n
  const periods = years * n
  // Contributions may arrive at a different cadence from compounding (monthly
  // deposits, quarterly compounding), so they are converted to a per-period
  // amount rather than assumed to match.
  const perPeriod = (contribution * contributionsPerYear) / n

  const series = []
  let balance = initial
  let contributed = initial
  for (let p = 1; p <= periods; p++) {
    balance = balance * (1 + r) + perPeriod
    contributed += perPeriod
    if (p % n === 0 || p === periods) {
      series.push({ year: Math.round(p / n), value: balance, contributed, returns: balance - contributed })
    }
  }
  return {
    final: balance,
    contributed,
    returns: balance - contributed,
    roi: contributed > 0 ? ((balance - contributed) / contributed) * 100 : 0,
    series: [{ year: 0, value: initial, contributed: initial, returns: 0 }, ...series],
  }
}

// Dividend reinvestment. Shares compound; the cash alternative does not, which
// is the whole comparison.
export function drp({ shares, price, yieldPct, participation, years, growthPct = 0 }) {
  let held = shares
  let px = price
  let cashTaken = 0
  for (let y = 0; y < years; y++) {
    px = px * (1 + growthPct / 100)
    const income = held * px * (yieldPct / 100)
    const reinvested = income * (participation / 100)
    cashTaken += income - reinvested
    held += reinvested / px
  }
  const drpValue = held * px
  const cashValue = shares * px + cashTaken
  return { finalShares: held, finalPrice: px, drpValue, cashValue, advantage: drpValue - cashValue, cashTaken }
}

// Standard amortising loan payment.
export function loanPayment(principal, annualRatePct, years, paymentsPerYear = 12) {
  const r = annualRatePct / 100 / paymentsPerYear
  const n = years * paymentsPerYear
  if (n <= 0) return 0
  if (r === 0) return principal / n
  return (principal * r) / (1 - (1 + r) ** -n)
}

// Amortisation schedule, and the month principal first exceeds interest —
// which is the one milestone in a 30-year loan that people can feel.
export function amortise(principal, annualRatePct, years, paymentsPerYear = 12) {
  const pay = loanPayment(principal, annualRatePct, years, paymentsPerYear)
  const r = annualRatePct / 100 / paymentsPerYear
  const n = Math.round(years * paymentsPerYear)
  let balance = principal
  let totalInterest = 0
  let crossover = null
  const rows = []
  for (let p = 1; p <= n && balance > 0; p++) {
    const interest = balance * r
    const principalPart = Math.min(pay - interest, balance)
    balance -= principalPart
    totalInterest += interest
    if (crossover == null && principalPart > interest) crossover = p
    rows.push({ period: p, payment: pay, interest, principal: principalPart, balance: Math.max(0, balance) })
  }
  return { payment: pay, totalInterest, totalPaid: pay * n, crossover, rows }
}

// Superannuation projection. Contributions are taxed at 15% going in, which is
// the entire reason salary sacrifice works and is easy to leave out.
export function superProjection({ age, retireAge, balance, salary, sgRate, extraAnnual, returnPct, contributionsTax = 0.15 }) {
  const years = Math.max(0, retireAge - age)
  const series = []
  let bal = balance
  let totalContrib = 0
  for (let y = 1; y <= years; y++) {
    const gross = salary * sgRate + extraAnnual
    const net = gross * (1 - contributionsTax)
    bal = bal * (1 + returnPct / 100) + net
    totalContrib += net
    series.push({ age: age + y, value: bal, contributed: balance + totalContrib })
  }
  return { final: bal, years, totalContrib, series }
}

// CGT. The 50% discount applies to assets held more than twelve months.
export function cgt({ buy, sell, buyDate, sellDate, marginalPct }) {
  const gain = sell - buy
  const held = (new Date(sellDate) - new Date(buyDate)) / 86400000
  const discounted = held > 365
  const taxable = gain <= 0 ? gain : discounted ? gain / 2 : gain
  const tax = taxable > 0 ? taxable * (marginalPct / 100) : 0
  return {
    gain, heldDays: Math.round(held), discounted,
    taxable, tax,
    net: gain - tax,
    effective: gain > 0 ? (tax / gain) * 100 : 0,
  }
}
