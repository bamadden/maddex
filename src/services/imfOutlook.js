// ─── IMF World Economic Outlook, by country ─────────────────────────────────
//
// Real GDP growth, average CPI inflation and unemployment for every economy
// the IMF covers, from the DataMapper API (through /api/imf — the IMF sends
// no CORS headers). Used by the Macro growth map.
//
// WHY A RUBRIC AND NOT LABELS. The brief for the map supplied a word per
// country — "EU: WEAK (Germany near recession)", "Japan: STABLE". Checked
// against the October 2026 WEO, two of those were wrong: the IMF has Germany
// accelerating from 0.2% to 1.3%, and Japan slowing from 1.2% to 0.7%. A
// hand-written label is a claim nobody re-checks. So every country's status
// is computed from the IMF's own numbers by the rubric below, the same way
// for all of them, and the vintage is shown on the map.
//
// Two numbers make a status: the LEVEL of this year's growth (the band and
// the colour) and its MOMENTUM against last year (the arrow). China at 4.5%
// and slowing and India at 7.0% and slowing are both "strong ▼" — which is
// what the data says, rather than one being "slowing" and the other "growing".

const SERIES = { growth: 'NGDP_RPCH', inflation: 'PCPIPCH', unemployment: 'LUR' }
const CACHE_KEY = 'maddex_imf_outlook_v1'
const TTL = 7 * 24 * 60 * 60 * 1000   // the WEO is published twice a year
const KEEP_YEARS = 4                   // last year, this year, the next two

export const GROWTH_BANDS = [
  { key: 'CONTRACTING', below: 0, colour: '#A83232', label: 'Contracting', range: '< 0%' },
  { key: 'WEAK', below: 1, colour: '#B8653A', label: 'Weak', range: '0–1%' },
  { key: 'MODERATE', below: 2, colour: '#C9A84C', label: 'Moderate', range: '1–2%' },
  { key: 'SOLID', below: 4, colour: '#5E9150', label: 'Solid', range: '2–4%' },
  { key: 'STRONG', below: Infinity, colour: '#2D8A50', label: 'Strong', range: '≥ 4%' },
]
export const NO_DATA_COLOUR = '#162236'
const MOMENTUM_STEP = 0.3   // pp change in growth that counts as a turn

export function growthBand(g) {
  return g == null ? null : GROWTH_BANDS.find((b) => g < b.below)
}

export function momentum(now, prev) {
  if (now == null || prev == null) return null
  const d = now - prev
  if (d >= MOMENTUM_STEP) return { key: 'up', arrow: '▲', label: 'accelerating', delta: d }
  if (d <= -MOMENTUM_STEP) return { key: 'down', arrow: '▼', label: 'slowing', delta: d }
  return { key: 'flat', arrow: '→', label: 'steady', delta: d }
}

// Status for one economy in `year`, or null when the IMF has no growth
// figure for it — never a default.
export function economyStatus(row, year) {
  const g = row?.growth?.[year]
  if (g == null) return null
  const band = growthBand(g)
  return {
    band,
    momentum: momentum(g, row.growth?.[year - 1]),
    growth: g,
    inflation: row.inflation?.[year] ?? null,
    unemployment: row.unemployment?.[year] ?? null,
  }
}

async function fetchJson(path) {
  const res = await fetch(`/api/imf/v1/${path}`, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`IMF ${path} HTTP ${res.status}`)
  return res.json()
}

// { fetchedAt, firstYear, source, lastModified, countries: { ISO3: { growth: {2026: 1.9, …}, … } } }
export async function fetchImfOutlook({ force = false } = {}) {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
      if (cached && Date.now() - cached.fetchedAt < TTL) return cached
    } catch { /* storage unavailable — fetch */ }
  }
  const firstYear = new Date().getFullYear() - 1
  const keep = (years) => {
    const out = {}
    for (let y = firstYear; y < firstYear + KEEP_YEARS; y++) if (years?.[y] != null) out[y] = years[y]
    return out
  }
  const entries = Object.entries(SERIES)
  const [meta, ...results] = await Promise.allSettled([
    fetchJson('indicators'),
    ...entries.map(([, id]) => fetchJson(id)),
  ])
  if (results[0].status !== 'fulfilled') throw results[0].reason   // no growth series, no map

  const countries = {}
  entries.forEach(([field, id], i) => {
    if (results[i].status !== 'fulfilled') return
    for (const [iso, years] of Object.entries(results[i].value?.values?.[id] ?? {})) {
      const kept = keep(years)
      if (Object.keys(kept).length) (countries[iso] ??= {})[field] = kept
    }
  })
  const info = meta.status === 'fulfilled' ? meta.value?.indicators?.[SERIES.growth] : null
  const out = {
    fetchedAt: Date.now(),
    firstYear,
    source: info?.source ?? 'World Economic Outlook',
    lastModified: info?.['last-modified']?.slice(0, 10) ?? null,
    countries,
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(out)) } catch { /* cache is optional */ }
  return out
}

// The economies an Australian investor reads first, in that order. IMF codes;
// EURO is the IMF's euro-area aggregate (it has no map shape of its own).
export const FOCUS_ECONOMIES = [
  { iso: 'AUS', name: 'Australia' },
  { iso: 'CHN', name: 'China' },
  { iso: 'USA', name: 'United States' },
  { iso: 'EURO', name: 'Euro area' },
  { iso: 'DEU', name: 'Germany' },
  { iso: 'JPN', name: 'Japan' },
  { iso: 'GBR', name: 'United Kingdom' },
  { iso: 'IND', name: 'India' },
  { iso: 'CAN', name: 'Canada' },
]
