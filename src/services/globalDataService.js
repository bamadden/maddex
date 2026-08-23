// ─── Free public-API integrations for the Global module ────────────────────
// Both sources are unauthenticated, CORS-open, no API key required:
//  - USGS earthquake GeoJSON  (significant quakes, last 7 days)
//  - Open-Meteo forecast      (current weather for a lat/lon)
// OpenSky flight data already lives in services/api.js (fetchFlightData /
// transformFlightData); REST Countries enrichment already lives in
// services/countryApiService.js (fetchRestCountries, merged into
// useCountryData) — both are reused as-is rather than duplicated here.

import axios from 'axios'

const USGS_QUAKES_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson'
const OPEN_METEO_URL   = 'https://api.open-meteo.com/v1/forecast'

// ─── USGS significant earthquakes (last 7 days, M4.0+) ─────────────────────

export async function fetchSignificantEarthquakes() {
  const { data } = await axios.get(USGS_QUAKES_URL, { timeout: 15000 })
  const quakes = (data?.features ?? []).map(f => ({
    id:        f.id,
    mag:       f.properties.mag,
    place:     f.properties.place,
    time:      f.properties.time,
    url:       f.properties.url,
    depthKm:   f.geometry.coordinates[2],
    lon:       f.geometry.coordinates[0],
    lat:       f.geometry.coordinates[1],
  })).filter(q => q.mag != null)
  console.log('[MADDEN API] USGS earthquakes:', quakes.length, 'significant events')
  return quakes
}

// ─── Open-Meteo current weather for a single lat/lon ────────────────────────

export async function fetchCurrentWeather(lat, lon) {
  const { data } = await axios.get(OPEN_METEO_URL, {
    params: { latitude: lat, longitude: lon, current_weather: true, timezone: 'auto' },
    timeout: 10000,
  })
  return data?.current_weather ?? null
}

// WMO weather-code → short label (Open-Meteo uses the WMO code table)
const WMO_LABELS = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm',
}
export function weatherCodeLabel(code) { return WMO_LABELS[code] ?? 'Unknown' }
