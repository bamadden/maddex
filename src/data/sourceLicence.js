// Data sources switched off because their published terms do not permit
// display in a commercial subscription product without a paid plan or
// written permission (docs/DATA_SOURCES.md, terms read 1 Nov 2026).
//
// Each fetch from one of these calls licenceGuard(id) first and stops with a
// LicenceError, which the panels show as unavailable. Re-enable a source only
// with the licence on file, by deleting its entry here and updating the doc.

export const LICENCE_OFF = {
  defillama: 'DefiLlama terms: personal, non-commercial use only; republishing needs permission',
  opensky: 'OpenSky Network: commercial or live-product use needs a written licence',
  openmeteo: 'Open-Meteo free API: non-commercial use only; subscription apps need a paid plan',
  imf: 'IMF data: commercial reuse needs permission (copyright@imf.org)',
  fred: 'FRED: commercial use and caching need the St. Louis Fed\'s written consent',
  esri: 'Esri basemap tiles: need an ArcGIS subscription',
  fmp: 'Financial Modeling Prep: display in an app needs a display agreement',
  twelvedata: 'Twelve Data free tier: no commercial use or external display',
}

export class LicenceError extends Error {
  constructor(id) { super(`Not shown: ${LICENCE_OFF[id]}.`); this.name = 'LicenceError'; this.source = id }
}

export const licenceOff = (id) => Object.hasOwn(LICENCE_OFF, id)
export function licenceGuard(id) { if (licenceOff(id)) throw new LicenceError(id) }
