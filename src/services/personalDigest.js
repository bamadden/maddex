// YOUR INTELLIGENCE DIGEST — a daily read built for this user's holdings and
// watchlist, shown in the MaddenAI panel on the first open each day.
//
// Not a model call. Every line is assembled from what the terminal already
// holds with a source: verified figures (commodities, rates, the regime),
// the calendar and corporate actions, the user's own holdings and watchlist,
// and real headlines from the news feed. That keeps it free to generate, the
// same on every open, and incapable of inventing a number. MaddenAI is one
// click away from any line for the analysis.
//
// Stored per Sydney day, separately from the morning brief.

import VERIFIED_CONSTANTS, { pendingRbaDecision, rbaDecisionAt } from '../data/verifiedConstants'
import { SECTOR_BY_SYMBOL } from '../modules/portfolio/sectorMap'
import { rateImpact } from '../modules/portfolio/rateSensitivity'
import { currentRegime } from './marketRegime'
import { getInvestorProfile } from './investorProfile'

const KEY = (day) => `maddex_digest_${day}`
const SEEN_KEY = 'maddex_digest_seen'
const sydDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
const bare = (s) => String(s).toUpperCase().replace(/\.AX$/, '')

export const digestSeenToday = () => { try { return localStorage.getItem(SEEN_KEY) === sydDay() } catch { return true } }
export const markDigestSeen = () => { try { localStorage.setItem(SEEN_KEY, sydDay()) } catch { /* private mode */ } }

// One line per sector the user holds, naming the thing that moves it now.
function sectorLine(sector, ctx) {
  const { c, nd, ndDays, regime } = ctx
  const cm = c.commodities
  const rbaBit = nd && ndDays != null ? `RBA decides in ${ndDays} day${ndDays === 1 ? '' : 's'} (~${nd.marketHikePct}% hike priced)` : `cash rate ${c.rba.cashRate.toFixed(2)}%`
  switch (sector) {
    case 'Materials': return `watch iron ore at US$${cm.ironOreUSD.toFixed(2)}/t (${cm.asOfBy?.ironOreUSD}) and copper at US$${cm.copperUSDPerLb.toFixed(2)}/lb — China demand matters more than the RBA`
    case 'Energy': return `Brent US$${cm.brentUSD.toFixed(2)}/bbl and JKM LNG US$${cm.lngUSDPerMMBtu.toFixed(2)}/MMBtu (${cm.asOfBy?.brentUSD})`
    case 'Financials': return `${rbaBit} — a hike tends to widen bank margins, with credit risk the offset`
    case 'Real Est': return `${rbaBit} — property and REITs carry the most rate pressure; AU 10Y ${c.bonds.au10y.toFixed(2)}%`
    case 'Utilities': return `bond-like income competes with an AU 10Y at ${c.bonds.au10y.toFixed(2)}%`
    case 'IT': return `long-dated earnings are sensitive to yields — AU 10Y ${c.bonds.au10y.toFixed(2)}%, US 10Y ${c.bonds.us10y.toFixed(2)}%`
    case 'Cons Disc': return `household spending ${c.au.householdSpendingYoY}% y/y (${c.au.householdSpendingPeriod}); mortgage holders face ${rbaBit}`
    case 'Staples': return `defensive demand in a ${regime.regime.toLowerCase()} backdrop`
    case 'Health': return `defensive and largely USD-earning — a firmer AUD trims reported earnings`
    case 'Comms': return 'steady income names; sensitive to yields at the margin'
    case 'Industrials': return `financing costs and activity — ${rbaBit}`
    case 'ETF': return 'broad market exposure — moves with the index mix'
    default: return null
  }
}

export async function buildDigest({ holdings = [], watchlist = [], now = new Date() } = {}) {
  const c = VERIFIED_CONSTANTS
  const nd = pendingRbaDecision(now.getTime())
  const ndAt = nd ? rbaDecisionAt(nd.date, nd.time) : null
  const ndDays = ndAt ? Math.ceil((ndAt - now.getTime()) / 86_400_000) : null
  const regime = currentRegime(c, now)
  const ctx = { c, nd, ndDays, regime }
  const today = sydDay(now)
  const horizon = sydDay(new Date(now.getTime() + 14 * 86_400_000))

  const [{ fetchNews }, { annotateArticles }, { getEconomicCalendar }, { CORPORATE_ACTIONS }, { upcomingEarnings }] = await Promise.all([
    import('./api'), import('./newsIntelligence'), import('./calendarService'), import('../data/corporateActions'), import('./earningsCalendar'),
  ])

  // Portfolio, by sector, largest first by cost.
  const bySector = new Map()
  for (const h of holdings) {
    if (h.type === 'crypto') continue
    const sector = SECTOR_BY_SYMBOL[h.symbol] ?? null
    if (!sector) continue
    const cost = (Number(h.shares) || 0) * (Number(h.avgCost) || 0)
    const e = bySector.get(sector) ?? { cost: 0, syms: new Set() }
    e.cost += cost; e.syms.add(h.symbol); bySector.set(sector, e)
  }
  const portfolio = [...bySector.entries()].sort((a, b) => b[1].cost - a[1].cost)
    .map(([sector, e]) => ({ label: `${sector} (${[...e.syms].slice(0, 3).join(', ')})`, text: sectorLine(sector, ctx) }))
    .filter((r) => r.text)

  // Watchlist: today's headline naming the stock, else its next dated event,
  // else the sector driver.
  let articles = []
  try { articles = annotateArticles((await fetchNews())?.articles ?? [], watchlist) } catch { /* news optional */ }
  const since = now.getTime() - 24 * 3_600_000
  const events = [
    ...CORPORATE_ACTIONS.map((a) => ({ date: a.date, ticker: a.ticker, what: a.type === 'dividend' ? 'ex-dividend' : a.type === 'results' ? 'results' : a.type === 'agm' ? 'AGM' : a.type })),
    ...upcomingEarnings(now).map((e) => ({ date: e.date, ticker: e.ticker, what: e.type === 'AGM' ? 'AGM' : 'results' })),
  ].filter((e) => e.date >= today && e.date <= horizon)
  const watch = watchlist.slice(0, 8).map((sym) => {
    const b = bare(sym)
    const story = articles.find((a) => (a.pubDate ?? 0) >= since && (a.companies ?? []).some((x) => bare(x.ticker) === b))
    const ev = events.filter((e) => bare(e.ticker) === b).sort((x, y) => x.date.localeCompare(y.date))[0]
    if (story) return { label: sym, text: `in the news: "${story.headline}" (${story.source})`, link: story.link }
    if (ev) return { label: sym, text: `${ev.what} ${ev.date === today ? 'today' : fmtDay(ev.date)}` }
    const sector = SECTOR_BY_SYMBOL[b]
    const line = sector && sectorLine(sector, ctx)
    return line ? { label: sym, text: line } : null
  }).filter(Boolean)

  // Watch today and tomorrow: high-impact releases, plus dated events for
  // anything held or watched.
  const tomorrow = sydDay(new Date(now.getTime() + 86_400_000))
  let cal = []
  try { cal = (await getEconomicCalendar()).events ?? [] } catch { /* optional */ }
  const mine = new Set([...watchlist.map(bare), ...holdings.map((h) => bare(h.symbol))])
  // Today's timed events drop off once their Sydney time has passed — "Today
  // 14:30: RBA Rate Decision" read at 4pm is no longer something to watch.
  const hhmm = now.toLocaleTimeString('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false })
  const ahead = (e) => e.date !== today || !/^\d{1,2}:\d{2}/.test(e.time ?? '') || e.time.padStart(5, '0') > hhmm
  const watchToday = [
    ...cal.filter((e) => (e.date === today || e.date === tomorrow) && ahead(e) && String(e.importance).toLowerCase() === 'high')
      .map((e) => `${e.date === today ? 'Today' : 'Tomorrow'}${/^\d/.test(e.time ?? '') ? ` ${e.time}` : ''}: ${e.event}`),
    ...events.filter((e) => (e.date === today || e.date === tomorrow) && mine.has(bare(e.ticker)))
      .map((e) => `${e.date === today ? 'Today' : 'Tomorrow'}: ${bare(e.ticker)} ${e.what}`),
  ]
  if (nd && ndDays != null && ndDays <= 7 && !watchToday.some((l) => /RBA/.test(l))) watchToday.push(`${fmtDay(nd.date)}: RBA decision, ${nd.time} — ~${nd.marketHikePct}% hike priced`)

  // Regime implication, from the holdings' own rate sensitivity.
  let neg = 0, pos = 0, total = 0
  for (const h of holdings) {
    if (h.type === 'crypto') continue
    const cost = (Number(h.shares) || 0) * (Number(h.avgCost) || 0)
    total += cost
    const { impact } = rateImpact(h)
    if (impact === 'NEGATIVE') neg += cost
    if (impact === 'POSITIVE') pos += cost
  }
  const implication = total > 0
    ? `${Math.round((neg / total) * 100)}% of your holdings by cost tend to suffer from higher rates and ${Math.round((pos / total) * 100)}% tend to benefit — ${neg - pos > 0.1 * total ? 'tilted against a tightening regime' : pos - neg > 0.1 * total ? 'tilted toward a tightening regime' : 'roughly balanced against rate moves'}.`
    : 'Add holdings to see how this regime reads against your portfolio.'

  const profile = getInvestorProfile()
  const digest = {
    day: today,
    dateLabel: now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' }).toUpperCase(),
    focus: profile?.focus ?? null,
    portfolio, watch, watchToday,
    regime: { label: regime.regime, colour: regime.colour, implication },
    generatedAt: new Date().toISOString(),
  }
  try { localStorage.setItem(KEY(today), JSON.stringify(digest)) } catch { /* quota */ }
  return digest
}

export async function getDigest(args = {}) {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY(sydDay())) ?? 'null')
    if (cached) return cached
  } catch { /* rebuild */ }
  return buildDigest(args)
}
