// Shipping chokepoints: the one place their status is set.
//
// Global's MARITIME & SHIPPING panel, the route impact panel and the map's
// disruption zones all read status from here, so the Hormuz entry cannot say
// MONITORED in one place and "largely closed" in another. Each status is a
// Maddex editorial reading of news reports, dated the day it was entered; it
// is not a feed. The notes are descriptive and carry no figures: a share of
// world oil, a transit delay or a traffic change belongs here only with its
// own source and date.
//
// The one market figure on the routes (Brent) comes from verifiedConstants
// with that entry's date and source; see brentReading().

import { VERIFIED_CONSTANTS } from './verifiedConstants.js'

export const ROUTE_STATUS_SOURCE = 'Maddex editorial, from news reports'

export const SHIPPING_ROUTES = [
  {
    name: 'Strait of Hormuz', lat: 26.5, lon: 56.5, status: 'DISRUPTED', asOf: '2026-10-22',
    keywords: ['Iran', 'Hormuz', 'Persian Gulf', 'tanker'],
    commodity: 'Crude Oil / LNG',
    note: 'Largely closed to commercial traffic since the US–Israel war on Iran began on 28 Feb 2026',
    history: 'Earlier disruptions: the 1980–88 Tanker War and the 2019 tanker seizures.',
    asxStocks: ['WDS.AX', 'STO.AX', 'BPT.AX', 'VEA.AX'],
    asxNote: 'AU energy companies with Middle East LNG exposure',
  },
  {
    name: 'Suez Canal', lat: 30.4, lon: 32.3, status: 'DISRUPTED', asOf: '2026-09-05',
    keywords: ['Suez', 'Red Sea', 'Houthi', 'Yemen', 'Bab-el-Mandeb'],
    commodity: 'Mixed Cargo / Container',
    note: 'Houthi attacks in the Red Sea since Nov 2023 have diverted major carriers around the Cape of Good Hope',
    history: 'Closed 1967–75 after the Six-Day War.',
    asxStocks: ['MQG.AX', 'BXB.AX', 'WTC.AX', 'QAN.AX'],
    asxNote: 'AU logistics, freight and airline companies with freight-cost exposure',
  },
  {
    name: 'Strait of Malacca', lat: 2.5, lon: 101.0, status: 'MONITORED', asOf: '2026-09-05',
    keywords: ['Malacca', 'piracy', 'Singapore strait', 'Indonesia'],
    commodity: 'Oil / LNG / Container',
    note: 'Open; piracy reports in the lane. Key corridor for AU iron ore and LNG to North Asia',
    history: 'Piracy peaked in 2003–04 and fell after coordinated patrols by the littoral states.',
    asxStocks: ['BHP.AX', 'RIO.AX', 'FMG.AX', 'WDS.AX'],
    asxNote: 'AU bulk commodity exporters: a transit route for China-bound shipments',
  },
  {
    name: 'Panama Canal', lat: 9.1, lon: -79.7, status: 'OPEN', asOf: '2026-06-25',
    keywords: ['Panama Canal', 'drought', 'congestion', 'vessel'],
    commodity: 'Container / LNG / Bulk',
    note: 'Operating normally after the drought-related transit limits of 2023–24',
    history: 'Low water in 2023–24 led the canal authority to cap daily transits.',
    asxStocks: ['WDS.AX', 'BXB.AX', 'AMC.AX'],
    asxNote: 'AU LNG exporters and packaging companies with US–Asia container flow exposure',
  },
  {
    name: 'Taiwan Strait', lat: 25.0, lon: 121.0, status: 'MONITORED', asOf: '2026-09-05',
    keywords: ['Taiwan', 'PLAN', 'China military', 'Taiwan strait', 'exercises'],
    commodity: 'Semiconductor / Container',
    note: 'Open; intermittent PLA exercise activity. A main route for semiconductor supply',
    history: 'Third Taiwan Strait Crisis, 1995–96.',
    asxStocks: ['WTC.AX', 'XRO.AX', 'CPU.AX', 'TNE.AX'],
    asxNote: 'AU tech companies whose supply chains run through Taiwan',
  },
  {
    name: 'Bosphorus Strait', lat: 41.1, lon: 29.0, status: 'OPEN', asOf: '2026-06-25',
    keywords: ['Bosphorus', 'Black Sea', 'Turkey strait', 'Russia grain'],
    commodity: 'Grain / Oil / Steel',
    note: 'Open to commercial shipping; Turkey limits warship passage under the Montreux Convention',
    history: 'Closed to belligerent warships since Mar 2022 under Montreux.',
    asxStocks: ['GNC.AX', 'AWB.AX', 'ILU.AX'],
    asxNote: 'AU grain and agricultural companies exposed to global wheat and barley prices',
  },
  {
    name: 'Cape of Good Hope', lat: -34.0, lon: 18.5, status: 'MONITORED', asOf: '2026-06-25',
    keywords: ['Cape', 'South Africa', 'rerouting', 'Good Hope'],
    commodity: 'Container / Bulk / Oil',
    note: 'Carrying ships diverted from the Red Sea; port congestion reported',
    history: 'The main Europe–Asia route before the Suez Canal opened in 1869.',
    asxStocks: ['MQG.AX', 'BXB.AX', 'TCL.AX'],
    asxNote: 'AU logistics, toll infrastructure and supply chain operators exposed to freight costs',
  },
]

// Map disruption zones use their own ids; this maps them onto the table above.
const MAP_ID = { hormuz: 'Strait of Hormuz', suez: 'Suez Canal', 'red-sea': 'Suez Canal', malacca: 'Strait of Malacca', panama: 'Panama Canal', taiwan: 'Taiwan Strait' }

export function routeFor(mapId) {
  return SHIPPING_ROUTES.find((r) => r.name === MAP_ID[mapId]) ?? null
}

// Brent from verifiedConstants, with its own date and source, or null.
export function brentReading(vc = VERIFIED_CONSTANTS) {
  const c = vc?.commodities
  const value = c?.brentUSD
  if (typeof value !== 'number') return null
  return { value, asOf: c.asOfBy?.brentUSD ?? c.asOf, source: c.sourceBy?.brentUSD ?? c.source }
}
