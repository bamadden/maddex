// US Energy Information Administration: Brent and WTI spot prices, daily
// (US government data, public domain; keyless). The history pages are HTML
// tables, one row per week with Monday-to-Friday cells.
import { row } from '../lib.mjs'

export const SOURCE = { id: 'eia', name: 'US Energy Information Administration', base: 'https://www.eia.gov/dnav/pet/hist' }
const SERIES = { brent: 'RBRTED', wti: 'RWTCD' }
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }

// "2026 Nov- 9 to Nov-13" + five cells → [{ date, value }]
export function parseWeekly(htmlText) {
  const out = []
  for (const m of htmlText.matchAll(/<td class='B6'>(?:&nbsp;)*\s*(\d{4}) (\w{3})-\s*(\d{1,2}) to \w{3}-\s*\d{1,2}<\/td>([\s\S]*?)<\/tr>/g)) {
    const [, y, mon, d, rest] = m
    const cells = [...rest.matchAll(/<td class='B3'>\s*([^<]*?)\s*<\/td>/g)].map((c) => c[1])
    const monday = Date.UTC(+y, MON[mon], +d)
    cells.forEach((v, i) => {
      const value = parseFloat(v)
      if (Number.isFinite(value)) out.push({ date: new Date(monday + i * 86_400_000).toISOString().slice(0, 10), value })
    })
  }
  return out
}

export async function fetchRecord(fetchImpl) {
  const figures = {}
  for (const [k, s] of Object.entries(SERIES)) {
    const text = await (await fetchImpl(`${SOURCE.base}/${s}.htm`)).text()
    const days = parseWeekly(text)
    if (!days.length) throw new Error(`EIA ${s}: no daily rows`)
    figures[k] = { latest: days.at(-1), recent: days.slice(-30), release: text.match(/Release Date: (\d{2}\/\d{2}\/\d{4})/)?.[1] ?? null }
  }
  return { figures }
}

export function verify(record, VC) {
  const c = VC.commodities, f = record.figures
  const at = (fig, date) => fig.recent.find((p) => p.date === date)?.value ?? null
  const note = (fig, date) => (fig.latest.date > date ? `newer: ${fig.latest.value} on ${fig.latest.date}` : null)
  return [
    row('Brent spot (EIA)', 'commodities.brentUSD', c.brentUSD, at(f.brent, c.asOfBy?.brentUSD ?? c.asOf), c.asOfBy?.brentUSD ?? c.asOf, { tolerance: 0.01, note: note(f.brent, c.asOfBy?.brentUSD ?? c.asOf) }),
    row('WTI spot (EIA)', 'commodities.wtiUSD', c.wtiUSD, at(f.wti, c.asOfBy?.wtiUSD ?? c.asOf), c.asOfBy?.wtiUSD ?? c.asOf, { tolerance: 0.01, note: note(f.wti, c.asOfBy?.wtiUSD ?? c.asOf) }),
  ]
}
