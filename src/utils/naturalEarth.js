// Natural Earth 1:110m country outlines — the one geographic source with no
// tile server, no key and no rate limit behind it. Shared by the Global map
// (deck.gl) and the Macro growth map (SVG), and fetched once per session by
// whichever asks first. 110m is the small file (~840KB raw, far less over
// the wire); at the zooms either map uses, anything finer is wasted bytes.
const NE_COUNTRIES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

let countriesPromise = null

export function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = fetch(NE_COUNTRIES_URL)
      .then((r) => { if (!r.ok) throw new Error(`Natural Earth HTTP ${r.status}`); return r.json() })
      .catch((err) => {
        console.warn('[naturalEarth] country outlines unavailable:', err.message)
        countriesPromise = null   // let a later caller retry
        return null
      })
  }
  return countriesPromise
}

// ISO 3166 alpha-3 for a Natural Earth feature. ISO_A3 is "-99" for France
// and Norway (disputed-territory quirks in the source); ISO_A3_EH carries
// the code anyway, and ADM0_A3 is the last resort.
export function featureIso3(f) {
  const p = f?.properties ?? {}
  for (const k of ['ISO_A3', 'ISO_A3_EH', 'ADM0_A3']) if (p[k] && p[k] !== '-99') return p[k]
  return null
}
