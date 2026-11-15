import { PAL } from '../styles/palette.js'
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

// Fees, tracked index and fund size: read 15 Nov 2026 from each issuer's own
// product page (`sourceUrl`; fund size has its own `aumAsOf`). The five
// Vanguard funds could not be read and show "—". Typed returns, yields,
// holdings counts and evaluative notes were removed; `price` is only the
// seed for the labelled DEMO price simulation.
export const ETF_DATA_AS_OF = '2026-11-15'

export const ETF_CATEGORIES = [
  { key: 'ALL',          label: 'ALL',              tone: PAL.gold },
  { key: 'AU Equity',    label: 'AU EQUITY',        tone: PAL.gold },
  { key: 'US Equity',    label: 'US EQUITY',        tone: '#4A7FB5' },
  { key: 'Global Equity', label: 'GLOBAL',          tone: PAL.muted },
  { key: 'Multi-Asset',  label: 'MULTI-ASSET',      tone: '#7B2D8A' },
  { key: 'Fixed Income', label: 'FIXED INCOME',     tone: '#2D5A8A' },
  { key: 'Property',     label: 'PROPERTY',         tone: '#8A5A7D' },
  { key: 'Commodities',  label: 'COMMODITIES',      tone: '#8A6A2D' },
  { key: 'Thematic',     label: 'THEMATIC',         tone: '#a855f7' },
  { key: 'ESG',          label: 'ESG',              tone: PAL.up },
  { key: 'Sector',       label: 'SECTOR',           tone: '#B05030' },
  { key: 'Income',       label: 'INCOME',           tone: '#D69E2E' },
  { key: 'COMPLEX',      label: 'LEVERAGED/INVERSE', tone: PAL.down },
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
    aum: null, mer: null, yield: null, price: 94.82, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: null,
    unverified: 'Vanguard\'s site could not be read automatically on 15 Nov 2026' },
  { ticker: 'IOZ', name: 'iShares Core S&P/ASX 200', provider: 'BlackRock', category: 'AU Equity',
    aum: 10012.9, mer: 0.05, yield: null, price: 32.14, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'S&P/ASX 200 Index',
    checked: '2026-11-15', aumAsOf: '2026-11-13', sourceUrl: 'https://www.blackrock.com/au/products/251852/ishares-core-sp-asx-200-etf' },
  { ticker: 'A200', name: 'BetaShares Australia 200', provider: 'BetaShares', category: 'AU Equity',
    aum: 11664.6, mer: 0.04, yield: null, price: 138.42, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'Solactive Australia 200 Index',
    checked: '2026-11-15', aumAsOf: '2026-11-13', sourceUrl: 'https://www.betashares.com.au/fund/australia-200-etf/' },
  { ticker: 'IVV', name: 'iShares S&P 500', provider: 'BlackRock', category: 'US Equity',
    aum: 15347.6, mer: 0.04, yield: null, price: 58.24, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'S&P 500 Net TR Index (AUD)',
    checked: '2026-11-15', aumAsOf: '2026-11-12', sourceUrl: 'https://www.blackrock.com/au/products/275304/ishares-sp-500-etf' },
  { ticker: 'NDQ', name: 'BetaShares NASDAQ 100', provider: 'BetaShares', category: 'US Equity',
    aum: 9238.5, mer: 0.48, yield: null, price: 42.18, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'Nasdaq-100 Index',
    checked: '2026-11-15', aumAsOf: '2026-11-12', sourceUrl: 'https://www.betashares.com.au/fund/nasdaq-100-etf/' },
  { ticker: 'VGS', name: 'Vanguard International Shares', provider: 'Vanguard', category: 'Global Equity',
    aum: null, mer: null, yield: null, price: 118.42, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: null,
    unverified: 'Vanguard\'s site could not be read automatically on 15 Nov 2026' },
  { ticker: 'VDHG', name: 'Vanguard Diversified High Growth', provider: 'Vanguard', category: 'Multi-Asset',
    aum: null, mer: null, yield: null, price: 62.84, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: null,
    unverified: 'Vanguard\'s site could not be read automatically on 15 Nov 2026' },
  { ticker: 'VAF', name: 'Vanguard Australian Fixed Interest', provider: 'Vanguard', category: 'Fixed Income',
    aum: null, mer: null, yield: null, price: 48.24, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: null,
    unverified: 'Vanguard\'s site could not be read automatically on 15 Nov 2026' },
  { ticker: 'IAF', name: 'iShares Core Composite Bond', provider: 'BlackRock', category: 'Fixed Income',
    aum: 3760.1, mer: 0.1, yield: null, price: 96.42, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'An Australian composite bond index (named on the issuer\'s page)',
    checked: '2026-11-15', aumAsOf: '2026-11-13', sourceUrl: 'https://www.blackrock.com/au/products/251977/ishares-composite-bond-etf' },
  { ticker: 'BOND', name: 'State Street SPDR S&P/ASX iBoxx Australian Bond ETF', provider: 'PIMCO', category: 'Fixed Income',
    aum: 52.2, mer: 0.1, yield: null, price: 104.82, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'S&P/ASX iBoxx Australian Fixed Interest Diversified 0+ Index',
    checked: '2026-11-15', aumAsOf: '2026-11-13', sourceUrl: 'https://www.ssga.com/au/en_gb/intermediary/etfs/state-street-spdr-spasx-iboxx-australian-bond-etf-bond' },
  { ticker: 'GOLD', name: 'Global X Physical Gold', provider: 'Global X', category: 'Commodities',
    aum: null, mer: 0.4, yield: null, price: 28.84, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'Gold spot price',
    checked: '2026-11-15', aumAsOf: '2026-11-12', sourceUrl: 'https://www.globalxetfs.com.au/funds/gold/' },
  { ticker: 'VAP', name: 'Vanguard Australian Property Securities', provider: 'Vanguard', category: 'Property',
    aum: null, mer: null, yield: null, price: 84.18, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: null,
    unverified: 'Vanguard\'s site could not be read automatically on 15 Nov 2026' },
  { ticker: 'HACK', name: 'BetaShares Global Cybersecurity', provider: 'BetaShares', category: 'Thematic',
    aum: 1649.3, mer: 0.67, yield: null, price: 14.82, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'Nasdaq Consumer Technology Association Cybersecurity Index',
    checked: '2026-11-15', aumAsOf: '2026-11-12', sourceUrl: 'https://www.betashares.com.au/fund/global-cybersecurity-etf/' },
  { ticker: 'CLDD', name: 'Betashares Global Software Industry ETF', provider: 'BetaShares', category: 'Thematic',
    aum: 40.2, mer: 0.67, yield: null, price: 18.24, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'Solactive Global ex-Australia Software Index',
    checked: '2026-11-15', aumAsOf: '2026-11-12', sourceUrl: 'https://www.betashares.com.au/fund/global-software-industry-etf/' },
  { ticker: 'ETHI', name: 'BetaShares Global Sustainability Leaders', provider: 'BetaShares', category: 'ESG',
    aum: 3957.0, mer: 0.59, yield: null, price: 22.84, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'Nasdaq Future Global Sustainability Leaders Index',
    checked: '2026-11-15', aumAsOf: '2026-11-12', sourceUrl: 'https://www.betashares.com.au/fund/global-sustainability-leaders-etf/' },
  { ticker: 'QRE', name: 'BetaShares Resources Sector', provider: 'BetaShares', category: 'Sector',
    aum: 437.5, mer: 0.34, yield: null, price: 7.42, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'Solactive Australia Resources Sector Index',
    checked: '2026-11-15', aumAsOf: '2026-11-13', sourceUrl: 'https://www.betashares.com.au/fund/resources-sector-etf-betashares/' },
  { ticker: 'QFN', name: 'BetaShares Financials Sector', provider: 'BetaShares', category: 'Sector',
    aum: 85.8, mer: 0.34, yield: null, price: 22.18, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, benchmark: 'Solactive Australia Financials Ex-REITs Sector Index',
    checked: '2026-11-15', aumAsOf: '2026-11-13', sourceUrl: 'https://www.betashares.com.au/fund/financials-sector-etf-betashares/' },
  { ticker: 'HVST', name: 'BetaShares Australian Dividend Harvester', provider: 'BetaShares', category: 'Income',
    aum: 282.6, mer: 0.72, yield: null, price: 8.42, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null,
    warning: 'A high headline yield can include return of your own capital rather than income earned. Compare the total return, not the yield — this fund\'s 3-year total return is well below the broad market despite the highest yield on this list.',
    checked: '2026-11-15', aumAsOf: '2026-11-13', sourceUrl: 'https://www.betashares.com.au/fund/australian-dividend-harvester-fund/' },
  { ticker: 'GEAR', name: 'BetaShares Geared Australian Equity', provider: 'BetaShares', category: 'Leveraged',
    aum: 585.4, mer: 0.78, yield: null, price: 42.84, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, leverage: 2.0, complex: true, benchmark: null,
    warning: 'COMPLEX PRODUCT. Internally geared — losses are amplified as well as gains, and returns compound daily, so over any period longer than a day the result is NOT simply two times the index.',
    checked: '2026-11-15', aumAsOf: '2026-11-13', sourceUrl: 'https://www.betashares.com.au/fund/geared-australian-equity-fund/' },
  { ticker: 'BBOZ', name: 'BetaShares Australian Equities Strong Bear', provider: 'BetaShares', category: 'Inverse',
    aum: 156.0, mer: 1.29, yield: null, price: 8.24, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, leverage: -2.5, complex: true, benchmark: null,
    warning: 'COMPLEX PRODUCT. An inverse fund gains when the market falls and loses when it rises. Daily rebalancing means it decays in a choppy market even if the index ends flat — designed for short-term tactical use only.',
    checked: '2026-11-15', aumAsOf: '2026-11-12', sourceUrl: 'https://www.betashares.com.au/fund/australian-equities-strong-bear-fund/' },
  { ticker: 'BBUS', name: 'BetaShares US Equities Strong Bear', provider: 'BetaShares', category: 'Inverse',
    aum: 107.9, mer: 1.32, yield: null, price: 6.84, oneYear: null, threeYear: null, fiveYear: null,
    holdings: null, leverage: -2.5, complex: true, benchmark: null,
    warning: 'COMPLEX PRODUCT. Inverse and geared. Designed for short-term tactical use only.',
    checked: '2026-11-15', aumAsOf: '2026-11-12', sourceUrl: 'https://www.betashares.com.au/fund/us-equities-strong-bear-fund/' },
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
