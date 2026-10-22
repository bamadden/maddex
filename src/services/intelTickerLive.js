import { liveDataService } from './liveDataService'
import { getEconomicCalendar, pendingEvents } from './calendarService'
import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'

// ─── Live items for the Global intelligence ticker ─────────────────────────
//
// Each item is { tag, text, dir?, live } — tag is the bracketed category,
// dir 'up' | 'down' colours the arrow, live marks a real-time figure (the
// LIVE filter keeps only those). Every fetch is settled on its own: one feed
// timing out drops its item, not the ticker. Nothing here is estimated; an
// item whose source fails is simply absent.

const arrow = (v) => (v > 0 ? '▲' : v < 0 ? '▼' : '—')
const signed = (v, dp = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}%`
const iso = (d) => d.toISOString().slice(0, 10)

// AUD/USD from the ECB reference rate (Frankfurter), with the change on the
// previous fixing. A daily reference rate, so it is labelled REF rather than
// passed off as a streaming quote.
async function fxItem() {
  const end = new Date()
  const start = new Date(end.getTime() - 8 * 86400000)
  const r = await fetch(`/api/frankfurter/${iso(start)}..${iso(end)}?from=AUD&to=USD`)
  if (!r.ok) throw new Error(`Frankfurter ${r.status}`)
  const rates = Object.entries((await r.json())?.rates ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))
  if (rates.length < 2) throw new Error('Frankfurter: under two fixings')
  const [, prev] = rates[rates.length - 2]
  const [, last] = rates[rates.length - 1]
  const chg = ((last.USD - prev.USD) / prev.USD) * 100
  return { tag: 'FX', text: `AUD/USD ${last.USD.toFixed(4)} ${arrow(chg)} ${signed(chg)} (ECB REF)`, dir: chg >= 0 ? 'up' : 'down', live: true }
}

async function btcItem() {
  const { data } = await liveDataService.getCryptoPrices()
  const b = data?.bitcoin
  if (!b?.aud) throw new Error('no BTC')
  const chg = b.aud_24h_change ?? 0
  return { tag: 'CRYPTO', text: `BTC A$${Math.round(b.aud).toLocaleString('en-AU')} ${arrow(chg)} ${signed(chg, 1)} 24H`, dir: chg >= 0 ? 'up' : 'down', live: true }
}

async function fearGreedItem() {
  const { data } = await liveDataService.getFearGreed()
  if (data?.value == null) throw new Error('no F&G')
  return { tag: 'CRYPTO', text: `CRYPTO FEAR & GREED ${data.value} ${String(data.classification).toUpperCase()}`, live: true }
}

// Total DeFi TVL, DefiLlama, with the change on the previous daily point.
async function tvlItem() {
  const r = await fetch('https://api.llama.fi/v2/historicalChainTvl')
  if (!r.ok) throw new Error(`DefiLlama ${r.status}`)
  const rows = await r.json()
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('DefiLlama: short series')
  const last = rows[rows.length - 1].tvl
  const prev = rows[rows.length - 2].tvl
  const chg = ((last - prev) / prev) * 100
  return { tag: 'DEFI', text: `DEFI TVL US$${(last / 1e9).toFixed(1)}B ${arrow(chg)} ${signed(chg, 1)} 24H`, dir: chg >= 0 ? 'up' : 'down', live: true }
}

// The verified cash rate and its last move — dated, not live.
function rbaItem() {
  const { rba } = VERIFIED_CONSTANTS
  const [, m, d] = rba.lastDecision.split('-')
  const day = `${Number(d)} ${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Number(m) - 1]}`
  const verb = rba.lastDecisionVerb === 'HIKE' ? 'HIKED' : rba.lastDecisionVerb === 'CUT' ? 'CUT' : 'HELD'
  return { tag: 'MACRO', text: `RBA CASH RATE ${rba.cashRate.toFixed(2)}% — ${verb} ${day}`, live: false }
}

async function eventItem(now) {
  const { events } = await getEconomicCalendar()
  const next = pendingEvents(events ?? [], 30, now).find((e) => e.importance === 'high')
  if (!next) throw new Error('no event')
  // Calendar days between today and the event, both in Sydney terms.
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const days = Math.round((Date.parse(`${next.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  const when = days <= 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `${days} DAYS`
  return { tag: 'EVENT', text: `${String(next.event).toUpperCase()}: ${when}`, live: false }
}

// The newest M5+ quake, from the feed the map already holds.
export function quakeItem(earthquakes, now) {
  const q = (earthquakes ?? [])
    .map((e) => ({ mag: e.magnitude ?? e.mag, place: e.place, time: e.time }))
    .filter((e) => e.mag >= 5 && e.time)
    .sort((a, b) => b.time - a.time)[0]
  if (!q) return null
  const hrs = Math.max(0, Math.round((now - q.time) / 3600000))
  const where = String(q.place ?? '').split(',').pop().trim().toUpperCase() || 'UNKNOWN'
  return { tag: 'SEISMIC', text: `M${q.mag.toFixed(1)} ${where} — ${hrs < 1 ? 'UNDER 1H' : `${hrs}H`} AGO`, live: true }
}

export async function fetchLiveTickerItems(now = Date.now()) {
  const settled = await Promise.allSettled([fxItem(), btcItem(), eventItem(now), fearGreedItem(), tvlItem()])
  return [rbaItem(), ...settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)]
}
