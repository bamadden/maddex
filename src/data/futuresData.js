// ─── Futures contracts ──────────────────────────────────────────────────────
//
// INDICATIVE throughout. Prices, volumes and margins are illustrative; the
// CONTRACT SPECIFICATIONS (size, tick, exchange, settlement) are the structural
// facts that make a futures price mean something, and those are what the detail
// panel is actually for. A price without a contract size is a number; with one
// it is a position worth two hundred thousand dollars.

// Contract specifications marked `specChecked` were read from the exchange's
// own specification page on 15 Nov 2026 (ASX 24 PDF, ICE, HKEX, SGX rulebook,
// JPX). The CME Group rows (CME, CBOT, NYMEX, COMEX) could not be read
// (cmegroup.com refuses automated requests) and say so on screen; the
// freshness guard flags them until 29 Nov. AUD/EUR and AUD/GBP were removed:
// CME lists EUR/AUD and GBP/AUD, not those. Prices are a labelled DEMO
// simulation; typed volumes, margins and day changes were removed.
export const FUTURES_SPECS_CHECKED = '2026-11-15'
export const FUTURES_AS_OF = null

export const FUTURES_GROUPS = [
  { key: 'equity',   label: 'EQUITY INDEX FUTURES', vol: 0.08 },
  { key: 'commodity', label: 'COMMODITY FUTURES',   vol: 0.12 },
  { key: 'currency', label: 'CURRENCY FUTURES',     vol: 0.04 },
  { key: 'rates',    label: 'INTEREST RATE FUTURES', vol: 0.01 },
]

import { MOCK_INDICES } from '../services/mockData'
import { VERIFIED_CONSTANTS } from './verifiedConstants'

const f = (o) => ({ settlement: 'Cash', ...o })

// Index futures quote off the same index levels the Markets module shows, so
// the SPI cannot read 1,500 points below the ASX 200 beside it. The small
// premium is a stand-in for carry (financing cost less dividends) to expiry.
const idx = (sym, premiumPct = 0) => Math.round((MOCK_INDICES[sym]?.price ?? 0) * (1 + premiumPct / 100))

// Rate futures are anchored FLAT at today's policy rates. There is no futures
// feed in this build, and a hand-typed strip that slopes is a claim about
// where the market expects the RBA and Fed to go — exactly the figure a
// reader would act on. Flat says "no expectation shown", which is the truth.
// Bank bills trade a little above the cash rate; the 0.15 spread is a
// stand-in for that, not a measurement.
const BBSW = VERIFIED_CONSTANTS.rba.cashRate + 0.15
const FF_EFFECTIVE = VERIFIED_CONSTANTS.fed.cashRate - 0.12
const strip = (rate) => +(100 - rate).toFixed(2)

// Commodity rows anchor to the dated settlements in verifiedConstants, the
// same figures the Global panel and MaddenAI read, so a contract here cannot
// quote iron ore at a level the rest of the app has already moved past. The
// row carries the settlement date, and its change starts at zero: there is no
// daily-move feed, so any change shown is the simulated drift since load, not
// a claimed session move. Rows with no verified constant say so.
const CMD = VERIFIED_CONSTANTS.commodities
const SHORT_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const settleLabel = (key) => {
  const [, m, d] = (CMD.asOfBy?.[key] ?? CMD.asOf).split('-')
  return `SETTLE ${Number(d)} ${SHORT_MONTHS[Number(m) - 1]}`
}
const anchored = (key, dp = 2) => ({ price: +CMD[key].toFixed(dp), anchor: settleLabel(key) })
const NO_ANCHOR = 'INDICATIVE — no verified price'

export const FUTURES = [
  // ── Equity index ──
  f({ id: 'SPI-Dec26', group: 'equity', name: 'ASX SPI 200', expiry: 'Dec-26', price: idx('^AXJO', 0.3),
    exchange: 'ASX 24', size: 'A$25 × index', tick: 1, tickValue: 25, currency: 'AUD', specChecked: true,
    context: `The ASX 200 in one contract. At A$25 a point, a ${idx('^AXJO', 0.3).toLocaleString('en-AU')} quote is a A$${(idx('^AXJO', 0.3) * 25).toLocaleString('en-AU')} position — the clearing house sets the margin, a small fraction of that.` }),
  f({ id: 'SPI-Mar27', group: 'equity', name: 'ASX SPI 200', expiry: 'Mar-27', price: idx('^AXJO', 0.6),
    exchange: 'ASX 24', size: 'A$25 × index', tick: 1, tickValue: 25, currency: 'AUD',
    context: 'The further-dated SPI. Thinner volume than the front month, which is normal — liquidity concentrates in the nearest expiry.', specChecked: true }),
  f({ id: 'ES-Dec26', group: 'equity', name: 'S&P 500 E-mini', expiry: 'Dec-26', price: idx('^GSPC', 0.5),
    exchange: 'CME', size: 'US$50 × index', tick: 0.25, tickValue: 12.50, currency: 'USD',
    context: 'The most heavily traded equity futures contract in the world, and the overnight lead most Australian traders watch before the ASX open.' }),
  // Not tied to an index level: the demo data carries the NASDAQ Composite
  // (^IXIC), not the NASDAQ 100 this contract tracks, and the two are
  // different indices at different levels. Flagged in the row rather than
  // quietly priced off the wrong one.
  f({ id: 'NQ-Dec26', group: 'equity', name: 'NASDAQ 100 E-mini', expiry: 'Dec-26', price: 18894,
    exchange: 'CME', size: 'US$20 × index', tick: 0.25, tickValue: 5.00, currency: 'USD',
    unanchored: 'INDICATIVE — no NASDAQ 100 index feed',
    context: 'Price is indicative only: this build has no NASDAQ 100 index level to anchor it to, so unlike the other index rows it does not track the Markets module.' }),
  f({ id: 'YM-Dec26', group: 'equity', name: 'Dow Jones E-mini', expiry: 'Dec-26', price: idx('^DJI', 0.4),
    exchange: 'CBOT', size: 'US$5 × index', tick: 1, tickValue: 5.00, currency: 'USD' }),
  f({ id: 'NK-Dec26', group: 'equity', name: 'Nikkei 225', expiry: 'Dec-26', price: idx('^N225', 0.1),
    exchange: 'Osaka Exchange (JPX)', size: '¥1,000 × index', tick: 10, tickValue: 10000, currency: 'JPY', specChecked: true }),
  f({ id: 'Z-Dec26', group: 'equity', name: 'FTSE 100', expiry: 'Dec-26', price: idx('^FTSE', 0.2),
    exchange: 'ICE Europe', size: '£10 × index', tick: 0.5, tickValue: 5.00, currency: 'GBP', specChecked: true }),
  f({ id: 'HSI-Oct26', group: 'equity', name: 'Hang Seng', expiry: 'Oct-26', price: idx('^HSI', 0),
    exchange: 'HKFE', size: 'HK$50 × index', tick: 1, tickValue: 50, currency: 'HKD', specChecked: true }),

  // ── Commodity ──
  f({ id: 'IO-Oct26', group: 'commodity', name: 'Iron Ore 62% Fe', expiry: 'Oct-26', ...anchored('ironOreUSD'),
    exchange: 'SGX', size: '100 tonnes', tick: 0.05, tickValue: 5.00, currency: 'USD', unit: 'US$/t',
    context: 'The single most important commodity price for the ASX. It drives revenue at BHP, RIO and FMG, and it is quoted in USD — so an Australian holder is exposed to the iron ore price and the currency at once.', specChecked: true }),
  f({ id: 'COAL-Oct26', group: 'commodity', name: 'Newcastle Thermal Coal', expiry: 'Oct-26', ...anchored('thermalCoalUSD'),
    exchange: 'ICE', size: '1,000 tonnes', tick: 0.05, tickValue: 50, currency: 'USD', unit: 'US$/t',
    context: 'Priced at the Port of Newcastle — an Australian benchmark traded globally, and a direct read on export revenue.', specChecked: true }),
  f({ id: 'CC-Oct26', group: 'commodity', name: 'Coking Coal', expiry: 'Oct-26', price: 212.40, unanchored: NO_ANCHOR,
    exchange: 'SGX', size: '100 tonnes', tick: 0.01, tickValue: 1, currency: 'USD', unit: 'US$/t', specChecked: true }),
  f({ id: 'GC-Dec26', group: 'commodity', name: 'Gold', expiry: 'Dec-26', price: 4452, unanchored: NO_ANCHOR,
    exchange: 'COMEX', size: '100 troy oz', tick: 0.10, tickValue: 10, currency: 'USD', unit: 'US$/oz',
    settlement: 'Physical' }),
  f({ id: 'SI-Dec26', group: 'commodity', name: 'Silver', expiry: 'Dec-26', price: 52.40, unanchored: NO_ANCHOR,
    exchange: 'COMEX', size: '5,000 troy oz', tick: 0.005, tickValue: 25, currency: 'USD', unit: 'US$/oz', settlement: 'Physical' }),
  f({ id: 'HG-Dec26', group: 'commodity', name: 'Copper', expiry: 'Dec-26', ...anchored('copperUSDPerLb'),
    exchange: 'COMEX', size: '25,000 lb', tick: 0.0005, tickValue: 12.50, currency: 'USD', unit: 'US$/lb', settlement: 'Physical' }),
  f({ id: 'CL-Dec26', group: 'commodity', name: 'WTI Crude', expiry: 'Dec-26', ...anchored('wtiUSD'),
    context: 'The Nov contract expired on 20 Oct, so Dec is the front month. Physical WTI at Cushing priced near US$108 that day (FRED), about US$11 over this contract — steep backwardation, the futures curve saying today\'s barrel is scarcer than December\'s. Brent carries a similar premium for the same reason: the Hormuz closure.',
    exchange: 'NYMEX', size: '1,000 barrels', tick: 0.01, tickValue: 10, currency: 'USD', unit: 'US$/bbl', settlement: 'Physical' }),
  f({ id: 'BRN-Dec26', group: 'commodity', name: 'Brent Crude', expiry: 'Dec-26', ...anchored('brentUSD'),
    exchange: 'ICE', size: '1,000 barrels', tick: 0.01, tickValue: 10, currency: 'USD', unit: 'US$/bbl', specChecked: true }),
  f({ id: 'NG-Nov26', group: 'commodity', name: 'Natural Gas', expiry: 'Nov-26', price: 2.84, unanchored: NO_ANCHOR,
    exchange: 'NYMEX', size: '10,000 MMBtu', tick: 0.001, tickValue: 10, currency: 'USD', unit: 'US$/MMBtu', settlement: 'Physical' }),
  f({ id: 'ZW-Dec26', group: 'commodity', name: 'Wheat', expiry: 'Dec-26', ...anchored('wheatUSDPerBu'),
    exchange: 'CBOT', size: '5,000 bushels', tick: 0.0025, tickValue: 12.50, currency: 'USD', unit: 'US$/bu', settlement: 'Physical' }),
  f({ id: 'ZC-Dec26', group: 'commodity', name: 'Corn', expiry: 'Dec-26', price: 4.84, unanchored: NO_ANCHOR,
    exchange: 'CBOT', size: '5,000 bushels', tick: 0.0025, tickValue: 12.50, currency: 'USD', unit: 'US$/bu', settlement: 'Physical' }),
  f({ id: 'ZS-Nov26', group: 'commodity', name: 'Soybeans', expiry: 'Nov-26', price: 11.24, unanchored: NO_ANCHOR,
    exchange: 'CBOT', size: '5,000 bushels', tick: 0.0025, tickValue: 12.50, currency: 'USD', unit: 'US$/bu', settlement: 'Physical' }),
  f({ id: 'LI-Dec26', group: 'commodity', name: 'Lithium Carbonate', expiry: 'Dec-26', price: 14200, unanchored: NO_ANCHOR,
    exchange: 'CME', size: '1 tonne', tick: 1, tickValue: 1, currency: 'USD', unit: 'US$/t',
    context: 'Thinly traded compared with the bulks, and a direct read on PLS, MIN and IGO. Small volume means wide spreads.' }),

  // ── Currency ──
  f({ id: 'AUDUSD-Dec26', group: 'currency', name: 'AUD/USD', expiry: 'Dec-26', price: 0.7198,
    exchange: 'CME', size: 'A$100,000', tick: 0.0001, tickValue: 10, currency: 'USD', dp: 4,
    context: 'Each contract is A$100,000. Going long is a bet the Australian dollar rises against the US dollar — which historically tracks the commodity cycle and the RBA/Fed rate gap.' }),
  f({ id: 'AUDJPY-Dec26', group: 'currency', name: 'AUD/JPY', expiry: 'Dec-26', price: 111.84,
    exchange: 'CME', size: 'A$100,000', tick: 0.01, tickValue: 10, currency: 'JPY', dp: 2,
    context: 'The classic carry trade cross — long AUD, short JPY earns the rate differential, and unwinds violently when risk appetite turns.' }),
  f({ id: 'AUDCNH-Dec26', group: 'currency', name: 'AUD/CNH', expiry: 'Dec-26', price: 5.2184,
    exchange: 'HKEX', size: 'A$80,000', tick: 0.0001, tickValue: 8, currency: 'CNH', dp: 4, specChecked: true }),

  // ── Rates. Quoted as 100 minus the implied rate, which is why they look
  // upside down and why the implied column matters more than the price. ──
  f({ id: 'IR-Dec26', group: 'rates', name: 'ASX 90-Day Bank Bills', expiry: 'Dec-26', price: strip(BBSW),
    exchange: 'ASX 24', size: 'A$1,000,000 face', tick: 0.01, tickValue: 24, tickValueNote: 'about A$24, varies with the yield (ASX)', currency: 'AUD', dp: 2, rate: true, specChecked: true }),
  f({ id: 'IR-Mar27', group: 'rates', name: 'ASX 90-Day Bank Bills', expiry: 'Mar-27', price: strip(BBSW),
    exchange: 'ASX 24', size: 'A$1,000,000 face', tick: 0.01, tickValue: 24, tickValueNote: 'about A$24, varies with the yield (ASX)', currency: 'AUD', dp: 2, rate: true, specChecked: true }),
  f({ id: 'IR-Jun27', group: 'rates', name: 'ASX 90-Day Bank Bills', expiry: 'Jun-27', price: strip(BBSW),
    exchange: 'ASX 24', size: 'A$1,000,000 face', tick: 0.01, tickValue: 24, tickValueNote: 'about A$24, varies with the yield (ASX)', currency: 'AUD', dp: 2, rate: true, specChecked: true }),
  f({ id: 'FF-Oct26', group: 'rates', name: 'US Fed Funds', expiry: 'Oct-26', price: strip(FF_EFFECTIVE),
    exchange: 'CBOT', size: 'US$5,000,000 face', tick: 0.005, tickValue: 20.84, currency: 'USD', dp: 2, rate: true }),
  f({ id: 'FF-Dec26', group: 'rates', name: 'US Fed Funds', expiry: 'Dec-26', price: strip(FF_EFFECTIVE),
    exchange: 'CBOT', size: 'US$5,000,000 face', tick: 0.005, tickValue: 20.84, currency: 'USD', dp: 2, rate: true }),
  f({ id: 'FF-Mar27', group: 'rates', name: 'US Fed Funds', expiry: 'Mar-27', price: strip(FF_EFFECTIVE),
    exchange: 'CBOT', size: 'US$5,000,000 face', tick: 0.005, tickValue: 20.84, currency: 'USD', dp: 2, rate: true }),
]

export const impliedRate = (price) => 100 - price

// The short-interest, margin-lender and positioning tables that stood here
// were typed ("illustrative figures in a realistic range") about named
// companies and lenders, and were removed on 15 Nov 2026.


