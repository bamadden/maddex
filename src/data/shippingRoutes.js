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

// Each status is Maddex's label from the dated reports in `sources`
// (reviewed 15 Nov 2026): DISRUPTED = closure, attacks, suspension or
// large-scale diversion reported; MONITORED = open with active security
// advisories or restrictions; OPEN = normal operation reported.
export const ROUTE_STATUS_SOURCE = 'Maddex editorial, from dated news and advisory reports'

export const SHIPPING_ROUTES = [
  {
    name: 'Strait of Hormuz', lat: 26.5, lon: 56.5, status: 'DISRUPTED', asOf: '2026-11-15',
    keywords: ['Iran', 'Hormuz', 'Persian Gulf', 'tanker'],
    commodity: 'Crude Oil / LNG',
    note: "UKMTO's weekly count put transits about 65% below pre-conflict levels; JMIC kept the threat level at severe (early Nov 2026)",
    sources: [{ publisher: 'Gulf News, citing UKMTO', date: '2026-11-10', url: 'https://gulfnews.com/world/mena/hormuz-shipping-below-normal-but-not-stalled-ukmto-1.500741839' }, { publisher: "Lloyd's List Intelligence", date: '2026-11-05', url: 'https://www.lloydslistintelligence.com/resources/blog/strait-of-hormuz-brief-5-november-2026' }],
    history: 'Earlier disruptions: the 1980–88 Tanker War and the 2019 tanker seizures.',
    asxStocks: ['WDS.AX', 'STO.AX', 'BPT.AX', 'VEA.AX'],
    asxNote: 'AU energy companies with Middle East LNG exposure',
  },
  {
    name: 'Suez Canal', lat: 30.4, lon: 32.3, status: 'MONITORED', asOf: '2026-11-15',
    keywords: ['Suez', 'Red Sea', 'Houthi', 'Yemen', 'Bab-el-Mandeb'],
    commodity: 'Mixed Cargo / Container',
    note: 'Open: JMIC counted about 34 commercial transits a day through Bab al-Mandab on 1–4 Nov, below pre-July levels; major carriers have resumed Suez services',
    sources: [{ publisher: 'Gulf News, citing JMIC Update 111', date: '2026-11-06', url: 'https://gulfnews.com/business/energy/bab-al-mandab-ship-traffic-shows-signs-of-recovery-report-1.500737875' }, { publisher: 'Arab Finance, quoting the Suez Canal Authority', date: '2026-11-08', url: 'https://arabfinance.com/en/news/newdetails/evergreen-resumes-suez-canal-transits-after-nearly-three-year-hiatus' }],
    history: 'Closed 1967–75 after the Six-Day War.',
    asxStocks: ['MQG.AX', 'BXB.AX', 'WTC.AX', 'QAN.AX'],
    asxNote: 'AU logistics, freight and airline companies with freight-cost exposure',
  },
  {
    name: 'Strait of Malacca', lat: 2.5, lon: 101.0, status: 'MONITORED', asOf: '2026-11-15',
    keywords: ['Malacca', 'piracy', 'Singapore strait', 'Indonesia'],
    commodity: 'Oil / LNG / Container',
    note: 'Open; ReCAAP reported three robberies in the adjacent Singapore Strait eastbound lane on 2–10 Nov and advised a sharp lookout',
    sources: [{ publisher: 'Archyde, summarising ReCAAP ISC', date: '2026-11-11', url: 'https://www.archyde.com/crew-member-injured-in-singapore-strait-ship-robberies/' }],
    history: 'Piracy peaked in 2003–04 and fell after coordinated patrols by the littoral states.',
    asxStocks: ['BHP.AX', 'RIO.AX', 'FMG.AX', 'WDS.AX'],
    asxNote: 'AU bulk commodity exporters: a transit route for China-bound shipments',
  },
  {
    name: 'Panama Canal', lat: 9.1, lon: -79.7, status: 'OPEN', asOf: '2026-11-15',
    keywords: ['Panama Canal', 'drought', 'congestion', 'vessel'],
    commodity: 'Container / LNG / Bulk',
    note: 'The Panama Canal Authority raised daily transit slots from 33 to 34 and the Neopanamax draft to 50 ft on 9 Nov, citing improved lake levels',
    sources: [{ publisher: 'gCaptain', date: '2026-11-11', url: 'https://gcaptain.com/panama-canal-raises-daily-transit-capacity-as-water-conditions-improve/' }],
    history: 'Low water in 2023–24 led the canal authority to cap daily transits.',
    asxStocks: ['WDS.AX', 'BXB.AX', 'AMC.AX'],
    asxNote: 'AU LNG exporters and packaging companies with US–Asia container flow exposure',
  },
  {
    name: 'Taiwan Strait', lat: 25.0, lon: 121.0, status: 'MONITORED', asOf: '2026-11-15',
    keywords: ['Taiwan', 'PLAN', 'China military', 'Taiwan strait', 'exercises'],
    commodity: 'Semiconductor / Container',
    note: "No closure reported; Taiwan's coast guard said a Chinese coast guard patrol off the east coast was harassing shipping (1 Nov)",
    sources: [{ publisher: 'Reuters via gCaptain', date: '2026-11-01', url: 'https://gcaptain.com/taiwan-says-china-harassing-shipping-with-east-coast-patrol/' }],
    history: 'Third Taiwan Strait Crisis, 1995–96.',
    asxStocks: ['WTC.AX', 'XRO.AX', 'CPU.AX', 'TNE.AX'],
    asxNote: 'AU tech companies whose supply chains run through Taiwan',
  },
  {
    name: 'Bosphorus Strait', lat: 41.1, lon: 29.0, status: 'MONITORED', asOf: '2026-11-15',
    keywords: ['Bosphorus', 'Black Sea', 'Turkey strait', 'Russia grain'],
    commodity: 'Grain / Oil / Steel',
    note: 'No closure reported; Black Sea entries via the Bosphorus were down 41% on a year earlier amid attacks on ships in the Black Sea',
    sources: [{ publisher: 'The Moscow Times, relaying the WSJ', date: '2026-11-12', url: 'https://www.themoscowtimes.com/2026/11/12/ukraine-war-turns-black-sea-into-worlds-deadliest-shipping-lane-wsj-a94243' }],
    history: 'Closed to belligerent warships since Mar 2022 under Montreux.',
    asxStocks: ['GNC.AX', 'AWB.AX', 'ILU.AX'],
    asxNote: 'AU grain and agricultural companies exposed to global wheat and barley prices',
  },
  {
    name: 'Cape of Good Hope', lat: -34.0, lon: 18.5, status: 'MONITORED', asOf: '2026-11-15',
    keywords: ['Cape', 'South Africa', 'rerouting', 'Good Hope'],
    commodity: 'Container / Bulk / Oil',
    note: 'Alphaliner reported 63% of Far East–Europe container capacity had moved back from the Cape route to Suez (15 Sep–15 Oct)',
    sources: [{ publisher: 'Ship & Bunker, citing Alphaliner', date: '2026-10-21', url: 'https://shipandbunker.com/news/emea/932812-container-lines-shift-63-of-far-east-europe-capacity-back-to-suez-canal-alphaliner' }],
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
