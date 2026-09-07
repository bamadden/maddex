// ─── Australian ETF universe ────────────────────────────────────────────────
//
// INDICATIVE. Every figure here — AUM, MER, yield, returns, price — is an
// illustrative snapshot, not a feed and not a verified constant. ETF returns
// and fund sizes move constantly and are published by each provider; anyone
// acting on these should read the PDS. The module says so in three places.
//
// The one thing that is NOT indicative is the structure: which funds are
// leveraged or inverse, and what that does to a holder. Those carry a
// `complex` flag that drives a warning the UI cannot render without.

export const ETF_CATEGORIES = [
  { key: 'ALL',          label: 'ALL',              tone: '#C9A84C' },
  { key: 'AU Equity',    label: 'AU EQUITY',        tone: '#C9A84C' },
  { key: 'US Equity',    label: 'US EQUITY',        tone: '#4A7FB5' },
  { key: 'Global Equity', label: 'GLOBAL',          tone: '#637899' },
  { key: 'Multi-Asset',  label: 'MULTI-ASSET',      tone: '#7B2D8A' },
  { key: 'Fixed Income', label: 'FIXED INCOME',     tone: '#2D5A8A' },
  { key: 'Property',     label: 'PROPERTY',         tone: '#8A5A7D' },
  { key: 'Commodities',  label: 'COMMODITIES',      tone: '#8A6A2D' },
  { key: 'Thematic',     label: 'THEMATIC',         tone: '#a855f7' },
  { key: 'ESG',          label: 'ESG',              tone: '#2D8A50' },
  { key: 'Sector',       label: 'SECTOR',           tone: '#B05030' },
  { key: 'Income',       label: 'INCOME',           tone: '#D69E2E' },
  { key: 'COMPLEX',      label: 'LEVERAGED/INVERSE', tone: '#CC4444' },
]

// Per-tick volatility, as a percentage of price. A bond ETF that jitters like a
// tech thematic is not "simulated", it is wrong — the point of the tick is that
// the relative calm of fixed income is visible next to the rest.
export const VOL_BY_CATEGORY = {
  'AU Equity': 0.06, 'US Equity': 0.06, 'Global Equity': 0.06, 'Multi-Asset': 0.05,
  'Fixed Income': 0.02, Property: 0.06, Commodities: 0.08,
  Thematic: 0.09, ESG: 0.06, Sector: 0.07, Income: 0.05,
  Leveraged: 0.12, Inverse: 0.12,
}

export const AU_ETFS = [
  { ticker: 'VAS', name: 'Vanguard Australian Shares Index', provider: 'Vanguard', category: 'AU Equity',
    aum: 14200, mer: 0.07, yield: 3.8, price: 94.82, oneYear: 12.4, threeYear: 8.2, fiveYear: 9.1,
    holdings: 300, benchmark: 'S&P/ASX 300',
    description: 'Broad exposure to the 300 largest ASX-listed companies, market-cap weighted. The most widely held Australian equity ETF.' },
  { ticker: 'IOZ', name: 'iShares Core S&P/ASX 200', provider: 'BlackRock', category: 'AU Equity',
    aum: 6800, mer: 0.09, yield: 3.9, price: 32.14, oneYear: 12.1, threeYear: 8.0, fiveYear: 8.9,
    holdings: 200, benchmark: 'S&P/ASX 200',
    description: 'The ASX 200 in one line. A hundred fewer holdings than VAS, which in a market this concentrated changes very little.' },
  { ticker: 'A200', name: 'BetaShares Australia 200', provider: 'BetaShares', category: 'AU Equity',
    aum: 3800, mer: 0.04, yield: 4.1, price: 138.42, oneYear: 12.2, threeYear: 8.1, fiveYear: 8.8,
    holdings: 200, benchmark: 'S&P/ASX 200', note: 'Lowest MER of any AU equity ETF',
    description: 'The same index as IOZ at less than half the fee. Over decades that difference compounds into real money.' },

  { ticker: 'IVV', name: 'iShares S&P 500', provider: 'BlackRock', category: 'US Equity',
    aum: 12400, mer: 0.04, yield: 1.2, price: 58.24, oneYear: 22.8, threeYear: 10.4, fiveYear: 14.2,
    holdings: 500, benchmark: 'S&P 500',
    description: 'Unhedged exposure to the S&P 500, so returns move with AUD/USD as well as with the index.' },
  { ticker: 'NDQ', name: 'BetaShares NASDAQ 100', provider: 'BetaShares', category: 'US Equity',
    aum: 8200, mer: 0.48, yield: 0.4, price: 42.18, oneYear: 28.4, threeYear: 12.1, fiveYear: 18.4,
    holdings: 100, benchmark: 'NASDAQ 100', note: 'AUD-hedged · tech-heavy',
    description: 'The 100 largest non-financial NASDAQ companies. Highly concentrated in a handful of mega-cap technology names.' },

  { ticker: 'VGS', name: 'Vanguard International Shares', provider: 'Vanguard', category: 'Global Equity',
    aum: 9800, mer: 0.18, yield: 1.8, price: 118.42, oneYear: 18.4, threeYear: 9.2, fiveYear: 11.4,
    holdings: 1500, benchmark: 'MSCI World ex-Australia',
    description: 'Developed-market equities outside Australia. Around 70% United States by weight, which is a concentration people often miss.' },
  { ticker: 'VDHG', name: 'Vanguard Diversified High Growth', provider: 'Vanguard', category: 'Multi-Asset',
    aum: 4200, mer: 0.27, yield: 2.4, price: 62.84, oneYear: 15.8, threeYear: 7.8, fiveYear: 10.2,
    holdings: 7, benchmark: '90/10 growth / defensive',
    description: 'An all-in-one portfolio of seven underlying Vanguard funds, rebalanced for you. One holding instead of six.' },

  { ticker: 'VAF', name: 'Vanguard Australian Fixed Interest', provider: 'Vanguard', category: 'Fixed Income',
    aum: 2800, mer: 0.20, yield: 4.1, price: 48.24, oneYear: 4.8, threeYear: 2.1, fiveYear: 2.8,
    holdings: 120, benchmark: 'Bloomberg AusBond Composite',
    description: 'Australian government and corporate bonds. Prices fall when yields rise — the three-year return reflects exactly that.' },
  { ticker: 'IAF', name: 'iShares Core Composite Bond', provider: 'BlackRock', category: 'Fixed Income',
    aum: 1840, mer: 0.15, yield: 4.0, price: 96.42, oneYear: 4.6, threeYear: 2.0, fiveYear: 2.6,
    holdings: 80, benchmark: 'Bloomberg AusBond Composite' },
  { ticker: 'BOND', name: 'PIMCO Australian Bond', provider: 'PIMCO', category: 'Fixed Income',
    aum: 820, mer: 0.40, yield: 4.2, price: 104.82, oneYear: 5.2, threeYear: 2.4, fiveYear: 2.9,
    holdings: 120, benchmark: 'Actively managed',
    description: 'Actively managed rather than index-tracking, which is what the higher fee buys — and what it has to beat.' },

  { ticker: 'GLD', name: 'ETFS Physical Gold', provider: 'ETF Securities', category: 'Commodities',
    aum: 1200, mer: 0.40, yield: 0, price: 28.84, oneYear: 18.4, threeYear: 14.2, fiveYear: 12.8,
    holdings: 1, benchmark: 'Gold spot price',
    description: 'Physically backed by allocated bullion. Pays no income, so the entire return has to come from the gold price.' },

  { ticker: 'VAP', name: 'Vanguard Australian Property Securities', provider: 'Vanguard', category: 'Property',
    aum: 2400, mer: 0.23, yield: 4.2, price: 84.18, oneYear: 8.4, threeYear: 4.8, fiveYear: 6.2,
    holdings: 30, benchmark: 'S&P/ASX 300 A-REIT',
    description: 'Listed property trusts, not direct property. It behaves like equities with rate sensitivity, not like a house.' },

  { ticker: 'HACK', name: 'BetaShares Global Cybersecurity', provider: 'BetaShares', category: 'Thematic',
    aum: 640, mer: 0.67, yield: 0.2, price: 14.82, oneYear: 22.4, threeYear: 8.4, fiveYear: 14.2,
    holdings: 45, benchmark: 'Nasdaq CTA Cybersecurity' },
  { ticker: 'CLDD', name: 'BetaShares Cloud Computing', provider: 'BetaShares', category: 'Thematic',
    aum: 420, mer: 0.67, yield: 0.1, price: 18.24, oneYear: 24.8, threeYear: 9.2, fiveYear: null,
    holdings: 35, benchmark: 'Indxx Global Cloud Computing' },

  { ticker: 'ETHI', name: 'BetaShares Global Sustainability Leaders', provider: 'BetaShares', category: 'ESG',
    aum: 1840, mer: 0.59, yield: 0.8, price: 22.84, oneYear: 19.4, threeYear: 8.8, fiveYear: 12.4,
    holdings: 200, benchmark: 'Nasdaq Future Global Sustainability Leaders' },

  { ticker: 'QRE', name: 'BetaShares Resources Sector', provider: 'BetaShares', category: 'Sector',
    aum: 480, mer: 0.35, yield: 4.8, price: 7.42, oneYear: 8.4, threeYear: 6.2, fiveYear: 7.8,
    holdings: 30, benchmark: 'Solactive Australia Resources' },
  { ticker: 'QFN', name: 'BetaShares Financials Sector', provider: 'BetaShares', category: 'Sector',
    aum: 520, mer: 0.35, yield: 5.2, price: 22.18, oneYear: 14.8, threeYear: 9.4, fiveYear: 10.2,
    holdings: 20, benchmark: 'Solactive Australia Financials' },

  { ticker: 'HVST', name: 'BetaShares Australian Dividend Harvester', provider: 'BetaShares', category: 'Income',
    aum: 480, mer: 0.76, yield: 6.8, price: 8.42, oneYear: 4.2, threeYear: 2.8, fiveYear: 3.4,
    holdings: 40,
    warning: 'A high headline yield can include return of your own capital rather than income earned. Compare the total return, not the yield — this fund\'s 3-year total return is well below the broad market despite the highest yield on this list.' },

  { ticker: 'GEAR', name: 'BetaShares Geared Australian Equity', provider: 'BetaShares', category: 'Leveraged',
    aum: 380, mer: 0.80, yield: 2.1, price: 42.84, oneYear: 24.8, threeYear: 12.4, fiveYear: 14.8,
    holdings: 200, leverage: 2.0, complex: true, benchmark: '~2x S&P/ASX 200',
    warning: 'COMPLEX PRODUCT. Internally geared — losses are amplified as well as gains, and returns compound daily, so over any period longer than a day the result is NOT simply two times the index.' },
  { ticker: 'BBOZ', name: 'BetaShares Australian Equities Strong Bear', provider: 'BetaShares', category: 'Inverse',
    aum: 480, mer: 1.38, yield: 0, price: 8.24, oneYear: -12.4, threeYear: -8.8, fiveYear: -9.2,
    holdings: 1, leverage: -2.5, complex: true, benchmark: '~-2.5x S&P/ASX 200',
    warning: 'COMPLEX PRODUCT. An inverse fund gains when the market falls and loses when it rises. Daily rebalancing means it decays in a choppy market even if the index ends flat — designed for short-term tactical use only.' },
  { ticker: 'BBUS', name: 'BetaShares US Equities Strong Bear', provider: 'BetaShares', category: 'Inverse',
    aum: 320, mer: 1.38, yield: 0, price: 6.84, oneYear: -18.4, threeYear: -12.4, fiveYear: -15.2,
    holdings: 1, leverage: -2.5, complex: true, benchmark: '~-2.5x S&P 500',
    warning: 'COMPLEX PRODUCT. Inverse and geared. Designed for short-term tactical use only.' },
]

export const isComplex = (e) => !!e.complex

// ─── Fee drag ───────────────────────────────────────────────────────────────
//
// What the MER actually costs over time, which is the single most useful thing
// an ETF screen can tell someone and the one number providers never put on the
// front page.
//
// Fees are charged on the BALANCE, not on the contribution, so they compound
// against you exactly as returns compound for you. A flat "MER × amount × years"
// understates the cost of a fund held for twenty years — materially.
export function feeDrag(amount, merPct, years, growthPct = 8) {
  const g = growthPct / 100
  const m = merPct / 100
  let gross = amount
  let net = amount
  let feesPaid = 0
  const series = []
  for (let y = 1; y <= years; y++) {
    gross *= (1 + g)
    net *= (1 + g)
    const fee = net * m
    net -= fee
    feesPaid += fee
    series.push({ year: y, feesPaid, net, gross, lost: gross - net })
  }
  return { feesPaid, net, gross, lost: gross - net, series }
}
