// ─── Geocoding for the intel map's location search ──────────────────────────────────────
//
// GEOCODER: OpenStreetMap Nominatim, keyless. Its usage policy shapes three
// decisions here:
//   - SEARCH ON ENTER, NOT AS YOU TYPE. The policy explicitly forbids
//     client-side autocomplete against the public API. Recent searches fill
//     the dropdown instead, which covers most of what autocomplete would.
//   - AT MOST ONE REQUEST PER SECOND, enforced below, and identical queries
//     are answered from a session cache rather than re-sent.
//   - IDENTIFICATION. A browser cannot set User-Agent (it is a forbidden
//     header), so requests identify the app through the Referer the browser
//     sends, which the policy accepts for browser-based use. No personal
//     email address is attached to requests.
//
// Coordinates ("-33.86, 151.21") are parsed locally and never sent anywhere.

const CACHE_KEY = 'maddex_geocode_cache_v1'
const MIN_GAP_MS = 1100
let lastRequestAt = 0

export const readJson = (store, key, fallback) => { try { return JSON.parse(store.getItem(key)) ?? fallback } catch { return fallback } }
export const writeJson = (store, key, v) => { try { store.setItem(key, JSON.stringify(v)) } catch { /* quota / private mode */ } }

export async function searchLocation(query) {
  const q = query.trim()
  const coord = q.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/)
  if (coord) {
    const lat = parseFloat(coord[1]), lon = parseFloat(coord[2])
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return [{ lat, lon, display_name: `${lat}, ${lon}`, type: 'coordinates', addresstype: 'coordinates' }]
    }
  }
  const cache = readJson(sessionStorage, CACHE_KEY, {})
  const key = q.toLowerCase()
  if (cache[key]) return cache[key]

  const wait = lastRequestAt + MIN_GAP_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&addressdetails=1`, {
    headers: { 'Accept-Language': 'en' },
  })
  if (!r.ok) throw new Error(`Geocoder HTTP ${r.status}`)
  const rows = (await r.json()).map((x) => ({ ...x, lat: parseFloat(x.lat), lon: parseFloat(x.lon) }))
  writeJson(sessionStorage, CACHE_KEY, { ...cache, [key]: rows })
  return rows
}

// Zoom appropriate to what was found — a country fills the view, a building
// is close enough to see the block.
export function zoomFor(result) {
  const t = result.addresstype ?? result.type
  if (t === 'coordinates') return 10
  if (t === 'country') return 4
  if (['state', 'region', 'province'].includes(t)) return 6
  if (['city', 'town', 'municipality', 'county'].includes(t)) return 10
  if (['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet'].includes(t)) return 13
  if (['building', 'house', 'amenity', 'office', 'tourism', 'shop'].includes(t) || result.category === 'building') return 16
  return 10
}

