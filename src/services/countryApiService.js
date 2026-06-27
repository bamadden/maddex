// Country data refresh service — REST Countries, World Bank, IMF
// All fetches non-blocking: called after app load, results stored in localStorage

const CACHE_PREFIX = 'maddex_cdb_'
const TTL_24H = 24 * 60 * 60 * 1000
const TTL_7D  =  7 * 24 * 60 * 60 * 1000

// ─── Cache helpers ────────────────────────────────────────────────────────────

export function getCountryCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, expiresAt } = JSON.parse(raw)
    if (Date.now() > expiresAt) return null
    return data
  } catch { return null }
}

function setCountryCache(key, data, ttlMs) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, expiresAt: Date.now() + ttlMs, cachedAt: Date.now() }),
    )
  } catch (e) {
    console.warn('[CountryAPI] Cache write failed:', e.message)
  }
}

export function getCacheAge(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { cachedAt } = JSON.parse(raw)
    return cachedAt ? Date.now() - cachedAt : null
  } catch { return null }
}

// ─── SOURCE 1: REST Countries ─────────────────────────────────────────────────

async function fetchRestCountries() {
  const cached = getCountryCache('rest')
  if (cached) return cached

  const res = await fetch(
    'https://restcountries.com/v3.1/all?fields=name,cca2,cca3,ccn3,capital,population,area,currencies,languages,region,subregion,flags',
    { signal: AbortSignal.timeout(15_000) },
  )
  if (!res.ok) throw new Error(`REST Countries HTTP ${res.status}`)
  const raw = await res.json()

  const map = {}
  for (const c of raw) {
    if (!c.cca2) continue
    const currencyEntries = Object.entries(c.currencies ?? {})
    map[c.cca2] = {
      alpha2:    c.cca2,
      alpha3:    c.cca3,
      numericId: c.ccn3 ? parseInt(c.ccn3, 10) : null,
      name:      c.name?.common,
      capital:   c.capital?.[0] ?? null,
      population: c.population ?? null,
      area:      c.area ?? null,
      currency:  currencyEntries.length
        ? { code: currencyEntries[0][0], name: currencyEntries[0][1]?.name, symbol: currencyEntries[0][1]?.symbol }
        : null,
      languages: Object.values(c.languages ?? {}),
      region:    c.region ?? null,
      subregion: c.subregion ?? null,
      flag:      c.flags?.emoji ?? null,
    }
  }

  setCountryCache('rest', map, TTL_24H)
  console.log(`[CountryAPI] REST Countries: cached ${Object.keys(map).length} countries`)
  return map
}

// ─── SOURCE 2: World Bank ─────────────────────────────────────────────────────

const WB_INDICATORS = {
  gdpTotal:     'NY.GDP.MKTP.CD',
  gdpPerCapita: 'NY.GDP.PCAP.CD',
  gdpGrowth:    'NY.GDP.MKTP.KD.ZG',
  inflation:    'FP.CPI.TOTL.ZG',
  unemployment: 'SL.UEM.TOTL.ZS',
  population:   'SP.POP.TOTL',
}

async function fetchWbIndicator(fieldName, indicatorCode) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicatorCode}?format=json&mrv=1&per_page=300`
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`WB ${indicatorCode} HTTP ${res.status}`)
  const [, data] = await res.json()

  const map = {}
  for (const row of (data ?? [])) {
    const alpha2 = row.country?.id
    if (!alpha2 || row.value == null) continue
    if (!map[alpha2]) map[alpha2] = {}
    map[alpha2][fieldName] = row.value
    map[alpha2][`${fieldName}Year`] = row.date
  }
  return map
}

async function fetchWorldBank() {
  const cached = getCountryCache('wb')
  if (cached) return cached

  const results = await Promise.allSettled(
    Object.entries(WB_INDICATORS).map(([field, ind]) => fetchWbIndicator(field, ind))
  )

  // Merge all indicator maps by alpha2
  const merged = {}
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const [alpha2, fields] of Object.entries(r.value)) {
      if (!merged[alpha2]) merged[alpha2] = {}
      Object.assign(merged[alpha2], fields)
    }
  }

  // Convert gdpTotal from raw USD to USD millions for consistency with countryDatabase
  for (const d of Object.values(merged)) {
    if (d.gdpTotal != null) d.gdpTotal = d.gdpTotal / 1_000_000
  }

  setCountryCache('wb', merged, TTL_7D)
  console.log(`[CountryAPI] World Bank: cached ${Object.keys(merged).length} countries`)
  return merged
}

// ─── SOURCE 3: IMF DataMapper ─────────────────────────────────────────────────

async function fetchImfSeries(seriesId) {
  const url = `https://www.imf.org/external/datamapper/api/v1/${seriesId}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`IMF ${seriesId} HTTP ${res.status}`)
  const json = await res.json()
  const values = json?.values?.[seriesId] ?? {}

  const map = {}
  for (const [alpha3, years] of Object.entries(values)) {
    const sortedYears = Object.keys(years).sort()
    const latestYear  = sortedYears[sortedYears.length - 1]
    const value = years[latestYear]
    if (value != null) map[alpha3] = { value, year: latestYear }
  }
  return map
}

async function fetchImf() {
  const cached = getCountryCache('imf')
  if (cached) return cached

  const [gdpRes, infRes] = await Promise.allSettled([
    fetchImfSeries('NGDP_RPCH'),
    fetchImfSeries('PCPIPCH'),
  ])

  const merged = {}
  if (gdpRes.status === 'fulfilled') {
    for (const [alpha3, { value, year }] of Object.entries(gdpRes.value)) {
      if (!merged[alpha3]) merged[alpha3] = {}
      merged[alpha3].gdpGrowth     = value
      merged[alpha3].gdpGrowthYear = year
    }
  }
  if (infRes.status === 'fulfilled') {
    for (const [alpha3, { value, year }] of Object.entries(infRes.value)) {
      if (!merged[alpha3]) merged[alpha3] = {}
      merged[alpha3].inflation     = value
      merged[alpha3].inflationYear = year
    }
  }

  setCountryCache('imf', merged, TTL_7D)
  console.log(`[CountryAPI] IMF DataMapper: cached ${Object.keys(merged).length} countries`)
  return merged
}

// ─── Gap report ───────────────────────────────────────────────────────────────

export function logGapReport(dbAlpha2Set) {
  const restData = getCountryCache('rest')
  if (!restData) { console.log('[CountryAPI] Gap report: REST Countries not yet cached'); return }

  const missing = []
  for (const [alpha2, entry] of Object.entries(restData)) {
    if (!dbAlpha2Set.has(alpha2)) {
      missing.push({ alpha2, name: entry.name, numericId: entry.numericId })
    }
  }
  if (missing.length) {
    console.group(`[CountryAPI] Gap report: ${missing.length} REST Countries entries NOT in countryDatabase`)
    for (const m of missing) console.log(`  ${m.alpha2} (${m.numericId ?? 'no numeric'}) — ${m.name}`)
    console.groupEnd()
  } else {
    console.log('[CountryAPI] Gap report: countryDatabase covers all REST Countries entries ✓')
  }
}

// ─── Init — call once after app mounts ───────────────────────────────────────

export async function initCountryDataRefresh(dbAlpha2Set) {
  // Fire all three in parallel, non-blocking (failures logged, not thrown)
  const [restRes, wbRes, imfRes] = await Promise.allSettled([
    fetchRestCountries(),
    fetchWorldBank(),
    fetchImf(),
  ])

  if (restRes.status === 'rejected') console.warn('[CountryAPI] REST Countries failed:', restRes.reason?.message)
  if (wbRes.status  === 'rejected') console.warn('[CountryAPI] World Bank failed:', wbRes.reason?.message)
  if (imfRes.status === 'rejected') console.warn('[CountryAPI] IMF failed:', imfRes.reason?.message)

  // Log total count and gap report
  const totalCount = dbAlpha2Set?.size ?? 0
  console.log(`[CountryAPI] countryDatabase: ${totalCount} countries/territories total`)
  if (dbAlpha2Set) logGapReport(dbAlpha2Set)
}
