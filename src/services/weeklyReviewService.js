import { askClaudeJSON, fetchNews } from './api'
import { topStories } from './newsIntelligence'
import { liveDataService } from './liveDataService'
import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'
import { GEO_RISK_INDEX } from '../data/geopoliticalRisk'
import { getEconomicCalendar, getPreviousEvents, eventInstant } from './calendarService'
import { sydneyTzAbbr } from '../utils/dateUtils'

// ─── Weekly market review ──────────────────────────────────────────────────
//
// The daily brief looks forward to one session; this looks back over five.
// Generated once per week after the Friday close, cached under the ISO week,
// and read all weekend — the weekend is when someone has time to read it.
//
// WHICH WEEK. A review describes a finished week. From Monday morning until
// 4:30pm Sydney time on Friday the current review is LAST week's; after the
// Friday close and through the weekend it is this week's. There is no
// week-to-date review: a review written on Wednesday would be cached as the
// week's and then contradict what Thursday and Friday did.
//
// FIGURES. Same contract as the morning brief: the model may quote only what
// is in the prompt. There are no ASX index or stock moves in the prompt — the
// terminal's equity prices are labelled demo data, and a weekly review built
// on them would present a scripted week as a real one. The prompt says so,
// so the model writes about macro, rates, currency and commodities instead.

const SYD = 'Australia/Sydney'
const CACHE_PREFIX = 'maddex_weekly_review_'
const HISTORY_KEEP = 4
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const MONTHS_LONG = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

// Date arithmetic on plain YYYY-MM-DD strings at UTC midnight, so no local
// timezone or daylight-saving change can shift a day.
const toMs = (ymd) => Date.parse(`${ymd}T00:00:00Z`)
const toYmd = (ms) => new Date(ms).toISOString().slice(0, 10)
const addDays = (ymd, n) => toYmd(toMs(ymd) + n * 86400000)
const sydneyYmd = (d) => d.toLocaleDateString('en-CA', { timeZone: SYD })
const isoDow = (ymd) => ((new Date(toMs(ymd)).getUTCDay() + 6) % 7) + 1 // Mon 1 … Sun 7

// ISO week of a calendar date: the week belongs to the year of its Thursday.
export function isoWeekKey(ymd) {
  const thursday = addDays(ymd, 4 - isoDow(ymd))
  const year = thursday.slice(0, 4)
  const week = Math.floor((toMs(thursday) - toMs(`${year}-01-01`)) / (7 * 86400000)) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

// Monday to Friday of the week containing ymd.
const tradingWeekOf = (ymd) => {
  const monday = addDays(ymd, 1 - isoDow(ymd))
  return { monday, friday: addDays(monday, 4) }
}

// "20 – 24 OCTOBER 2026", or "28 SEP – 2 OCT 2026" across a month boundary.
export function weekLabel({ monday, friday }) {
  const [y1, m1, d1] = monday.split('-').map(Number)
  const [y2, m2, d2] = friday.split('-').map(Number)
  if (m1 === m2) return `${d1} – ${d2} ${MONTHS_LONG[m2 - 1]} ${y2}`
  return `${d1} ${MONTHS[m1 - 1]}${y1 !== y2 ? ` ${y1}` : ''} – ${d2} ${MONTHS[m2 - 1]} ${y2}`
}

// Past the Friday close? 4:30pm Sydney local, half an hour after the ASX
// closing auction, so the week's last session is complete.
function afterFridayClose(now) {
  const ymd = sydneyYmd(now)
  const dow = isoDow(ymd)
  if (dow >= 6) return true
  if (dow < 5) return false
  const [h, m] = now.toLocaleTimeString('en-GB', { timeZone: SYD, hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number)
  return h * 60 + m >= 16 * 60 + 30
}

// The week whose review is current at `now`.
export function reviewWeek(now = new Date()) {
  const today = sydneyYmd(now)
  const anchor = afterFridayClose(now) ? today : addDays(today, -7)
  const range = tradingWeekOf(anchor)
  return { ...range, key: isoWeekKey(range.monday), label: weekLabel(range) }
}

// ── Cache ──────────────────────────────────────────────────────────────────

const cacheKey = (weekKey) => `${CACHE_PREFIX}${weekKey}`

export function getCachedWeeklyReview(weekKey = reviewWeek().key) {
  try { return JSON.parse(localStorage.getItem(cacheKey(weekKey)) ?? 'null') } catch { return null }
}

// Newest first, read from the cache keys themselves like the brief history.
export function listWeeklyHistory(limit = HISTORY_KEEP) {
  const out = []
  try {
    for (const key of Object.keys(localStorage)) {
      const week = key.startsWith(CACHE_PREFIX) ? key.slice(CACHE_PREFIX.length) : null
      if (!week || !/^\d{4}-W\d{2}$/.test(week)) continue
      try {
        const review = JSON.parse(localStorage.getItem(key))
        if (review) out.push({ week, review })
      } catch { /* skip corrupt entry */ }
    }
  } catch { /* storage unavailable */ }
  return out.sort((a, b) => (a.week < b.week ? 1 : -1)).slice(0, limit)
}

function trimWeeklyHistory() {
  try {
    Object.keys(localStorage)
      .filter((k) => new RegExp(`^${CACHE_PREFIX}\\d{4}-W\\d{2}$`).test(k))
      .sort().reverse()
      .slice(HISTORY_KEEP)
      .forEach((k) => localStorage.removeItem(k))
  } catch { /* best-effort */ }
}

// ── Context ────────────────────────────────────────────────────────────────

const inRange = (ymd, from, to) => ymd >= from && ymd <= to
// Names for the verified-figure blocks that carry no label of their own.
const CONSTANT_LABEL = { au: 'Australian macro', us: 'US macro', cn: 'China macro', uk: 'UK macro', eu: 'Euro area macro', jp: 'Japan macro', commodities: 'Commodity prices', bonds: 'Bond yields', indices: 'Index levels' }
const dayName = (ymd) => new Date(toMs(ymd)).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

// AUD/USD over the week from the ECB reference fixings: the last fixing before
// Monday against the last one on or before Friday. A real weekly change, not
// an approximation — but a daily reference rate, so labelled as one.
async function audWeek({ monday, friday }) {
  const r = await fetch(`/api/frankfurter/${addDays(monday, -5)}..${friday}?from=AUD&to=USD`)
  if (!r.ok) throw new Error(`Frankfurter ${r.status}`)
  const rows = Object.entries((await r.json())?.rates ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))
  const before = rows.filter(([d]) => d < monday).pop()
  const last = rows.filter(([d]) => d <= friday).pop()
  if (!before || !last || last[0] < monday) throw new Error('Frankfurter: no fixings in the week')
  const chg = ((last[1].USD - before[1].USD) / before[1].USD) * 100
  return { from: before[1].USD, fromDate: before[0], to: last[1].USD, toDate: last[0], chg }
}

export async function buildWeeklyContext(week, now = new Date()) {
  const { monday, friday } = week
  const nextMonday = addDays(monday, 7)
  const nextFriday = addDays(friday, 7)
  const { rba, fed, au, us, bonds, commodities: C } = VERIFIED_CONSTANTS

  const [cal, fx, fg, gold, news] = await Promise.allSettled([
    getEconomicCalendar(),
    audWeek(week),
    liveDataService.getFearGreed(),
    liveDataService.getGoldPrice(),
    fetchNews(),
  ])
  const ok = (r) => (r.status === 'fulfilled' ? r.value : null)
  const events = ok(cal)?.events ?? []
  const nowMs = now.getTime()

  // Released this week: in the range and already past. Name and date only,
  // plus the result where the app holds a confirmed one — never a guessed
  // print.
  const results = getPreviousEvents().filter((e) => inRange(e.date, monday, friday))
  const released = events
    .filter((e) => inRange(e.date, monday, friday) && (eventInstant(e, { endOfDayIfUntimed: true })?.getTime() ?? 0) <= nowMs)
    .filter((e) => e.importance !== 'low' || /^AU /.test(e.event))
    .map((e) => {
      const res = results.find((r) => r.event.split(' (')[0] === e.event.split(' (')[0])
      return `- ${dayName(e.date)}: ${e.event} (${e.region})${res ? ` — result: ${res.result}` : ''}${e.description ? ` — ${e.description}` : ''}`
    })
  const ahead = events
    .filter((e) => inRange(e.date, nextMonday, nextFriday) && e.importance !== 'low')
    .map((e) => `- ${dayName(e.date)}${e.time && e.time !== '—' ? ` ${e.time} ${sydneyTzAbbr(e.date)}` : ''}: ${e.event} (${e.region}, ${e.importance})${e.description ? ` — ${e.description}` : ''}`)

  const decisionsIn = (list, who) => (list ?? [])
    .filter((d) => inRange(d.date, monday, friday))
    .map((d) => `- ${who} ${dayName(d.date)}: ${d.decision}${d.change ? ` ${d.change > 0 ? '+' : ''}${d.change}bp` : ''} to ${d.rateRange ?? `${d.rate.toFixed(2)}%`}${d.vote ? `, vote ${d.vote}` : ''}${d.reason ? ` — ${d.reason}` : ''}`)
  const decisions = [...decisionsIn(rba.decisions, 'RBA'), ...decisionsIn(fed.decisions, 'Fed')]
  // The other banks hold their latest decision only (no history list), which
  // is enough for a week: was it this week, and what was it.
  for (const k of ['ecb', 'boj', 'boe', 'boc', 'rbnz', 'pboc', 'snb', 'riksbank']) {
    const b = VERIFIED_CONSTANTS[k]
    if (b?.lastDecision && inRange(b.lastDecision, monday, friday)) {
      decisions.push(`- ${b.label === 'BOC' ? 'BoC' : b.label} ${dayName(b.lastDecision)}: ${b.lastDecisionVerb}${b.lastChange && b.lastChange !== '0bp' ? ` ${b.lastChange}` : ''} — rate ${b.cashRate.toFixed(2)}%${b.note ? ` (${b.note})` : ''}`)
    }
  }

  // The week's top stories: real headlines from the news feed, one per story.
  const weekStart = Date.parse(`${monday}T00:00:00+10:00`)
  const weekEnd = Date.parse(`${addDays(friday, 2)}T23:59:59+10:00`)
  const stories = news.status === 'fulfilled'
    ? topStories(news.value?.articles ?? [], { n: 3, sinceMs: weekStart, untilMs: weekEnd })
      .map((a) => `- "${a.headline}" (${a.source}${a.pubDate ? `, ${dayName(new Date(a.pubDate).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))}` : ''})`)
    : []

  // What changed in the terminal's verified figures this week: every block
  // whose as-of or last-decision date falls inside it.
  const changed = Object.entries(VERIFIED_CONSTANTS)
    .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
    .map(([key, v]) => ({ key, label: v.label ?? CONSTANT_LABEL[key] ?? key, date: [v.asOf, v.lastDecision, v.cpiLastRelease, v.release].filter((d) => typeof d === 'string' && inRange(d, monday, friday)).sort().pop() }))
    .filter((x) => x.date)
    .map((x) => `- ${x.label} — updated ${dayName(x.date)}`)

  const commodity = (label, key, unit, dp = 2) =>
    C[key] != null && `- ${label}: US$${C[key].toFixed(dp)}${unit} (settlement ${C.asOfBy?.[key] ?? C.asOf}${C.previous?.[key] ? `; ${C.previous[key] < C[key] ? 'up' : 'down'} ${Math.abs(((C[key] - C.previous[key]) / C.previous[key]) * 100).toFixed(0)}% since ${C.previous.asOf}` : ''})`
  const commodityLines = [
    commodity('Iron ore 62% Fe', 'ironOreUSD', '/t'),
    commodity('Newcastle thermal coal', 'thermalCoalUSD', '/t'),
    commodity('LNG JKM', 'lngUSDPerMMBtu', '/MMBtu'),
    commodity('Brent crude', 'brentUSD', '/bbl'),
    commodity('WTI crude', 'wtiUSD', '/bbl'),
    commodity('Copper', 'copperUSDPerLb', '/lb'),
    C.lithiumCNYPerTonne && `- Lithium carbonate (GFEX): CNY${C.lithiumCNYPerTonne.toLocaleString('en-AU')}/t (${C.asOfBy?.lithiumCNYPerTonne})`,
  ].filter(Boolean)

  const aud = ok(fx)
  const fear = ok(fg)?.data
  const goldNow = ok(gold)?.data
  const generatedOn = sydneyYmd(now)
  const live = [
    aud && `- AUD/USD (ECB reference rate): ${aud.from.toFixed(4)} on ${aud.fromDate} → ${aud.to.toFixed(4)} on ${aud.toDate}, ${aud.chg >= 0 ? '+' : '−'}${Math.abs(aud.chg).toFixed(2)}% over the week`,
    goldNow?.USD != null && `- Gold: US$${Math.round(goldNow.USD).toLocaleString('en-AU')}/oz (as at ${generatedOn})`,
    fear?.value != null && `- Crypto Fear & Greed index: ${fear.value} (${fear.classification}) as at ${generatedOn} — a crypto sentiment gauge, not an equity one`,
  ].filter(Boolean)

  const geo = GEO_RISK_INDEX.filter((r) => r.auImpact >= 65)
    .sort((a, b) => b.auImpact - a.auImpact)
    .map((r) => `- ${r.label} (AU impact ${r.auImpact}/100): ${r.summary}`)

  const spreadBp = bonds ? Math.round((bonds.au10y - bonds.us10y) * 100) : null

  return {
    week,
    sources: { released: released.length, ahead: ahead.length, aud: !!aud, live: live.length },
    text: `
This week: ${week.label} (Monday ${monday} to Friday ${friday})
Next week: ${weekLabel({ monday: nextMonday, friday: nextFriday })}

POLICY AND MACRO — verified, quote freely:
- RBA cash rate: ${rba.cashRate.toFixed(2)}% (${rba.lastDecisionVerb} on ${rba.lastDecision}); next meeting ${rba.nextMeeting}
- US Fed funds: ${fed.rateRange} (${fed.lastDecisionVerb} on ${fed.lastDecision}); next meeting ${fed.nextMeeting}
- AU CPI: ${au.cpi.toFixed(1)}% YoY (${au.cpiPeriod}), trimmed mean ${au.cpiTrimmedMean}%; RBA target ${au.rbaTargetBand}
- AU unemployment: ${au.unemployment}% (${au.unemploymentPeriod})
- AU GDP: ${au.gdpQoQ}% QoQ, ${au.gdpAnnual}% annual (${au.gdpPeriod})
${us ? `- US CPI: ${us.cpi}% YoY, core ${us.cpiCore}%; US unemployment ${us.unemployment}%` : ''}
${bonds ? `- 10Y yields: AU ${bonds.au10y.toFixed(2)}% (${bonds.au10yAsOf}), US ${bonds.us10y.toFixed(2)}% (${bonds.us10yAsOf}); spread ${spreadBp >= 0 ? '+' : ''}${spreadBp}bp` : ''}

CENTRAL BANK DECISIONS THIS WEEK:
${decisions.length ? decisions.join('\n') : '- None of the tracked central banks decided this week.'}

${stories.length ? `TOP STORIES THIS WEEK — real headlines from the news feed; refer to them, do not invent others:\n${stories.join('\n')}\n\n` : ''}${changed.length ? `VERIFIED FIGURES UPDATED THIS WEEK (the terminal's own record of what changed):\n${changed.join('\n')}\n\n` : ''}RELEASES THIS WEEK (names and dates; a result is given only where confirmed — do not supply one yourself):
${released.length ? released.join('\n') : '- No major scheduled releases this week.'}

COMMODITIES — dated settlements, quote with their dates:
${commodityLines.join('\n')}

${live.length ? `MARKETS:\n${live.join('\n')}\n` : ''}
GEOPOLITICS — Maddex's own dated assessment, for themes:
${geo.join('\n')}

NEXT WEEK'S SCHEDULE (fixed dates — use these, not any you recall):
${ahead.length ? ahead.join('\n') : '- No major scheduled events next week.'}

NOT SUPPLIED, AND NOT TO BE INVENTED: ASX 200 or any equity index level or weekly move, any stock price, sector performance, bond yield moves over the week. The terminal's equity prices are demo data, so there is no verified equity week to report. Write about rates, macro, the currency, commodities and geopolitics, and say plainly where equity performance is not covered.
`.replace(/\n{3,}/g, '\n\n').trim(),
  }
}

// ── Generation ─────────────────────────────────────────────────────────────

const WEEKLY_SYSTEM = `You are MaddenAI writing the weekly market review for Australian investors who manage their own portfolios.

It is read on the weekend, with time to think. It is not the daily brief stretched out: it explains what the week meant, names the themes that connected its events, and sets up the week ahead.

STYLE:
- Analytical, not descriptive. "The RBA held" is a fact; why it matters for borrowers and the AUD is the analysis.
- Every sentence carries a supplied fact or a judgement. No throat-clearing, no "it is important to note".
- Reference the specific events that occurred this week, by name and day.
- Australian lens throughout.

FIGURES:
- Only quote figures from the data supplied. No invented price levels, index moves or economic prints.
- A release listed without a result happened, but you were not given the number — say it was released, not what it showed.
- Where a number would be natural and none was given, describe direction in words.

Return ONLY a JSON object:
{
  "headline": "One sentence: the defining story of the week for an Australian investor",
  "sections": [
    { "title": "WEEK IN REVIEW", "content": "4-5 sentences: what happened this week, in order of importance" },
    { "title": "MARKET MOVERS", "content": "3-4 themes that drove markets, each as 'Theme — one or two sentences on why it mattered'. Separate with newlines." },
    { "title": "MACRO WATCH", "content": "4-5 sentences: rates, inflation, jobs and growth — what moved and what it means for the RBA path" },
    { "title": "WEEK AHEAD", "content": "3-4 scheduled events from next week's list, each as 'Event (day) — what to watch for'. Separate with newlines." }
  ]
}

General information only, not financial advice.`

export async function generateWeeklyReview({ force = false, now = new Date() } = {}) {
  const week = reviewWeek(now)
  if (!force) {
    const cached = getCachedWeeklyReview(week.key)
    if (cached) return cached
  }
  const context = await buildWeeklyContext(week, now)
  const review = await askClaudeJSON(`${context.text}\n\nWrite the weekly review now. Do not state any figure not listed above.`, {
    maxTokens: 2200,
    systemPrompt: WEEKLY_SYSTEM,
  })
  const stamped = {
    ...review,
    type: 'weekly',
    week: week.key,
    monday: week.monday,
    friday: week.friday,
    label: week.label,
    generatedAt: new Date().toISOString(),
  }
  try { localStorage.setItem(cacheKey(week.key), JSON.stringify(stamped)) } catch { /* best-effort cache write */ }
  trimWeeklyHistory()
  return stamped
}

// Called at app start and on a slow timer. Generates this week's review once
// the Friday close has passed, if it does not exist yet. Before the close the
// current review is last week's, and that is never generated in the
// background: someone who missed it can ask for it, but the app does not
// spend a call on a week the reader may not care about any more.
//
// A failed attempt (no credits, a malformed reply) waits an hour before the
// next, so the 15-minute timer does not become a retry loop.
let lastFailureAt = 0
export async function autoGenerateWeeklyReview(now = new Date()) {
  if (!afterFridayClose(now)) return null
  const week = reviewWeek(now)
  if (getCachedWeeklyReview(week.key)) return null
  if (now.getTime() - lastFailureAt < 60 * 60_000) return null
  try {
    return await generateWeeklyReview({ now })
  } catch (err) {
    lastFailureAt = now.getTime()
    throw err
  }
}
