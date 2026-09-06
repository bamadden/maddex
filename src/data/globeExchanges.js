// Shared exchange list + solar-position helper — used by MaddexGlobe (the
// canvas/d3 globe) and the deck.gl intel map so both stay in sync on
// exchange locations and the day/night terminator maths. Lives in its own
// data module rather than a component file so both can import it without
// tripping the fast-refresh only-export-components rule (same reasoning as
// globeRoutes.js).

// 12 major exchanges — countryId is the ISO-3166-1 numeric code used by the
// world-atlas topojson so exchange data can drive per-country HEAT colouring.
export const EXCHANGES = [
  { id: 'NYSE',   label: 'NYSE',      city: 'New York',  lat: 40.7128,  lon: -74.0060, tz: 'America/New_York',  open: [9, 30],  close: [16, 0],  countryId: 840, ySymbol: '^GSPC',   marketCapB: 28000 },
  { id: 'NASDAQ', label: 'NASDAQ',    city: 'New York',  lat: 40.7306,  lon: -73.9866, tz: 'America/New_York',  open: [9, 30],  close: [16, 0],  countryId: 840, ySymbol: '^IXIC',   marketCapB: 24000 },
  { id: 'LSE',    label: 'LSE',       city: 'London',    lat: 51.5074,  lon: -0.1278,  tz: 'Europe/London',     open: [8, 0],   close: [16, 30], countryId: 826, ySymbol: '^FTSE',   marketCapB: 3600 },
  { id: 'TSE',    label: 'TSE',       city: 'Tokyo',     lat: 35.6762,  lon: 139.6503, tz: 'Asia/Tokyo',        open: [9, 0],   close: [15, 30], countryId: 392, ySymbol: '^N225',   marketCapB: 6200 },
  { id: 'ASX',    label: 'ASX',       city: 'Sydney',    lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney',  open: [10, 0],  close: [16, 0],  countryId: 36,  ySymbol: '^AXJO',   marketCapB: 1900 },
  { id: 'HSI',    label: 'HSI',       city: 'Hong Kong', lat: 22.3193,  lon: 114.1694, tz: 'Asia/Hong_Kong',    open: [9, 30],  close: [16, 0],  countryId: 344, ySymbol: '^HSI',    marketCapB: 5500 },
  { id: 'SSE',    label: 'SSE',       city: 'Shanghai',  lat: 31.2304,  lon: 121.4737, tz: 'Asia/Shanghai',     open: [9, 30],  close: [15, 0],  countryId: 156, ySymbol: '000001.SS', marketCapB: 7000 },
  { id: 'SGX',    label: 'SGX',       city: 'Singapore', lat: 1.3521,   lon: 103.8198, tz: 'Asia/Singapore',    open: [9, 0],   close: [17, 0],  countryId: 702, ySymbol: '^STI',    marketCapB: 650 },
  { id: 'ENX',    label: 'EURONEXT',  city: 'Paris',     lat: 48.8566,  lon: 2.3522,   tz: 'Europe/Paris',      open: [9, 0],   close: [17, 30], countryId: 250, ySymbol: '^FCHI',   marketCapB: 4400 },
  { id: 'TSX',    label: 'TSX',       city: 'Toronto',   lat: 43.6532,  lon: -79.3832, tz: 'America/Toronto',   open: [9, 30],  close: [16, 0],  countryId: 124, ySymbol: '^GSPTSE', marketCapB: 3700 },
  { id: 'BSE',    label: 'BSE',       city: 'Mumbai',    lat: 18.9388,  lon: 72.8354,  tz: 'Asia/Kolkata',      open: [9, 15],  close: [15, 30], countryId: 356, ySymbol: '^BSESN',  marketCapB: 4300 },
  { id: 'KRX',    label: 'KRX',       city: 'Seoul',     lat: 37.5665,  lon: 126.9780, tz: 'Asia/Seoul',        open: [9, 0],   close: [15, 30], countryId: 410, ySymbol: '^KS11',   marketCapB: 1900 },
]

// Solar declination + subsolar longitude for `date`, used to compute the
// day/night terminator. Standard low-precision solar-position approximation
// (accurate to within ~1°) — good enough for a visual globe layer, not
// navigation. Returns [lon, lat] of the point on Earth directly under the sun.
export function subsolarPoint(date) {
  const RADd = Math.PI / 180
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0)
  const n = (date.getTime() - J2000) / 86400000
  const L = (280.460 + 0.9856474 * n) % 360
  const g = ((357.528 + 0.9856003 * n) % 360) * RADd
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RADd
  const epsilon = (23.439 - 0.0000004 * n) * RADd
  const decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda)) / RADd
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const lon = -(utcHours - 12) * 15
  return [lon, decl]
}

// Default starting orientation — Australia centred (lon 134°E, lat 25°S),
// matches the terminal's home market.
export const DEFAULT_ROTATION = [-134, 25, 0]
