// ─── Futures contracts ──────────────────────────────────────────────────────
//
// INDICATIVE throughout. Prices, volumes and margins are illustrative; the
// CONTRACT SPECIFICATIONS (size, tick, exchange, settlement) are the structural
// facts that make a futures price mean something, and those are what the detail
// panel is actually for. A price without a contract size is a number; with one
// it is a position worth two hundred thousand dollars.

export const FUTURES_GROUPS = [
  { key: 'equity',   label: 'EQUITY INDEX FUTURES', vol: 0.08 },
  { key: 'commodity', label: 'COMMODITY FUTURES',   vol: 0.12 },
  { key: 'currency', label: 'CURRENCY FUTURES',     vol: 0.04 },
  { key: 'rates',    label: 'INTEREST RATE FUTURES', vol: 0.01 },
]

const f = (o) => ({ settlement: 'Cash', ...o })

export const FUTURES = [
  // ── Equity index ──
  f({ id: 'SPI-Sep26', group: 'equity', name: 'ASX SPI 200', expiry: 'Sep-26', price: 8182, change: -45, volume: 12847,
    exchange: 'ASX 24', size: 'A$25 × index', tick: 1, tickValue: 25, margin: 9800, currency: 'AUD',
    context: 'The ASX 200 in one contract. At A$25 a point, a 8,182 quote is a A$204,550 position — held on roughly A$9,800 of margin, which is the leverage in a single sentence.' }),
  f({ id: 'SPI-Dec26', group: 'equity', name: 'ASX SPI 200', expiry: 'Dec-26', price: 8156, change: -48, volume: 2341,
    exchange: 'ASX 24', size: 'A$25 × index', tick: 1, tickValue: 25, margin: 9800, currency: 'AUD',
    context: 'The further-dated SPI. Thinner volume than the front month, which is normal — liquidity concentrates in the nearest expiry.' }),
  f({ id: 'ES-Sep26', group: 'equity', name: 'S&P 500 E-mini', expiry: 'Sep-26', price: 5818, change: 12, volume: 892341,
    exchange: 'CME', size: 'US$50 × index', tick: 0.25, tickValue: 12.50, margin: 13200, currency: 'USD',
    context: 'The most heavily traded equity futures contract in the world, and the overnight lead most Australian traders watch before the ASX open.' }),
  f({ id: 'NQ-Sep26', group: 'equity', name: 'NASDAQ 100 E-mini', expiry: 'Sep-26', price: 18894, change: 42, volume: 445231,
    exchange: 'CME', size: 'US$20 × index', tick: 0.25, tickValue: 5.00, margin: 21500, currency: 'USD' }),
  f({ id: 'YM-Sep26', group: 'equity', name: 'Dow Jones E-mini', expiry: 'Sep-26', price: 42184, change: 84, volume: 124281,
    exchange: 'CBOT', size: 'US$5 × index', tick: 1, tickValue: 5.00, margin: 9600, currency: 'USD' }),
  f({ id: 'NK-Sep26', group: 'equity', name: 'Nikkei 225', expiry: 'Sep-26', price: 38420, change: 284, volume: 84241,
    exchange: 'OSE / SGX', size: '¥1,000 × index', tick: 10, tickValue: 10000, margin: 8400, currency: 'JPY' }),
  f({ id: 'Z-Sep26', group: 'equity', name: 'FTSE 100', expiry: 'Sep-26', price: 8624, change: -24, volume: 48241,
    exchange: 'ICE Europe', size: '£10 × index', tick: 0.5, tickValue: 5.00, margin: 6200, currency: 'GBP' }),
  f({ id: 'HSI-Sep26', group: 'equity', name: 'Hang Seng', expiry: 'Sep-26', price: 18242, change: -124, volume: 124842,
    exchange: 'HKFE', size: 'HK$50 × index', tick: 1, tickValue: 50, margin: 14200, currency: 'HKD' }),

  // ── Commodity ──
  f({ id: 'IO-Sep26', group: 'commodity', name: 'Iron Ore 62% Fe', expiry: 'Sep-26', price: 98.40, change: 2.20, volume: 84241,
    exchange: 'SGX', size: '100 tonnes', tick: 0.05, tickValue: 5.00, margin: 1400, currency: 'USD', unit: 'US$/t',
    context: 'The single most important commodity price for the ASX. It drives revenue at BHP, RIO and FMG, and it is quoted in USD — so an Australian holder is exposed to the iron ore price and the currency at once.' }),
  f({ id: 'COAL-Sep26', group: 'commodity', name: 'Newcastle Thermal Coal', expiry: 'Sep-26', price: 124.20, change: -0.80, volume: 12841,
    exchange: 'ICE', size: '1,000 tonnes', tick: 0.05, tickValue: 50, margin: 8400, currency: 'USD', unit: 'US$/t',
    context: 'Priced at the Port of Newcastle — an Australian benchmark traded globally, and a direct read on export revenue.' }),
  f({ id: 'CC-Sep26', group: 'commodity', name: 'Coking Coal', expiry: 'Sep-26', price: 212.40, change: -1.20, volume: 8241,
    exchange: 'SGX', size: '100 tonnes', tick: 0.10, tickValue: 10, margin: 6800, currency: 'USD', unit: 'US$/t' }),
  f({ id: 'GC-Dec26', group: 'commodity', name: 'Gold', expiry: 'Dec-26', price: 4452, change: 18, volume: 284241,
    exchange: 'COMEX', size: '100 troy oz', tick: 0.10, tickValue: 10, margin: 12400, currency: 'USD', unit: 'US$/oz',
    settlement: 'Physical' }),
  f({ id: 'SI-Dec26', group: 'commodity', name: 'Silver', expiry: 'Dec-26', price: 52.40, change: 0.84, volume: 84124,
    exchange: 'COMEX', size: '5,000 troy oz', tick: 0.005, tickValue: 25, margin: 16800, currency: 'USD', unit: 'US$/oz', settlement: 'Physical' }),
  f({ id: 'HG-Dec26', group: 'commodity', name: 'Copper', expiry: 'Dec-26', price: 4.18, change: 0.04, volume: 124841,
    exchange: 'COMEX', size: '25,000 lb', tick: 0.0005, tickValue: 12.50, margin: 8200, currency: 'USD', unit: 'US$/lb', settlement: 'Physical' }),
  f({ id: 'CL-Oct26', group: 'commodity', name: 'WTI Crude', expiry: 'Oct-26', price: 78.40, change: 0.60, volume: 684241,
    exchange: 'NYMEX', size: '1,000 barrels', tick: 0.01, tickValue: 10, margin: 6400, currency: 'USD', unit: 'US$/bbl', settlement: 'Physical' }),
  f({ id: 'BRN-Oct26', group: 'commodity', name: 'Brent Crude', expiry: 'Oct-26', price: 82.10, change: 0.70, volume: 424841,
    exchange: 'ICE', size: '1,000 barrels', tick: 0.01, tickValue: 10, margin: 6200, currency: 'USD', unit: 'US$/bbl' }),
  f({ id: 'NG-Oct26', group: 'commodity', name: 'Natural Gas', expiry: 'Oct-26', price: 2.84, change: -0.08, volume: 284124,
    exchange: 'NYMEX', size: '10,000 MMBtu', tick: 0.001, tickValue: 10, margin: 4800, currency: 'USD', unit: 'US$/MMBtu', settlement: 'Physical' }),
  f({ id: 'ZW-Dec26', group: 'commodity', name: 'Wheat', expiry: 'Dec-26', price: 5.92, change: -0.12, volume: 84241,
    exchange: 'CBOT', size: '5,000 bushels', tick: 0.0025, tickValue: 12.50, margin: 2400, currency: 'USD', unit: 'US$/bu', settlement: 'Physical' }),
  f({ id: 'ZC-Dec26', group: 'commodity', name: 'Corn', expiry: 'Dec-26', price: 4.84, change: 0.08, volume: 184241,
    exchange: 'CBOT', size: '5,000 bushels', tick: 0.0025, tickValue: 12.50, margin: 1800, currency: 'USD', unit: 'US$/bu', settlement: 'Physical' }),
  f({ id: 'ZS-Nov26', group: 'commodity', name: 'Soybeans', expiry: 'Nov-26', price: 11.24, change: 0.18, volume: 124841,
    exchange: 'CBOT', size: '5,000 bushels', tick: 0.0025, tickValue: 12.50, margin: 3200, currency: 'USD', unit: 'US$/bu', settlement: 'Physical' }),
  f({ id: 'LI-Dec26', group: 'commodity', name: 'Lithium Carbonate', expiry: 'Dec-26', price: 14200, change: -284, volume: 2841,
    exchange: 'CME', size: '1 tonne', tick: 1, tickValue: 1, margin: 2800, currency: 'USD', unit: 'US$/t',
    context: 'Thinly traded compared with the bulks, and a direct read on PLS, MIN and IGO. Small volume means wide spreads.' }),

  // ── Currency ──
  f({ id: 'AUDUSD-Sep26', group: 'currency', name: 'AUD/USD', expiry: 'Sep-26', price: 0.7198, change: 0.0012, volume: 184241,
    exchange: 'CME', size: 'A$100,000', tick: 0.0001, tickValue: 10, margin: 2200, currency: 'USD', dp: 4,
    context: 'Each contract is A$100,000. Going long is a bet the Australian dollar rises against the US dollar — which historically tracks the commodity cycle and the RBA/Fed rate gap.' }),
  f({ id: 'AUDJPY-Sep26', group: 'currency', name: 'AUD/JPY', expiry: 'Sep-26', price: 111.84, change: 0.42, volume: 42841,
    exchange: 'CME', size: 'A$100,000', tick: 0.01, tickValue: 10, margin: 2400, currency: 'JPY', dp: 2,
    context: 'The classic carry trade cross — long AUD, short JPY earns the rate differential, and unwinds violently when risk appetite turns.' }),
  f({ id: 'AUDEUR-Sep26', group: 'currency', name: 'AUD/EUR', expiry: 'Sep-26', price: 0.6624, change: 0.0008, volume: 18241,
    exchange: 'CME', size: 'A$100,000', tick: 0.0001, tickValue: 10, margin: 2100, currency: 'EUR', dp: 4 }),
  f({ id: 'AUDGBP-Sep26', group: 'currency', name: 'AUD/GBP', expiry: 'Sep-26', price: 0.5682, change: 0.0006, volume: 12841,
    exchange: 'CME', size: 'A$100,000', tick: 0.0001, tickValue: 10, margin: 2100, currency: 'GBP', dp: 4 }),
  f({ id: 'AUDCNH-Sep26', group: 'currency', name: 'AUD/CNH', expiry: 'Sep-26', price: 5.2184, change: 0.0124, volume: 8241,
    exchange: 'HKEX', size: 'A$100,000', tick: 0.0001, tickValue: 10, margin: 2600, currency: 'CNH', dp: 4 }),

  // ── Rates. Quoted as 100 minus the implied rate, which is why they look
  // upside down and why the implied column matters more than the price. ──
  f({ id: 'IR-Dec26', group: 'rates', name: 'ASX 90-Day Bank Bills', expiry: 'Dec-26', price: 95.82, change: 0.02, volume: 84241,
    exchange: 'ASX 24', size: 'A$1,000,000 face', tick: 0.01, tickValue: 24.66, margin: 1200, currency: 'AUD', dp: 2, rate: true }),
  f({ id: 'IR-Mar27', group: 'rates', name: 'ASX 90-Day Bank Bills', expiry: 'Mar-27', price: 95.94, change: 0.03, volume: 42841,
    exchange: 'ASX 24', size: 'A$1,000,000 face', tick: 0.01, tickValue: 24.66, margin: 1200, currency: 'AUD', dp: 2, rate: true }),
  f({ id: 'IR-Jun27', group: 'rates', name: 'ASX 90-Day Bank Bills', expiry: 'Jun-27', price: 96.12, change: 0.04, volume: 18241,
    exchange: 'ASX 24', size: 'A$1,000,000 face', tick: 0.01, tickValue: 24.66, margin: 1200, currency: 'AUD', dp: 2, rate: true }),
  f({ id: 'FF-Sep26', group: 'rates', name: 'US Fed Funds', expiry: 'Sep-26', price: 95.54, change: 0.01, volume: 124841,
    exchange: 'CBOT', size: 'US$5,000,000 face', tick: 0.005, tickValue: 20.84, margin: 900, currency: 'USD', dp: 2, rate: true }),
  f({ id: 'FF-Dec26', group: 'rates', name: 'US Fed Funds', expiry: 'Dec-26', price: 95.78, change: 0.02, volume: 184241,
    exchange: 'CBOT', size: 'US$5,000,000 face', tick: 0.005, tickValue: 20.84, margin: 900, currency: 'USD', dp: 2, rate: true }),
  f({ id: 'FF-Mar27', group: 'rates', name: 'US Fed Funds', expiry: 'Mar-27', price: 96.02, change: 0.03, volume: 84241,
    exchange: 'CBOT', size: 'US$5,000,000 face', tick: 0.005, tickValue: 20.84, margin: 900, currency: 'USD', dp: 2, rate: true }),
]

export const impliedRate = (price) => 100 - price

// ─── Short interest ─────────────────────────────────────────────────────────
// INDICATIVE. ASIC publishes short position reports with a lag; these are
// illustrative figures in a realistic range and shape.
export const SHORT_INTEREST = [
  { ticker: 'PLS',  company: 'Pilbara Minerals',    shortPct: 17.8, daysToCover: 6.2 },
  { ticker: 'IEL',  company: 'IDP Education',       shortPct: 14.2, daysToCover: 8.4 },
  { ticker: 'LYC',  company: 'Lynas Rare Earths',   shortPct: 11.4, daysToCover: 4.8 },
  { ticker: 'SYA',  company: 'Sayona Mining',       shortPct: 10.8, daysToCover: 3.2 },
  { ticker: 'DMP',  company: "Domino's Pizza",      shortPct: 9.8,  daysToCover: 9.1 },
  { ticker: 'MIN',  company: 'Mineral Resources',   shortPct: 9.2,  daysToCover: 4.2 },
  { ticker: 'CTD',  company: 'Corporate Travel',    shortPct: 8.4,  daysToCover: 7.8 },
  { ticker: 'LTR',  company: 'Liontown Resources',  shortPct: 8.1,  daysToCover: 3.8 },
  { ticker: 'BOQ',  company: 'Bank of Queensland',  shortPct: 6.8,  daysToCover: 6.4 },
  { ticker: 'SGR',  company: 'Star Entertainment',  shortPct: 6.4,  daysToCover: 5.2 },
  { ticker: 'A2M',  company: 'The a2 Milk Company', shortPct: 5.8,  daysToCover: 6.8 },
  { ticker: 'JBH',  company: 'JB Hi-Fi',            shortPct: 5.2,  daysToCover: 8.2 },
  { ticker: 'FLT',  company: 'Flight Centre',       shortPct: 4.8,  daysToCover: 5.4 },
  { ticker: 'WEB',  company: 'Web Travel Group',    shortPct: 4.2,  daysToCover: 4.6 },
  { ticker: 'HVN',  company: 'Harvey Norman',       shortPct: 3.8,  daysToCover: 6.2 },
  { ticker: 'SUL',  company: 'Super Retail Group',  shortPct: 3.4,  daysToCover: 5.8 },
  { ticker: 'TWE',  company: 'Treasury Wine',       shortPct: 3.1,  daysToCover: 4.2 },
  { ticker: 'QAN',  company: 'Qantas Airways',      shortPct: 2.8,  daysToCover: 3.4 },
  { ticker: 'CSL',  company: 'CSL Limited',         shortPct: 2.4,  daysToCover: 4.8 },
  { ticker: 'BHP',  company: 'BHP Group',           shortPct: 2.1,  daysToCover: 2.4 },
]

export const MARGIN_LENDERS = [
  { lender: 'NAB Equity Builder', rate: 8.38, maxLvr: 70, minLoan: 20000 },
  { lender: 'CBA Margin Loan',    rate: 8.45, maxLvr: 70, minLoan: 20000 },
  { lender: 'Westpac Margin',     rate: 8.54, maxLvr: 70, minLoan: 20000 },
  { lender: 'ANZ Margin Lending', rate: 8.62, maxLvr: 70, minLoan: 20000 },
  { lender: 'CommSec Margin',     rate: 8.82, maxLvr: 70, minLoan: 20000 },
]

export const POSITIONING = [
  { asset: 'AUD/USD',     inst: 68, signal: 'BULLISH' },
  { asset: 'Gold',        inst: 72, signal: 'BULLISH' },
  { asset: 'ASX 200',     inst: 58, signal: 'NEUTRAL' },
  { asset: 'Iron Ore',    inst: 64, signal: 'BULLISH' },
  { asset: 'US Equities', inst: 61, signal: 'BULLISH' },
  { asset: 'Bonds',       inst: 54, signal: 'NEUTRAL' },
]
