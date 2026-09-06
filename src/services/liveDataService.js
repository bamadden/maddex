// Live data from free, keyless public APIs.
//
// Every endpoint here was verified to return 200 with the expected shape
// before being wired in. One from the original plan did not survive that
// check and is documented at getGoldPrice below.
//
// Caching contract: each call returns { data, source } where source is one
// of 'cache' | 'live' | 'stale' | 'fallback' | 'failed'. Callers can render
// provenance from that rather than guessing how fresh a number is — which is
// the whole point of the exercise, since a plausible stale number is worse
// than a visibly stale one.

const CACHE_PREFIX = 'maddex_live_'

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* quota or private mode — cache is an optimisation, not a requirement */ }
}

// Fresh cache short-circuits the network. A failed fetch falls back to stale
// cache before giving up, because last hour's FX rate is far more useful than
// an em dash.
// Requests in flight, keyed by cache key.
//
// Without this, two components mounting against a cold cache each fire their
// own network request for the same resource — visible in the console as the
// identical failure logged twice in the same millisecond. Same fix, and the
// same reason, as aiContentService's inFlight map.
const inFlight = new Map()

async function withCache(key, fetchFn, ttlMs, fallbackData = null) {
  const cached = readCache(key)
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return { data: cached.data, source: 'cache', at: cached.timestamp }
  }

  const pending = inFlight.get(key)
  if (pending) return pending

  const run = fetchOnce(key, fetchFn, cached, fallbackData)
  inFlight.set(key, run)
  try {
    return await run
  } finally {
    inFlight.delete(key)
  }
}

async function fetchOnce(key, fetchFn, cached, fallbackData) {
  try {
    const data = await fetchFn()
    writeCache(key, data)
    return { data, source: 'live', at: Date.now() }
  } catch (err) {
    console.warn(`[LiveData] ${key} failed:`, err.message)
    if (cached) return { data: cached.data, source: 'stale', at: cached.timestamp }
    if (fallbackData != null) return { data: fallbackData, source: 'fallback', at: null }
    return { data: null, source: 'failed', at: null }
  }
}

const json = async (url, label) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${label} HTTP ${r.status}`)
  return r.json()
}

export const WEATHER_CODES = {
  0: '☀', 1: '🌤', 2: '⛅', 3: '☁', 45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌦', 61: '🌧', 63: '🌧', 65: '🌧',
  71: '🌨', 73: '🌨', 75: '🌨', 80: '🌦', 81: '🌦', 82: '🌧', 95: '⛈', 96: '⛈', 99: '⛈',
}

const EXCHANGE_CITIES = [
  { id: 'ASX',  lat: -33.87, lon: 151.21 },
  { id: 'NYSE', lat: 40.71,  lon: -74.01 },
  { id: 'LSE',  lat: 51.51,  lon: -0.13 },
  { id: 'TSE',  lat: 35.69,  lon: 139.69 },
  { id: 'HKEX', lat: 22.32,  lon: 114.17 },
  { id: 'SSE',  lat: 31.23,  lon: 121.47 },
  { id: 'SGX',  lat: 1.35,   lon: 103.82 },
]

export const liveDataService = {
  // ── FX — exchangerate-api's free open endpoint, no key ──────────────────
  async getFXRates() {
    return withCache('fx_rates', async () => {
      const d = await json('https://open.er-api.com/v6/latest/AUD', 'FX')
      if (d.result !== 'success') throw new Error('FX payload not successful')
      const r = d.rates ?? {}
      return {
        AUDUSD: r.USD, AUDEUR: r.EUR, AUDJPY: r.JPY, AUDGBP: r.GBP,
        AUDCNY: r.CNY, AUDCAD: r.CAD, AUDSGD: r.SGD, AUDNZD: r.NZD,
        AUDINR: r.INR, AUDKRW: r.KRW, AUDCHF: r.CHF,
        updated: d.time_last_update_unix ? d.time_last_update_unix * 1000 : Date.now(),
      }
    }, 60 * 60 * 1000)
  },

  // ── Crypto — CoinGecko public tier ──────────────────────────────────────
  async getCryptoPrices() {
    return withCache('crypto_prices', async () => json(
      'https://api.coingecko.com/api/v3/simple/price'
      + '?ids=bitcoin,ethereum,ripple,solana,cardano,polkadot,chainlink,avalanche-2,litecoin,uniswap'
      + '&vs_currencies=aud,usd&include_24hr_change=true&include_market_cap=true',
      'CoinGecko',
    ), 5 * 60 * 1000)
  },

  // ── Crypto Fear & Greed ─────────────────────────────────────────────────
  async getFearGreed() {
    return withCache('fear_greed', async () => {
      const d = await json('https://api.alternative.me/fng/?limit=1', 'Fear & Greed')
      const row = d?.data?.[0]
      if (!row) throw new Error('Fear & Greed payload empty')
      return {
        value: parseInt(row.value, 10),
        classification: row.value_classification,
        timestamp: Number(row.timestamp) * 1000,
      }
    }, 60 * 60 * 1000)
  },

  // ── Gold ────────────────────────────────────────────────────────────────
  // NOT frankfurter.app. That API is ECB fiat-only — it has no XAU and
  // returns {"message":"not found"} for it, verified before writing this.
  // PAX Gold is an ERC-20 token redeemable for one fine troy ounce held in
  // an LBMA vault, so it tracks spot closely and is genuinely live. It is a
  // proxy, not a spot feed, and callers should label it as one.
  async getGoldPrice() {
    return withCache('gold_price', async () => {
      const d = await json(
        'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=aud,usd&include_24hr_change=true',
        'Gold (PAXG)',
      )
      const g = d?.['pax-gold']
      if (!g?.usd) throw new Error('Gold payload empty')
      return {
        USD: Math.round(g.usd),
        AUD: Math.round(g.aud),
        change24h: g.usd_24h_change ?? null,
        proxy: 'PAXG',
        timestamp: Date.now(),
      }
    }, 15 * 60 * 1000)
  },

  // ── Seismic — USGS ──────────────────────────────────────────────────────
  async getEarthquakes(minMagnitude = 4.5) {
    const feed = minMagnitude >= 6 ? '6.0_month' : '4.5_week'
    return withCache(`earthquakes_${minMagnitude}`, async () => {
      const d = await json(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`, 'USGS')
      return (d.features ?? []).map((f) => ({
        coordinates: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
        magnitude: f.properties.mag,
        place: f.properties.place,
        time: f.properties.time,
        depth: f.geometry.coordinates[2],
      }))
    }, 10 * 60 * 1000, [])
  },

  // ── Weather at exchange cities — Open-Meteo ─────────────────────────────
  // allSettled, not all: one city failing should not blank the other six.
  async getExchangeWeather() {
    return withCache('exchange_weather', async () => {
      const results = await Promise.allSettled(EXCHANGE_CITIES.map(async (c) => {
        const d = await json(
          `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code`,
          `Weather ${c.id}`,
        )
        return {
          id: c.id,
          temp: Math.round(d.current.temperature_2m),
          code: d.current.weather_code,
          icon: WEATHER_CODES[d.current.weather_code] ?? '🌡',
        }
      }))
      const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
      if (!ok.length) throw new Error('All weather requests failed')
      return ok
    }, 60 * 60 * 1000, [])
  },

  // ── Country reference — REST Countries ──────────────────────────────────
  async getCountryData(iso2) {
    return withCache(`country_${iso2}`, async () => {
      const d = await json(`https://restcountries.com/v3.1/alpha/${iso2}`, 'REST Countries')
      const c = Array.isArray(d) ? d[0] : d
      if (!c) throw new Error('Country not found')
      return {
        name: c.name?.common,
        officialName: c.name?.official,
        capital: c.capital?.[0],
        population: c.population,
        languages: Object.values(c.languages ?? {}),
        currencies: Object.values(c.currencies ?? {}).map((x) => `${x.name} (${x.symbol ?? ''})`.trim()),
        region: c.region,
        subregion: c.subregion,
        flag: c.flag,
        area: c.area,
      }
    }, 7 * 24 * 60 * 60 * 1000)
  },

  // ── Provenance, for the settings panel and the top bar dot ──────────────
  getDataStatus() {
    const feeds = [
      ['fx_rates', 'FX Rates'],
      ['crypto_prices', 'Crypto'],
      ['gold_price', 'Gold (PAXG)'],
      ['fear_greed', 'Fear & Greed'],
      ['earthquakes_4.5', 'Earthquakes'],
      ['exchange_weather', 'Weather'],
    ]
    return feeds.map(([key, label]) => {
      const cached = readCache(key)
      if (!cached) return { key, label, kind: 'live', status: 'never', ageMins: null }
      const ageMins = Math.round((Date.now() - cached.timestamp) / 60000)
      return {
        key, label, kind: 'live', ageMins,
        status: ageMins < 1 ? 'fresh' : ageMins < 60 ? 'recent' : 'stale',
      }
    })
  },

  clearCache() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .forEach((k) => localStorage.removeItem(k))
    } catch { /* best effort */ }
  },
}

export default liveDataService
