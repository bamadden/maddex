import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react'
import { timeAgo, sydneyClock, formatDate } from '../../utils/dateUtils'
import { SeismicSection } from './IntelSections'
import { IntelTicker, IntelFilterBar, MarketHoursCompact, CommodityIntel, GeoRiskCards } from './IntelPanel'
import { readIntelFilter, saveIntelFilter } from './intelFilter'
import { useQuery } from '@tanstack/react-query'
import { fetchGeoNews, fetchNews, fetchFlightData, transformFlightData, filterFinanceRelevant } from '../../services/api'
import { riskBand, avgGeoRisk, RISK_LAST_REVIEWED } from '../../data/geopoliticalRisk'
import ScoreNote from '../../components/ui/ScoreNote'
import { fetchCurrentWeather, weatherCodeLabel } from '../../services/globalDataService'
import { licenceOff } from '../../data/sourceLicence'
import { useAudRates } from '../../hooks/useAudRates'
import { useStore } from '../../store/useStore'
import { useCountryData } from '../../hooks/useCountryData'
import COUNTRIES from '../../data/countryDatabase'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { SHIPPING_ROUTES, FREIGHT_ROUTES } from '../../data/globeRoutes'
import { ModuleLoader, Viz3DLoader } from '../../components/ui/ModuleStates'
import ModuleHeader from '../../components/ui/ModuleHeader'
import GeopoliticalImpact from '../../components/global/GeopoliticalImpact'
import TabBar from '../../components/ui/TabBar'
import { HandEnteredBadge } from '../../components/ui/VerifiedBadge'
import DataBadge from '../../components/ui/DataBadge'
import { pastCycle } from './macroAge'
import { liveDataService } from '../../services/liveDataService'
import { VERIFIED_CONSTANTS, POLICY_RATES, POLICY_RATES_CHECKED, COUNTRY_STATS, COUNTRY_STATS_CHECKED } from '../../data/verifiedConstants'
import { SHIPPING_ROUTES as SHIPPING_ROUTE_TABLE, ROUTE_STATUS_SOURCE } from '../../data/shippingRoutes'
import { partnerTrade } from '../../services/bilateralTrade'
import { PAL } from '../../styles/palette.js'
import { useNow } from '../../hooks/useNow'

// Code-split — d3 + topojson-client pull in a large bundle only needed once
// the user actually opens the Global module.
const MaddexGlobe = lazy(() => import('../../components/globe/MaddexGlobe'))
// Three.js globe is heavier still (three + @react-three/fiber/drei) — only
// Code-split: deck.gl + maplibre are a large bundle, only needed on this view.
const DeckGLMap = lazy(() => import('./DeckGLMap'))

// ─── ISO 3166-1 Numeric → Country Data ───────────────────────────────────────

const COUNTRY_NAMES = {
  4:'Afghanistan', 8:'Albania', 12:'Algeria', 16:'American Samoa', 20:'Andorra', 24:'Angola',
  28:'Antigua and Barbuda', 31:'Azerbaijan', 32:'Argentina', 36:'Australia', 40:'Austria',
  44:'Bahamas', 48:'Bahrain', 50:'Bangladesh', 52:'Barbados', 56:'Belgium', 64:'Bhutan',
  68:'Bolivia', 70:'Bosnia and Herzegovina', 72:'Botswana', 76:'Brazil', 84:'Belize',
  86:'British Indian Ocean Territory', 90:'Solomon Islands', 96:'Brunei', 100:'Bulgaria',
  104:'Myanmar', 108:'Burundi', 112:'Belarus', 116:'Cambodia', 120:'Cameroon', 124:'Canada',
  132:'Cape Verde', 136:'Cayman Islands', 140:'Central African Republic', 144:'Sri Lanka',
  148:'Chad', 152:'Chile', 156:'China', 158:'Taiwan', 170:'Colombia', 174:'Comoros',
  175:'Mayotte', 178:'Republic of Congo', 180:'DR Congo', 184:'Cook Islands',
  188:'Costa Rica', 191:'Croatia', 192:'Cuba', 196:'Cyprus', 203:'Czech Republic', 204:'Benin',
  208:'Denmark', 212:'Dominica', 214:'Dominican Republic', 218:'Ecuador',
  222:'El Salvador', 226:'Equatorial Guinea', 232:'Eritrea', 233:'Estonia', 231:'Ethiopia',
  238:'Falkland Islands', 242:'Fiji', 246:'Finland', 250:'France', 262:'Djibouti', 266:'Gabon',
  268:'Georgia', 270:'Gambia', 275:'Palestine', 276:'Germany', 288:'Ghana', 292:'Gibraltar',
  296:'Kiribati', 300:'Greece', 308:'Grenada', 316:'Guam', 320:'Guatemala', 324:'Guinea',
  328:'Guyana', 332:'Haiti', 336:'Vatican City', 340:'Honduras', 344:'Hong Kong',
  348:'Hungary', 352:'Iceland', 356:'India', 360:'Indonesia', 364:'Iran', 368:'Iraq',
  372:'Ireland', 376:'Israel', 380:'Italy', 388:'Jamaica', 392:'Japan', 398:'Kazakhstan',
  400:'Jordan', 404:'Kenya', 408:'North Korea', 410:'South Korea', 414:'Kuwait',
  417:'Kyrgyzstan', 418:'Laos', 422:'Lebanon', 426:'Lesotho', 428:'Latvia', 430:'Liberia',
  434:'Libya', 438:'Liechtenstein', 440:'Lithuania', 442:'Luxembourg', 446:'Macau',
  450:'Madagascar', 454:'Malawi', 458:'Malaysia', 462:'Maldives', 466:'Mali', 470:'Malta',
  478:'Mauritania', 480:'Mauritius', 484:'Mexico', 492:'Monaco', 496:'Mongolia', 498:'Moldova',
  499:'Montenegro', 504:'Morocco', 508:'Mozambique', 512:'Oman', 516:'Namibia', 520:'Nauru',
  524:'Nepal', 528:'Netherlands', 540:'New Caledonia', 548:'Vanuatu', 554:'New Zealand',
  558:'Nicaragua', 562:'Niger', 566:'Nigeria', 578:'Norway', 583:'Micronesia',
  584:'Marshall Islands', 585:'Palau', 586:'Pakistan', 591:'Panama', 598:'Papua New Guinea',
  600:'Paraguay', 604:'Peru', 608:'Philippines', 616:'Poland', 620:'Portugal', 624:'Guinea-Bissau',
  626:'Timor-Leste', 630:'Puerto Rico', 634:'Qatar', 638:'Réunion', 642:'Romania', 643:'Russia',
  646:'Rwanda', 659:'Saint Kitts and Nevis', 662:'Saint Lucia',
  670:'Saint Vincent and the Grenadines', 674:'San Marino', 678:'Sao Tome and Principe',
  682:'Saudi Arabia', 686:'Senegal', 688:'Serbia', 690:'Seychelles', 694:'Sierra Leone',
  702:'Singapore', 703:'Slovakia', 705:'Slovenia', 706:'Somalia', 710:'South Africa',
  716:'Zimbabwe', 724:'Spain', 728:'South Sudan', 729:'Sudan', 740:'Suriname', 748:'Eswatini',
  752:'Sweden', 756:'Switzerland', 760:'Syria', 762:'Tajikistan', 764:'Thailand', 768:'Togo',
  776:'Tonga', 780:'Trinidad and Tobago', 784:'United Arab Emirates', 788:'Tunisia',
  792:'Turkey', 795:'Turkmenistan', 798:'Tuvalu', 800:'Uganda', 804:'Ukraine',
  807:'North Macedonia', 818:'Egypt', 826:'United Kingdom', 834:'Tanzania', 840:'United States',
  854:'Burkina Faso', 858:'Uruguay', 860:'Uzbekistan', 862:'Venezuela', 882:'Samoa',
  887:'Yemen', 894:'Zambia',
  10:'Antarctica', 304:'Greenland', 732:'Western Sahara',
}

// alpha-2 codes for flag emoji computation
const COUNTRY_A2 = {
  4:'AF',8:'AL',12:'DZ',20:'AD',24:'AO',28:'AG',31:'AZ',32:'AR',36:'AU',40:'AT',44:'BS',48:'BH',
  10:'AQ',304:'GL',732:'EH',
  50:'BD',52:'BB',56:'BE',64:'BT',68:'BO',70:'BA',72:'BW',76:'BR',84:'BZ',90:'SB',96:'BN',
  100:'BG',104:'MM',108:'BI',112:'BY',116:'KH',120:'CM',124:'CA',132:'CV',140:'CF',144:'LK',
  148:'TD',152:'CL',156:'CN',158:'TW',170:'CO',174:'KM',178:'CG',180:'CD',188:'CR',191:'HR',
  192:'CU',196:'CY',203:'CZ',204:'BJ',208:'DK',212:'DM',214:'DO',218:'EC',818:'EG',222:'SV',
  226:'GQ',232:'ER',233:'EE',231:'ET',238:'FK',242:'FJ',246:'FI',250:'FR',262:'DJ',266:'GA',
  268:'GE',270:'GM',276:'DE',288:'GH',300:'GR',308:'GD',320:'GT',324:'GN',328:'GY',332:'HT',
  340:'HN',344:'HK',348:'HU',352:'IS',356:'IN',360:'ID',364:'IR',368:'IQ',372:'IE',376:'IL',
  380:'IT',388:'JM',392:'JP',400:'JO',398:'KZ',404:'KE',408:'KP',410:'KR',414:'KW',418:'LA',
  422:'LB',426:'LS',428:'LV',430:'LR',434:'LY',440:'LT',442:'LU',446:'MO',450:'MG',454:'MW',
  458:'MY',462:'MV',466:'ML',470:'MT',478:'MR',480:'MU',484:'MX',492:'MC',496:'MN',498:'MD',
  504:'MA',508:'MZ',516:'NA',524:'NP',528:'NL',554:'NZ',558:'NI',562:'NE',566:'NG',578:'NO',
  512:'OM',586:'PK',591:'PA',598:'PG',600:'PY',604:'PE',608:'PH',616:'PL',620:'PT',634:'QA',
  642:'RO',643:'RU',646:'RW',682:'SA',686:'SN',694:'SL',703:'SK',705:'SI',706:'SO',710:'ZA',
  716:'ZW',724:'ES',729:'SD',728:'SS',740:'SR',748:'SZ',752:'SE',756:'CH',760:'SY',762:'TJ',
  764:'TH',768:'TG',780:'TT',788:'TN',792:'TR',795:'TM',800:'UG',804:'UA',784:'AE',826:'GB',
  834:'TZ',840:'US',854:'BF',858:'UY',860:'UZ',862:'VE',704:'VN',887:'YE',894:'ZM',
  275:'PS',296:'KI',417:'KG',499:'ME',520:'NR',548:'VU',583:'FM',584:'MH',585:'PW',
  624:'GW',626:'TL',659:'KN',662:'LC',670:'VC',674:'SM',678:'ST',688:'RS',690:'SC',
  702:'SG',798:'TV',807:'MK',882:'WS',776:'TO',
}

const flagEmoji = (a2) => a2
  ? [...a2.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
  : '🌐'

// Reverse lookup for partner names (stored as plain strings in COUNTRY_DETAIL)
// so the enhanced trade-partners list can show a flag next to each one.
const NAME_TO_ID = Object.fromEntries(Object.entries(COUNTRY_NAMES).map(([id, name]) => [name, parseInt(id)]))
function flagForPartnerName(name) {
  const id = NAME_TO_ID[name]
  const a2 = id != null ? COUNTRY_A2[id] : null
  return flagEmoji(a2)
}

const COUNTRIES_BY_A2 = Object.fromEntries(COUNTRIES.map(c => [c.alpha2, c]))

// Policy rates checked against each bank's own page (verifiedConstants
// POLICY_RATES). The label starts with the decision date, so macroAge can
// read it; staleness is measured from when the rate was last checked.
const policyRate = (key) => {
  const p = POLICY_RATES[key]
  return p.none
    ? { rate: null, rateLbl: null, rateNone: p.none, rateUrl: p.url, rateChecked: POLICY_RATES_CHECKED }
    : { rate: p.rate, rateLbl: `${p.decided}, ${p.bank} ${p.name}${p.verb === 'held' ? ' (held)' : ''}`, rateUrl: p.url, rateChecked: POLICY_RATES_CHECKED }
}
// A bank whose site could not be read on the check date: no rate is shown,
// rather than an unverified one.
const rateNotRead = (bank) => ({ rate: null, rateLbl: null, rateNotRead: `${bank}: not verified against the bank's own site on ${POLICY_RATES_CHECKED}, so not shown` })

// ─── Country Detail Data — July 2026 release values ──────────────────────────

// Currency, exchange, index and policy rate per country. GDP growth and CPI
// (typed from the July 2026 releases) and the typed partner lists were
// removed on 15 Nov 2026; verified figures come from COUNTRY_STATS.
const COUNTRY_DETAIL = {
  // ── Core G20 + APAC ──
  36:  { currency:'AUD', tz:'Australia/Sydney',   exchange:'ASX',         index:'ASX 200',      flag:'🇦🇺',
         macro:{ rate:VERIFIED_CONSTANTS.rba.cashRate, rateLbl:`${VERIFIED_CONSTANTS.rba.lastDecision}, RBA` }, },
  840: { currency:'USD', tz:'America/New_York',   exchange:'NYSE',        index:'S&P 500',      flag:'🇺🇸',
         macro:{ rate:VERIFIED_CONSTANTS.fed.cashRate, rateLbl:`${VERIFIED_CONSTANTS.fed.lastDecision}, Fed` }, },
  156: { currency:'CNY', tz:'Asia/Shanghai',      exchange:'SSE',         index:'CSI 300',      flag:'🇨🇳',
         macro:{ rate:VERIFIED_CONSTANTS.pboc.cashRate, rateLbl:`${VERIFIED_CONSTANTS.pboc.lastDecision}, PBoC 1Y LPR` }, },
  392: { currency:'JPY', tz:'Asia/Tokyo',         exchange:'TSE',         index:'Nikkei 225',   flag:'🇯🇵',
         macro:{ rate:VERIFIED_CONSTANTS.boj.cashRate, rateLbl:`${VERIFIED_CONSTANTS.boj.lastDecision}, BoJ` }, },
  826: { currency:'GBP', tz:'Europe/London',      exchange:'LSE',         index:'FTSE 100',     flag:'🇬🇧',
         macro:{ rate:VERIFIED_CONSTANTS.boe.cashRate, rateLbl:`${VERIFIED_CONSTANTS.boe.lastDecision}, BoE` }, },
  276: { currency:'EUR', tz:'Europe/Berlin',      exchange:'XETRA',       index:'DAX 40',       flag:'🇩🇪',
         macro:{ rate:VERIFIED_CONSTANTS.ecb.cashRate, rateLbl:`${VERIFIED_CONSTANTS.ecb.lastDecision}, ECB` }, },
  124: { currency:'CAD', tz:'America/Toronto',    exchange:'TSX',         index:'TSX Composite', flag:'🇨🇦',
         macro:{ rate:VERIFIED_CONSTANTS.boc.cashRate, rateLbl:`${VERIFIED_CONSTANTS.boc.lastDecision}, BoC` }, },
  554: { currency:'NZD', tz:'Pacific/Auckland',   exchange:'NZX',         index:'NZX 50',       flag:'🇳🇿',
         macro:{ rate:VERIFIED_CONSTANTS.rbnz.cashRate, rateLbl:`${VERIFIED_CONSTANTS.rbnz.lastDecision}, RBNZ` }, },
  356: { currency:'INR', tz:'Asia/Kolkata',       exchange:'NSE',         index:'NIFTY 50',     flag:'🇮🇳',
         macro:{ ...policyRate('rbi') }, },
  410: { currency:'KRW', tz:'Asia/Seoul',         exchange:'KRX',         index:'KOSPI',        flag:'🇰🇷',
         macro:{ ...policyRate('bok') }, },
  702: { currency:'SGD', tz:'Asia/Singapore',     exchange:'SGX',         index:'STI',          flag:'🇸🇬',
         macro:{ ...policyRate('mas') }, },
  // ── Americas ──
  76:  { currency:'BRL', tz:'America/Sao_Paulo',  exchange:'B3',          index:'Ibovespa',     flag:'🇧🇷',
         macro:{ ...policyRate('bcb') }, },
  484: { currency:'MXN', tz:'America/Mexico_City',exchange:'BMV',         index:'IPC',          flag:'🇲🇽',
         macro:{ ...policyRate('banxico') }, },
  32:  { currency:'ARS', tz:'America/Argentina/Buenos_Aires',exchange:'BYMA',index:'Merval',   flag:'🇦🇷',
         macro:{ ...policyRate('bcra') }, },
  152: { currency:'CLP', tz:'America/Santiago',   exchange:'BCS',         index:'IPSA',         flag:'🇨🇱',
         macro:{ ...rateNotRead('BCCh') }, },
  170: { currency:'COP', tz:'America/Bogota',     exchange:'BVC',         index:'COLCAP',       flag:'🇨🇴',
         macro:{ ...rateNotRead('BanRep') }, },
  // ── Middle East & Africa ──
  682: { currency:'SAR', tz:'Asia/Riyadh',        exchange:'Tadawul',     index:'TASI',         flag:'🇸🇦',
         macro:{ ...policyRate('sama') }, },
  784: { currency:'AED', tz:'Asia/Dubai',         exchange:'ADX',         index:'DFM General',  flag:'🇦🇪',
         macro:{ ...policyRate('cbuae') }, },
  818: { currency:'EGP', tz:'Africa/Cairo',       exchange:'EGX',         index:'EGX 30',       flag:'🇪🇬',
         macro:{ ...policyRate('cbe') }, },
  566: { currency:'NGN', tz:'Africa/Lagos',       exchange:'NGX',         index:'NGX All-Share', flag:'🇳🇬',
         macro:{ ...policyRate('cbn') }, },
  710: { currency:'ZAR', tz:'Africa/Johannesburg',exchange:'JSE',         index:'JSE All Share', flag:'🇿🇦',
         macro:{ ...policyRate('sarb') }, },
  // ── Europe ──
  250: { currency:'EUR', tz:'Europe/Paris',       exchange:'Euronext',    index:'CAC 40',       flag:'🇫🇷',
         macro:{ rate:VERIFIED_CONSTANTS.ecb.cashRate, rateLbl:`${VERIFIED_CONSTANTS.ecb.lastDecision}, ECB` }, },
  792: { currency:'TRY', tz:'Europe/Istanbul',    exchange:'Borsa Istanbul',index:'BIST 100',   flag:'🇹🇷',
         macro:{ ...policyRate('tcmb') }, },
  756: { currency:'CHF', tz:'Europe/Zurich',      exchange:'SIX',         index:'SMI',          flag:'🇨🇭',
         macro:{ rate:VERIFIED_CONSTANTS.snb.cashRate, rateLbl:`${VERIFIED_CONSTANTS.snb.lastDecision}, SNB` }, },
  578: { currency:'NOK', tz:'Europe/Oslo',        exchange:'Oslo Bors',   index:'OBX',          flag:'🇳🇴',
         macro:{ ...policyRate('norges') }, },
  752: { currency:'SEK', tz:'Europe/Stockholm',   exchange:'Nasdaq Stockholm',index:'OMXS30',   flag:'🇸🇪',
         macro:{ rate:VERIFIED_CONSTANTS.riksbank.cashRate, rateLbl:`${VERIFIED_CONSTANTS.riksbank.lastDecision}, Riksbank` }, },
  643: { currency:'RUB', tz:'Europe/Moscow',      exchange:'MOEX',        index:'MOEX',         flag:'🇷🇺',
         macro:{ ...policyRate('cbr') }, },
  // ── Asia ──
  344: { currency:'HKD', tz:'Asia/Hong_Kong',     exchange:'HKEX',        index:'Hang Seng',    flag:'🇭🇰',
         macro:{ ...policyRate('hkma') }, },
  158: { currency:'TWD', tz:'Asia/Taipei',        exchange:'TWSE',        index:'TAIEX',        flag:'🇹🇼',
         macro:{ ...policyRate('cbc') }, },
  704: { currency:'VND', tz:'Asia/Ho_Chi_Minh',   exchange:'HOSE',        index:'VN-Index',     flag:'🇻🇳',
         macro:{ ...policyRate('sbv') }, },
  764: { currency:'THB', tz:'Asia/Bangkok',       exchange:'SET',         index:'SET',          flag:'🇹🇭',
         macro:{ ...policyRate('bot') }, },
  458: { currency:'MYR', tz:'Asia/Kuala_Lumpur',  exchange:'Bursa',       index:'FBMKLCI',      flag:'🇲🇾',
         macro:{ ...policyRate('bnm') }, },
  608: { currency:'PHP', tz:'Asia/Manila',        exchange:'PSE',         index:'PSEi',         flag:'🇵🇭',
         macro:{ ...policyRate('bsp') }, },
  360: { currency:'IDR', tz:'Asia/Jakarta',       exchange:'IDX',         index:'JCI',          flag:'🇮🇩',
         macro:{ ...policyRate('bi') }, },
  586: { currency:'PKR', tz:'Asia/Karachi',       exchange:'PSX',         index:'KSE 100',      flag:'🇵🇰',
         macro:{ ...policyRate('sbp') }, },
  // ── Ukraine (conflict — data as available) ──
  804: { currency:'UAH', tz:'Europe/Kyiv',        exchange:'PFTS',        index:'UX',           flag:'🇺🇦',
         macro:{ ...policyRate('nbu') }, },
}

// ─── Country classification sets ─────────────────────────────────────────────

// Australia's top-five export markets and import sources, ABS 2024-25
// (verifiedConstants auTrade). The typed "conflict zone" and "sanctioned"
// country sets that stood here had no source or date and were removed.
const ABS_PARTNERS = new Set([...VERIFIED_CONSTANTS.auTrade.exports, ...VERIFIED_CONSTANTS.auTrade.imports].map((r) => r.country))

// ─── Extended country data (capital, pop, economy brief, AU trade note) ───────

// Capitals for countries the static database does not carry. The typed
// population, economy and AU-trade prose and the undated risk labels that
// stood here (figures like "GDP contracted 29%", no source) were removed on
// 15 Nov 2026.
const COUNTRY_EXTRA = {
  36: { capital: 'Canberra' },
  840: { capital: 'Washington D.C.' },
  156: { capital: 'Beijing' },
  392: { capital: 'Tokyo' },
  826: { capital: 'London' },
  276: { capital: 'Berlin' },
  124: { capital: 'Ottawa' },
  356: { capital: 'New Delhi' },
  410: { capital: 'Seoul' },
  702: { capital: 'Singapore' },
  682: { capital: 'Riyadh' },
  784: { capital: 'Abu Dhabi' },
  76: { capital: 'Brasília' },
  643: { capital: 'Moscow' },
  804: { capital: 'Kyiv' },
}



// ─── Trade Intelligence (CountryPanel) ────────────────────────────────────────
// Reuses the same SHIPPING_ROUTES/FREIGHT_ROUTES the globe renders, so the
// "routes through this region" list can never drift from what's on the map.

const COUNTRY_ROUTE_MAP = {
  36:  { shipping: ['asia-australia', 'indian-ocean'],              freight: ['sin-syd'] },            // Australia
  840: { shipping: ['trans-pacific', 'trans-atlantic'],             freight: ['hkg-lax', 'nrt-lax'] },  // United States
  156: { shipping: ['trans-pacific', 'asia-europe'],                freight: ['hkg-lax'] },             // China
  344: { shipping: ['trans-pacific', 'asia-europe'],                freight: ['hkg-lax'] },             // Hong Kong
  392: { shipping: ['trans-pacific'],                               freight: ['nrt-lax'] },             // Japan
  826: { shipping: ['trans-atlantic', 'asia-europe', 'cape-good-hope'], freight: ['dxb-lhr'] },          // United Kingdom
  276: { shipping: ['asia-europe', 'cape-good-hope'],               freight: ['fra-ord'] },              // Germany
  250: { shipping: ['asia-europe', 'cape-good-hope'],               freight: [] },                       // France
  702: { shipping: ['asia-europe', 'asia-australia', 'cape-good-hope'], freight: ['sin-syd'] },          // Singapore
  458: { shipping: ['asia-europe', 'asia-australia'],               freight: [] },                       // Malaysia
  360: { shipping: ['asia-australia'],                              freight: [] },                       // Indonesia
  356: { shipping: ['indian-ocean'],                                freight: [] },                       // India
  710: { shipping: ['cape-good-hope', 'indian-ocean'],              freight: [] },                       // South Africa
  682: { shipping: ['red-sea-suez', 'asia-europe'],                 freight: ['dxb-lhr'] },              // Saudi Arabia
  784: { shipping: ['red-sea-suez', 'asia-europe'],                 freight: ['dxb-lhr'] },              // UAE
  818: { shipping: ['red-sea-suez', 'asia-europe'],                 freight: [] },                       // Egypt
  704: { shipping: ['trans-pacific', 'asia-europe'],                freight: [] },                       // Vietnam
  158: { shipping: ['trans-pacific'],                               freight: [] },                       // Taiwan
  554: { shipping: ['asia-australia'],                              freight: [] },                       // New Zealand
  410: { shipping: ['trans-pacific'],                               freight: [] },                       // South Korea
  764: { shipping: ['asia-europe'],                                 freight: [] },                       // Thailand
}

const ROUTE_DISRUPTION_TEXT = {
  'asia-europe':    'Red Sea disruption is forcing Asia-Europe container traffic via the Cape of Good Hope, adding roughly 10-14 days to transit and raising freight costs.',
  'red-sea-suez':   'Houthi attacks in the Red Sea / Bab-el-Mandeb corridor have diverted the majority of Suez-bound traffic, cutting transit volumes sharply since late 2023.',
  'cape-good-hope': 'Traffic on this alternative route has surged as vessels reroute away from the Red Sea, and port congestion is developing as a result.',
}

function findRoute(id, kind) {
  return (kind === 'SHIPPING' ? SHIPPING_ROUTES : FREIGHT_ROUTES).find(r => r.id === id)
}


// ─── Exchanges — full global list with coordinates ────────────────────────────

const EXCHANGES = [
  // ── Australia & Oceania ──
  { id:'ASX',   abbr:'ASX',  name:'Australian Securities Exchange',   city:'Sydney',       country:'Australia',   lat:-33.8688, lon:151.2093, tz:'Australia/Sydney',               open:[10,0],  close:[16,0],  countryId:36,  currency:'AUD', region:'APAC',       index:'ASX 200', topStocks:['BHP.AX','CBA.AX','CSL.AX','WES.AX','NAB.AX'] },
  { id:'NZX',   abbr:'NZX',  name:'New Zealand Exchange',             city:'Wellington',   country:'New Zealand', lat:-41.2865, lon:174.7762, tz:'Pacific/Auckland',               open:[10,0],  close:[16,45], countryId:554, currency:'NZD', region:'APAC',       index:'NZX 50',  topStocks:['FPH.AX','FBU.NZ','MEL.NZ'] },
  // ── Asia ──
  { id:'TSE',   abbr:'TSE',  name:'Tokyo Stock Exchange',             city:'Tokyo',        country:'Japan',       lat:35.6762,  lon:139.6503, tz:'Asia/Tokyo',                     open:[9,0],   close:[15,30], countryId:392, currency:'JPY', region:'APAC',       index:'Nikkei 225', topStocks:['TM','SONY','7267.T','9984.T','6501.T'] },
  { id:'SSE',   abbr:'SSE',  name:'Shanghai Stock Exchange',          city:'Shanghai',     country:'China',       lat:31.2304,  lon:121.4737, tz:'Asia/Shanghai',                  open:[9,30],  close:[15,0],  countryId:156, currency:'CNY', region:'APAC',       index:'SSE Composite', topStocks:['601398.SS','600028.SS','601857.SS'] },
  { id:'SZSE',  abbr:'SZ',   name:'Shenzhen Stock Exchange',          city:'Shenzhen',     country:'China',       lat:22.5431,  lon:114.0579, tz:'Asia/Shanghai',                  open:[9,30],  close:[15,0],  countryId:156, currency:'CNY', region:'APAC',       index:'SZSE Component', topStocks:['000858.SZ','000001.SZ'] },
  { id:'HKEX',  abbr:'HK',   name:'Hong Kong Exchange',               city:'Hong Kong',    country:'Hong Kong',   lat:22.3193,  lon:114.1694, tz:'Asia/Hong_Kong',                 open:[9,30],  close:[16,0],  countryId:344, currency:'HKD', region:'APAC',       index:'Hang Seng', topStocks:['0700.HK','0939.HK','9988.HK'] },
  { id:'KRX',   abbr:'KRX',  name:'Korea Exchange',                   city:'Seoul',        country:'South Korea', lat:37.5665,  lon:126.9780, tz:'Asia/Seoul',                     open:[9,0],   close:[15,30], countryId:410, currency:'KRW', region:'APAC',       index:'KOSPI', topStocks:['005930.KS','000660.KS','035420.KS'] },
  { id:'SGX',   abbr:'SGX',  name:'Singapore Exchange',               city:'Singapore',    country:'Singapore',   lat:1.3521,   lon:103.8198, tz:'Asia/Singapore',                 open:[9,0],   close:[17,0],  countryId:702, currency:'SGD', region:'APAC',       index:'STI',  topStocks:['D05.SI','O39.SI','U11.SI'] },
  { id:'BSE',   abbr:'BSE',  name:'Bombay Stock Exchange',            city:'Mumbai',       country:'India',       lat:19.0760,  lon:72.8777,  tz:'Asia/Kolkata',                   open:[9,15],  close:[15,30], countryId:356, currency:'INR', region:'APAC',       index:'SENSEX', topStocks:['RELIANCE.BO','TCS.BO','HDFCBANK.BO'] },
  { id:'NSE',   abbr:'NSE',  name:'National Stock Exchange India',    city:'Mumbai',       country:'India',       lat:19.0560,  lon:72.8677,  tz:'Asia/Kolkata',                   open:[9,15],  close:[15,30], countryId:356, currency:'INR', region:'APAC',       index:'NIFTY 50', topStocks:['RELIANCE.NS','TCS.NS','INFY.NS'] },
  { id:'IDX',   abbr:'IDX',  name:'Indonesia Stock Exchange',         city:'Jakarta',      country:'Indonesia',   lat:-6.2088,  lon:106.8456, tz:'Asia/Jakarta',                   open:[9,0],   close:[15,50], countryId:360, currency:'IDR', region:'APAC',       index:'JCI',  topStocks:['BBCA.JK','BMRI.JK','TLKM.JK'] },
  { id:'Bursa', abbr:'BM',   name:'Bursa Malaysia',                   city:'Kuala Lumpur', country:'Malaysia',    lat:3.1390,   lon:101.6869, tz:'Asia/Kuala_Lumpur',              open:[9,0],   close:[17,0],  countryId:458, currency:'MYR', region:'APAC',       index:'FBMKLCI',  topStocks:['1155.KL','5183.KL','1023.KL'] },
  { id:'SET',   abbr:'SET',  name:'Stock Exchange of Thailand',       city:'Bangkok',      country:'Thailand',    lat:13.7563,  lon:100.5018, tz:'Asia/Bangkok',                   open:[10,0],  close:[16,30], countryId:764, currency:'THB', region:'APAC',       index:'SET',  topStocks:['PTT.BK','AOT.BK','KBANK.BK'] },
  { id:'PSE',   abbr:'PSE',  name:'Philippine Stock Exchange',        city:'Manila',       country:'Philippines', lat:14.5995,  lon:120.9842, tz:'Asia/Manila',                    open:[9,30],  close:[15,30], countryId:608, currency:'PHP', region:'APAC',       index:'PSEi',  topStocks:['SM.PS','BDO.PS','ALI.PS'] },
  { id:'TWSE',  abbr:'TW',   name:'Taiwan Stock Exchange',            city:'Taipei',       country:'Taiwan',      lat:25.0330,  lon:121.5654, tz:'Asia/Taipei',                    open:[9,0],   close:[13,30], countryId:158, currency:'TWD', region:'APAC',       index:'TAIEX', topStocks:['2330.TW','2317.TW','2454.TW'] },
  // ── Europe ──
  { id:'LSE',   abbr:'LSE',  name:'London Stock Exchange',            city:'London',       country:'UK',          lat:51.5074,  lon:-0.1278,  tz:'Europe/London',                  open:[8,0],   close:[16,30], countryId:826, currency:'GBP', region:'EUROPE',     index:'FTSE 100', topStocks:['SHEL','AZN','HSBC','BP','ULVR'] },
  { id:'EURONXT',abbr:'PAR', name:'Euronext Paris',                   city:'Paris',        country:'France',      lat:48.8566,  lon:2.3522,   tz:'Europe/Paris',                   open:[9,0],   close:[17,30], countryId:250, currency:'EUR', region:'EUROPE',     index:'CAC 40', topStocks:['MC.PA','OR.PA','TTE.PA'] },
  { id:'XETRA', abbr:'FRA',  name:'Frankfurt Stock Exchange',         city:'Frankfurt',    country:'Germany',     lat:50.1109,  lon:8.6821,   tz:'Europe/Berlin',                  open:[9,0],   close:[17,30], countryId:276, currency:'EUR', region:'EUROPE',     index:'DAX 40', topStocks:['SAP.DE','SIE.DE','ALV.DE'] },
  { id:'SIX',   abbr:'SIX',  name:'Swiss Exchange',                   city:'Zurich',       country:'Switzerland', lat:47.3769,  lon:8.5417,   tz:'Europe/Zurich',                  open:[9,0],   close:[17,30], countryId:756, currency:'CHF', region:'EUROPE',     index:'SMI', topStocks:['NESN.SW','ROG.SW','NOVN.SW'] },
  { id:'AMS',   abbr:'AMS',  name:'Euronext Amsterdam',               city:'Amsterdam',    country:'Netherlands', lat:52.3676,  lon:4.9041,   tz:'Europe/Amsterdam',               open:[9,0],   close:[17,30], countryId:528, currency:'EUR', region:'EUROPE',     index:'AEX', topStocks:['ASML.AS','ADYEN.AS','HEIA.AS'] },
  { id:'BME',   abbr:'MAD',  name:'Madrid Stock Exchange',            city:'Madrid',       country:'Spain',       lat:40.4168,  lon:-3.7038,  tz:'Europe/Madrid',                  open:[9,0],   close:[17,30], countryId:724, currency:'EUR', region:'EUROPE',     index:'IBEX 35',  topStocks:['SAN.MC','BBVA.MC','ITX.MC'] },
  { id:'MIL',   abbr:'MIL',  name:'Borsa Italiana',                   city:'Milan',        country:'Italy',       lat:45.4654,  lon:9.1859,   tz:'Europe/Rome',                    open:[9,0],   close:[17,30], countryId:380, currency:'EUR', region:'EUROPE',     index:'FTSE MIB',  topStocks:['ENI.MI','ISP.MI','UCG.MI'] },
  { id:'STK',   abbr:'STK',  name:'Nasdaq OMX Stockholm',             city:'Stockholm',    country:'Sweden',      lat:59.3293,  lon:18.0686,  tz:'Europe/Stockholm',               open:[9,0],   close:[17,30], countryId:752, currency:'SEK', region:'EUROPE',     index:'OMXS30',  topStocks:['VOLV-B.ST','ERIC-B.ST','ATCO-A.ST'] },
  { id:'OSL',   abbr:'OSL',  name:'Oslo Bors',                        city:'Oslo',         country:'Norway',      lat:59.9139,  lon:10.7522,  tz:'Europe/Oslo',                    open:[9,0],   close:[16,30], countryId:578, currency:'NOK', region:'EUROPE',     index:'OBX',  topStocks:['EQNR.OL','DNB.OL','AKER.OL'] },
  { id:'CPH',   abbr:'CPH',  name:'Nasdaq Copenhagen',                city:'Copenhagen',   country:'Denmark',     lat:55.6761,  lon:12.5683,  tz:'Europe/Copenhagen',              open:[9,0],   close:[17,0],  countryId:208, currency:'DKK', region:'EUROPE',     index:'OMXC25',  topStocks:['NOVO-B.CO','DSV.CO','MAERSK-B.CO'] },
  { id:'HEL',   abbr:'HEL',  name:'Nasdaq Helsinki',                  city:'Helsinki',     country:'Finland',     lat:60.1699,  lon:24.9384,  tz:'Europe/Helsinki',                open:[9,0],   close:[17,30], countryId:246, currency:'EUR', region:'EUROPE',     index:'OMXH25',  topStocks:['NOKIA.HE','FORTUM.HE'] },
  { id:'WSE',   abbr:'WSE',  name:'Warsaw Stock Exchange',            city:'Warsaw',       country:'Poland',      lat:52.2297,  lon:21.0122,  tz:'Europe/Warsaw',                  open:[9,0],   close:[17,0],  countryId:616, currency:'PLN', region:'EUROPE',     index:'WIG20',  topStocks:['PKN.WA','PKO.WA','PZU.WA'] },
  { id:'WBAG',  abbr:'VIE',  name:'Vienna Stock Exchange',            city:'Vienna',       country:'Austria',     lat:48.2082,  lon:16.3738,  tz:'Europe/Vienna',                  open:[9,0],   close:[17,30], countryId:40,  currency:'EUR', region:'EUROPE',     index:'ATX',  topStocks:['OMV.VI','VIG.VI','VER.VI'] },
  { id:'EBR',   abbr:'BRU',  name:'Euronext Brussels',                city:'Brussels',     country:'Belgium',     lat:50.8503,  lon:4.3517,   tz:'Europe/Brussels',                open:[9,0],   close:[17,30], countryId:56,  currency:'EUR', region:'EUROPE',     index:'BEL 20',  topStocks:['UCB.BR','ACKB.BR','ABI.BR'] },
  { id:'ELX',   abbr:'LIS',  name:'Euronext Lisbon',                  city:'Lisbon',       country:'Portugal',    lat:38.7223,  lon:-9.1393,  tz:'Europe/Lisbon',                  open:[8,0],   close:[16,30], countryId:620, currency:'EUR', region:'EUROPE',     index:'PSI 20',   topStocks:['EDP.LS','GALP.LS','NOS.LS'] },
  { id:'ATHEX', abbr:'ATH',  name:'Athens Stock Exchange',            city:'Athens',       country:'Greece',      lat:37.9838,  lon:23.7275,  tz:'Europe/Athens',                  open:[10,15], close:[16,0],  countryId:300, currency:'EUR', region:'EUROPE',     index:'ATHEX Composite', topStocks:['OPAP.AT','ETE.AT','ALPHA.AT'] },
  { id:'BIST',  abbr:'IST',  name:'Borsa Istanbul',                   city:'Istanbul',     country:'Turkey',      lat:41.0082,  lon:28.9784,  tz:'Europe/Istanbul',                open:[10,0],  close:[18,0],  countryId:792, currency:'TRY', region:'EUROPE',     index:'BIST 100',  topStocks:['THYAO.IS','GARAN.IS','AKBNK.IS'] },
  { id:'MOEX',  abbr:'MOX',  name:'Moscow Exchange',                  city:'Moscow',       country:'Russia',      lat:55.7558,  lon:37.6173,  tz:'Europe/Moscow',                  open:[10,0],  close:[18,50], countryId:643, currency:'RUB', region:'EUROPE',     index:'MOEX',  topStocks:['GAZP.ME','SBER.ME','LKOH.ME'] },
  // ── Middle East & Africa ──
  { id:'Tadawul',abbr:'TAD', name:'Tadawul',                          city:'Riyadh',       country:'Saudi Arabia',lat:24.7136,  lon:46.6753,  tz:'Asia/Riyadh',                    open:[10,0],  close:[15,0],  countryId:682, currency:'SAR', region:'MIDDLE EAST',index:'TASI', topStocks:['2222.SR','1211.SR','1120.SR'] },
  { id:'DFM',   abbr:'DFM',  name:'Dubai Financial Market',           city:'Dubai',        country:'UAE',         lat:25.2048,  lon:55.2708,  tz:'Asia/Dubai',                     open:[10,0],  close:[14,50], countryId:784, currency:'AED', region:'MIDDLE EAST',index:'DFM General',  topStocks:['EMAAR.DU','DU.DU','DIB.DU'] },
  { id:'ADX',   abbr:'ADX',  name:'Abu Dhabi Securities Exchange',    city:'Abu Dhabi',    country:'UAE',         lat:24.4539,  lon:54.3773,  tz:'Asia/Dubai',                     open:[10,0],  close:[14,50], countryId:784, currency:'AED', region:'MIDDLE EAST',index:'FTSE ADX',  topStocks:['ADNOCDIST.AD','IHC.AD','ALDAR.AD'] },
  { id:'TASE',  abbr:'TLV',  name:'Tel Aviv Stock Exchange',          city:'Tel Aviv',     country:'Israel',      lat:32.0853,  lon:34.7818,  tz:'Asia/Jerusalem',                 open:[9,59],  close:[17,25], countryId:376, currency:'ILS', region:'MIDDLE EAST',index:'TA-125',  topStocks:['NICE','CYBR','CHKP'] },
  { id:'EGX',   abbr:'EGX',  name:'Egyptian Exchange',                city:'Cairo',        country:'Egypt',       lat:30.0444,  lon:31.2357,  tz:'Africa/Cairo',                   open:[10,0],  close:[14,30], countryId:818, currency:'EGP', region:'AFRICA',     index:'EGX 30',   topStocks:['HRHO.CA','ETEL.CA','SWDY.CA'] },
  { id:'JSE',   abbr:'JSE',  name:'JSE',                              city:'Johannesburg', country:'South Africa', lat:-26.2041, lon:28.0473,  tz:'Africa/Johannesburg',            open:[9,0],   close:[17,0],  countryId:710, currency:'ZAR', region:'AFRICA',     index:'JSE All Share', topStocks:['NPN.JO','BHP.JO','CFR.JO'] },
  { id:'NGX',   abbr:'NGX',  name:'Nigerian Exchange',                city:'Lagos',        country:'Nigeria',     lat:6.5244,   lon:3.3792,   tz:'Africa/Lagos',                   open:[9,30],  close:[14,30], countryId:566, currency:'NGN', region:'AFRICA',     index:'NGX All-Share',   topStocks:['AIRTELAFRI.NG','DANGCEM.NG'] },
  { id:'CBSX',  abbr:'CSB',  name:'Casablanca Stock Exchange',        city:'Casablanca',   country:'Morocco',     lat:33.5731,  lon:-7.5898,  tz:'Africa/Casablanca',              open:[9,30],  close:[15,30], countryId:504, currency:'MAD', region:'AFRICA',     index:'MASI',   topStocks:['IAM.CS','ATW.CS','BCP.CS'] },
  { id:'NSEN',  abbr:'NBI',  name:'Nairobi Securities Exchange',      city:'Nairobi',      country:'Kenya',       lat:-1.2921,  lon:36.8219,  tz:'Africa/Nairobi',                 open:[9,30],  close:[15,0],  countryId:404, currency:'KES', region:'AFRICA',     index:'NSE 20',   topStocks:['EABL.KE','SAFCOM.KE'] },
  // ── Americas ──
  { id:'NYSE',  abbr:'NYSE', name:'NYSE',                             city:'New York',     country:'USA',         lat:40.7128,  lon:-74.0060, tz:'America/New_York',               open:[9,30],  close:[16,0],  countryId:840, currency:'USD', region:'AMERICAS',   index:'S&P 500', topStocks:['JPM','JNJ','UNH','BRK-B','XOM'] },
  { id:'NASDAQ',abbr:'NQ',   name:'NASDAQ',                           city:'New York',     country:'USA',         lat:40.7580,  lon:-73.9855, tz:'America/New_York',               open:[9,30],  close:[16,0],  countryId:840, currency:'USD', region:'AMERICAS',   index:'NASDAQ 100', topStocks:['AAPL','NVDA','MSFT','AMZN','META'] },
  { id:'TSX',   abbr:'TSX',  name:'Toronto Stock Exchange',           city:'Toronto',      country:'Canada',      lat:43.6532,  lon:-79.3832, tz:'America/Toronto',                open:[9,30],  close:[16,0],  countryId:124, currency:'CAD', region:'AMERICAS',   index:'TSX Composite', topStocks:['SHOP.TO','RY.TO','TD.TO'] },
  { id:'BMV',   abbr:'MEX',  name:'Mexican Stock Exchange',           city:'Mexico City',  country:'Mexico',      lat:19.4326,  lon:-99.1332, tz:'America/Mexico_City',            open:[8,30],  close:[15,0],  countryId:484, currency:'MXN', region:'AMERICAS',   index:'IPC',  topStocks:['AMXL.MX','WALMEX.MX','GFNORTEO.MX'] },
  { id:'B3',    abbr:'B3',   name:'B3 Brazil',                        city:'São Paulo',    country:'Brazil',      lat:-23.5505, lon:-46.6333, tz:'America/Sao_Paulo',              open:[10,0],  close:[17,55], countryId:76,  currency:'BRL', region:'AMERICAS',   index:'Ibovespa',  topStocks:['PETR4.SA','VALE3.SA','ITUB4.SA'] },
  { id:'BCBA',  abbr:'BUE',  name:'Buenos Aires Stock Exchange',      city:'Buenos Aires', country:'Argentina',   lat:-34.6037, lon:-58.3816, tz:'America/Argentina/Buenos_Aires', open:[11,0],  close:[17,0],  countryId:32,  currency:'ARS', region:'AMERICAS',   index:'Merval',   topStocks:['YPF','GGAL','VIST'] },
  { id:'BVC',   abbr:'BOG',  name:'Colombian Stock Exchange',         city:'Bogotá',       country:'Colombia',    lat:4.7110,   lon:-74.0721, tz:'America/Bogota',                 open:[9,0],   close:[16,0],  countryId:170, currency:'COP', region:'AMERICAS',   index:'COLCAP',   topStocks:['PFBCOLOM.CL','ECOPETROL.CL'] },
  { id:'BVL',   abbr:'LIM',  name:'Lima Stock Exchange',              city:'Lima',         country:'Peru',        lat:-12.0464, lon:-77.0428, tz:'America/Lima',                   open:[9,0],   close:[16,0],  countryId:604, currency:'PEN', region:'AMERICAS',   index:'S&P BVL',   topStocks:['ALICORC1.LM','BACKUSI1.LM'] },
  { id:'STGO',  abbr:'SCL',  name:'Santiago Stock Exchange',          city:'Santiago',     country:'Chile',       lat:-33.4489, lon:-70.6693, tz:'America/Santiago',               open:[9,30],  close:[16,0],  countryId:152, currency:'CLP', region:'AMERICAS',   index:'IPSA',  topStocks:['SQM-B.SN','FALABELLA.SN','COPEC.SN'] },
]

const COUNTRY_TO_EXCHANGE = {}
for (const ex of EXCHANGES) {
  if (ex.countryId && !COUNTRY_TO_EXCHANGE[ex.countryId]) COUNTRY_TO_EXCHANGE[ex.countryId] = ex.id
}

// ─── Chokepoints ──────────────────────────────────────────────────────────────

// Status, notes and dates live in data/shippingRoutes.js, shared with the map.
const CHOKEPOINTS = SHIPPING_ROUTE_TABLE
// Oldest and newest entry dates, for the footer (the table is hand-entered).
const CHOKEPOINT_ENTRIES = CHOKEPOINTS.map((c) => c.asOf).filter(Boolean).sort()

// ─── Commodity Flows (for map overlay) ───────────────────────────────────────


// ─── Geographic Markers ───────────────────────────────────────────────────────

// A reference list, not a ranking: the rank typed beside each port had
// no source (Sydney was ranked tenth in the world).
const MAJOR_PORTS = [
  { name:'Shanghai',    lat:31.2,  lon:121.5, type:'port' },
  { name:'Singapore',   lat:1.26,  lon:103.8, type:'port' },
  { name:'Rotterdam',   lat:51.9,  lon:4.5,   type:'port' },
  { name:'Ningbo',      lat:29.9,  lon:121.6, type:'port' },
  { name:'Busan',       lat:35.1,  lon:129.1, type:'port' },
  { name:'Shenzhen',    lat:22.5,  lon:114.1, type:'port' },
  { name:'Guangzhou',   lat:22.6,  lon:113.7, type:'port' },
  { name:'Dubai',       lat:25.3,  lon:55.4,  type:'port' },
  { name:'Port Hedland',lat:-20.3, lon:118.6, type:'port' },
  { name:'Sydney',      lat:-33.9, lon:151.2, type:'port' },
  { name:'Los Angeles', lat:33.7,  lon:-118.2,type:'port' },
  { name:'Hamburg',     lat:53.5,  lon:10.0,  type:'port' },
]


// ─── Air Trade Routes ──────────────────────────────────────────────────────────




// ─── Session zones (lat/lon bounding boxes) ───────────────────────────────────

const SESSIONS = [
  { name:'SYDNEY/TOKYO', tz:'Australia/Sydney', open:[10,0], close:[16,0],
    color:'rgba(200,168,75,0.08)', region:'asia-pacific' },
  { name:'LONDON',       tz:'Europe/London',    open:[8,0],  close:[16,30],
    color:'rgba(59,130,246,0.08)', region:'europe' },
  { name:'NEW YORK',     tz:'America/New_York', open:[9,30], close:[16,0],
    color:'rgba(0,200,83,0.06)',   region:'americas' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatus(ex) {
  try {
    const now   = new Date()
    const local = new Date(now.toLocaleString('en-US', { timeZone: ex.tz }))
    const day   = local.getDay()
    if (day === 0 || day === 6) return 'CLOSED'
    const mins  = local.getHours() * 60 + local.getMinutes()
    const open  = ex.open[0] * 60 + ex.open[1]
    const close = ex.close[0] * 60 + ex.close[1]
    if (mins >= open && mins < close) {
      return (close - mins) <= 60 ? 'CLOSING_SOON' : 'OPEN'
    }
    if (mins < open && (open - mins) <= 60) return 'OPENING_SOON'
    return 'CLOSED'
  } catch { return 'CLOSED' }
}

const isOpenNow  = st => st === 'OPEN' || st === 'CLOSING_SOON'
const STATUS_CLS   = {
  OPEN:         'text-terminal-green',
  CLOSING_SOON: 'text-terminal-gold',
  OPENING_SOON: 'text-terminal-gold',
  CLOSED:       'text-terminal-text-dim',
}
const STATUS_LABEL = { OPEN: 'OPEN', CLOSING_SOON: 'CLOSING SOON', OPENING_SOON: 'OPENING SOON', CLOSED: 'CLOSED' }
const STATUS_DOT_CLS = {
  OPEN:         'bg-terminal-green animate-pulse',
  CLOSING_SOON: 'bg-terminal-gold',
  OPENING_SOON: 'bg-terminal-gold',
  CLOSED:       'bg-terminal-border',
}

function localTime(tz) {
  try {
    return new Date().toLocaleTimeString('en-AU', { hour12:false, timeZone:tz, hour:'2-digit', minute:'2-digit' })
  } catch { return '—' }
}

function countdown(ex) {
  try {
    const now   = new Date()
    const local = new Date(now.toLocaleString('en-US', { timeZone: ex.tz }))
    const day   = local.getDay()
    if (day === 0 || day === 6) return null
    const mins  = local.getHours() * 60 + local.getMinutes()
    const open  = ex.open[0] * 60 + ex.open[1]
    const close = ex.close[0] * 60 + ex.close[1]
    if (mins < open)  { const d = open  - mins; return `opens ${Math.floor(d/60)}h ${d%60}m` }
    if (mins < close) { const d = close - mins; return `closes ${Math.floor(d/60)}h ${d%60}m` }
    return null
  } catch { return null }
}

// Word tags, not assessments: a headline is tagged by the first list whose
// words it contains. The screen says so wherever a tag is shown.
const TAG_NOTE = 'Tags come from words in the headline (CRITICAL: war, missile, attack; HIGH: sanction, coup, troops; MEDIUM: tariff, protest, election). A word match, not an assessment of the event.'
const SEVERITY_RE = {
  CRITICAL: /\bwar\b|invasion|nuclear|strikes?|bombing|airstrike|missile|attack/i,
  HIGH:     /sanction|embargo|coup|siege|offensive|troops?|military operation/i,
  MEDIUM:   /tariff|protest|election|tensions?|dispute|threat|rally/i,
  LOW:      /diplomati|talks?|summit|agreement|negotiat|treaty/i,
}
function detectSeverity(text) {
  if (SEVERITY_RE.CRITICAL.test(text)) return 'CRITICAL'
  if (SEVERITY_RE.HIGH.test(text))     return 'HIGH'
  if (SEVERITY_RE.MEDIUM.test(text))   return 'MEDIUM'
  return 'LOW'
}

const IMPACT_RE = {
  COMMODITIES: /oil|gas|lng|coal|iron|wheat|gold|copper|commodity|opec|crude/i,
  FX:          /yuan|dollar|yen|ruble|currency|fx|exchange rate/i,
  EQUITIES:    /stock|market|equity|shares?|asx|nasdaq/i,
  ENERGY:      /energy|power|petroleum|pipeline|refinery/i,
  'SUPPLY CHAIN': /supply chain|shipping|freight|port|trade route|cargo/i,
}
function detectImpact(text) {
  for (const [k, re] of Object.entries(IMPACT_RE)) if (re.test(text)) return k
  return 'GLOBAL'
}

// Chokepoint status is the reviewed label in shippingRoutes.js, with its
// dated sources. A headline keyword match used to overwrite it ("attack" →
// DISRUPTED, "resum" → OPEN); matching headlines are now listed as related
// news only (15 Nov 2026).



const GEO_RISK_RE = /sanction|conflict|trade.?war|tariff|embargo|military|geopolitic|tension|coup|invasion|escalat|naval|nuclear|attack|crisis|war\b|protest|strike\b/i
const COUNTRY_KEYWORDS = {
  'Ukraine': /ukraine|kyiv|zelensky|zaporizhzhia|kharkiv|dnipro/i,
  'Russia': /russia|kremlin|putin|moscow|novak|siluanov/i,
  'China': /china|beijing|xi jinping|ccp|pla|taiwan/i,
  'Middle East': /iran|israel|gaza|hamas|hezbollah|houthi|saudi|yemen|hormuz/i,
  'United States': /united states|white house|pentagon|federal reserve|biden|trump/i,
  'Australia': /australia|canberra|albanese|rba|asx/i,
}

const SEVERITY_COLOR = {
  CRITICAL: 'text-terminal-red',
  HIGH:     'text-orange-400',
  MEDIUM:   'text-terminal-gold',
  LOW:      'text-terminal-text-dim',
}
const SEVERITY_BG = {
  CRITICAL: 'border-terminal-red/40',
  HIGH:     'border-orange-500/40',
  MEDIUM:   'border-terminal-gold/30',
  LOW:      'border-terminal-border',
}
const IMPACT_COLOR = {
  COMMODITIES: 'text-terminal-gold',
  FX:          'text-terminal-blue-bright',
  EQUITIES:    'text-terminal-green',
  ENERGY:      'text-orange-400',
  'SUPPLY CHAIN': 'text-purple-400',
  GLOBAL:      'text-terminal-text-dim',
}
const CHOKE_COLOR = { OPEN:'text-terminal-green', MONITORED:'text-terminal-gold', DISRUPTED:'text-orange-400', CLOSED:'text-terminal-red' }
const CHOKE_DOT   = { OPEN:'bg-terminal-green', MONITORED:'bg-terminal-gold animate-pulse', DISRUPTED:'bg-orange-400 animate-pulse', CLOSED:'bg-terminal-red animate-pulse' }

// ─── Country Side Panel ───────────────────────────────────────────────────────

// ─── Currency display helpers ─────────────────────────────────────────────────

// audUsd is null until a rate has loaded; a figure that needs converting is
// then "—", never converted at a fixed rate.




function useLocalTime(tz) {
  const fmt = useCallback(() => {
    if (!tz) return null
    try {
      return new Date().toLocaleTimeString('en-AU', {
        timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    } catch { return null }
  }, [tz])
  const [time, setTime] = useState(fmt)
  useEffect(() => {
    // Starts a one-second clock and seeds it immediately, so the first paint
    // shows a time rather than an empty slot for up to a second. A timer is an
    // external system by definition.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTime(fmt())
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [fmt])
  return time
}


// ─── Country Panel ────────────────────────────────────────────────────────────

// Helper: row with label + value, always rendered
// A hand-entered figure older than its publishing cycle (macroAge) has
// probably been superseded; it is kept, dated, and marked.
function OutOfDate({ label, kind }) {
  if (!pastCycle(label, kind === 'rate' ? 'rate' : 'release')) return null
  const what = kind === 'rate' ? 'later meetings since; not rechecked' : 'a newer release is likely; not yet entered'
  return <span data-out-of-date className="block text-2xs text-orange-400" title={`Entered as ${label}. ${what}.`}>may be out of date</span>
}

function PRow({ label, value, cls }) {
  return (
    <div className="flex justify-between text-2xs py-0.5">
      <span className="text-terminal-text-dim flex-shrink-0">{label}</span>
      <span className={`text-right ml-2 ${cls ?? 'text-terminal-text-bright'}`}>{value ?? '—'}</span>
    </div>
  )
}

const COUNTRY_PANEL_TABS = [
  { id: 'economy',      label: 'ECONOMY' },
  { id: 'markets',      label: 'MARKETS' },
  { id: 'geopolitical', label: 'GEOPOLITICAL' },
  { id: 'trade',        label: 'TRADE' },
]

function CountryPanel({ id, newsItems, audRates: _audRates, audUsd: _audUsd = null, currencyMode = 'AUD', onCurrencyToggle, onClose, onAskAI }) {
  const { openModal } = useStore()
  const [panelTab, setPanelTab] = useState('economy')
  const n      = parseInt(id)
  const name   = COUNTRY_NAMES[n] ?? 'Unknown Territory'
  const detail = COUNTRY_DETAIL[n]
  const extra  = COUNTRY_EXTRA[n]
  const exchId = COUNTRY_TO_EXCHANGE[n]
  const ex     = exchId ? EXCHANGES.find(e => e.id === exchId) : null
  const a2     = COUNTRY_A2[n] ?? null
  // Raw static-DB row — only used for the two fields useCountryData doesn't
  // expose (timezone, dataAsAt). Everything else below comes from the hook,
  // which merges REST Countries > World Bank > IMF > this same static row.
  const dbEntry = COUNTRIES_BY_A2[a2 ?? ''] ?? null
  const enriched = useCountryData(a2)

  // Resolved fields — enriched (live/merged) data wins, then legacy
  // COUNTRY_DETAIL / COUNTRY_EXTRA (this module's own hand-curated overrides)
  const tz          = dbEntry?.timezone ?? detail?.tz ?? null
  const flag        = detail?.flag ?? enriched?.flag ?? flagEmoji(a2)
  const capital     = extra?.capital ?? enriched?.capital ?? null
  const region      = enriched?.region ?? null
  const currCode    = detail?.currency ?? enriched?.currency?.code ?? null
  const currName    = enriched?.currency?.name ?? null
  const languages   = enriched?.languages ?? null
  const govType     = enriched?.governmentType ?? null

  // Economy: GDP growth and CPI only as read from the national statistics
  // agency (verifiedConstants COUNTRY_STATS); a euro member without its own
  // entry shows the euro-area figure, labelled as such. Anything else shows
  // a note, never a typed or default figure (15 Nov 2026).
  const statsKey    = COUNTRY_STATS[a2] ? a2 : (enriched?.interestRateBank === 'European Central Bank' && COUNTRY_STATS.EA ? 'EA' : null)
  const stats       = statsKey ? COUNTRY_STATS[statsKey] : null
  const statLbl     = (x) => (x ? `${x.period}, ${x.agency}${statsKey === 'EA' ? ' (euro area)' : ''}` : null)
  const gdpGrowth   = stats?.gdp?.value ?? null
  const gdpLbl      = statLbl(stats?.gdp)
  const inflation   = stats?.cpi?.value ?? null
  const inflLbl     = statLbl(stats?.cpi)
  // Policy rate: only a figure checked against its bank (verifiedConstants).
  // The country database's own typed rates were removed on 15 Nov; a euro
  // member without its own row takes the verified ECB rate.
  const ecbMember   = !detail?.macro && enriched?.interestRateBank === 'European Central Bank'
  const intRate     = detail?.macro?.rate ?? (ecbMember ? VERIFIED_CONSTANTS.ecb.cashRate : null)
  const intRateLbl  = detail?.macro?.rateLbl ?? (ecbMember ? `${VERIFIED_CONSTANTS.ecb.lastDecision}, ECB` : null)
  const intRateUrl  = detail?.macro?.rateUrl ?? null
  const intRateChecked = detail?.macro?.rateChecked ?? (ecbMember ? VERIFIED_CONSTANTS.ecb.lastVerified : null)
  const intRateNone = detail?.macro?.rateNone ?? null
  const intRateNotRead = detail?.macro?.rateNotRead ?? null
  const intRateBank = enriched?.interestRateBank ?? null

  // Trade: partners and values only from the ABS (verifiedConstants auTrade);
  // the typed export, import and partner lists were unsourced rankings.

  // Exchange
  const exName      = detail?.exchange ?? null
  const exIndex     = detail?.index    ?? null

  const isPartner   = ABS_PARTNERS.has(COUNTRY_NAMES[n])
  const hasData     = !!(enriched || detail)

  // ── Trade Intelligence ──
  const routeMap        = COUNTRY_ROUTE_MAP[n] ?? { shipping: [], freight: [] }
  const shippingRoutes   = routeMap.shipping.map(id => findRoute(id, 'SHIPPING')).filter(Boolean)
  const freightRoutes    = routeMap.freight.map(id => findRoute(id, 'FREIGHT')).filter(Boolean)
  const disruptedRoutes  = shippingRoutes.filter(r => r.status === 'DISRUPTED' || r.status === 'CONGESTED')
  const partnerNames     = COUNTRY_NAMES[n] === 'Australia' ? [...ABS_PARTNERS] : (isPartner ? ['Australia'] : [])
  const enhancedPartners = partnerNames.map(p => ({ name: p, flag: flagForPartnerName(p), trade: partnerTrade(COUNTRY_NAMES[n], p) }))
  const tradeSource      = enhancedPartners.find(p => p.trade)?.trade ?? null

  // Live local time — ticks every second
  const lt = useLocalTime(tz)
  const exCountdown = ex ? countdown(ex) : null

  const relatedNews = useMemo(() => {
    if (!newsItems?.articles || !name) return []
    const aliases = [name.toLowerCase()]
    if (n === 156) aliases.push('beijing', 'china', 'chinese')
    if (n === 840) aliases.push('washington', 'american', 'trump', 'white house')
    if (n === 643) aliases.push('kremlin', 'moscow', 'russian', 'putin')
    if (n === 826) aliases.push('london', 'british', 'uk', 'britain')
    if (n === 276) aliases.push('berlin', 'german')
    const re = new RegExp(aliases.join('|'), 'i')
    return (newsItems?.articles ?? []).filter(item => re.test(item.headline + ' ' + (item.summary ?? ''))).slice(0, 5)
  }, [newsItems, name, n])

  const sec = (title) => (
    <div className="text-2xs text-terminal-text-dim uppercase tracking-widest mb-1 pt-0.5">{title}</div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden panel-fade">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{flag}</span>
          <div>
            <div className="text-xs font-bold text-terminal-gold">{name}</div>
            <div className="text-2xs text-terminal-text-dim">
              {currCode ?? '—'} · {lt ?? (tz ? '...' : 'TZ unknown')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onCurrencyToggle && (
            <button
              onClick={onCurrencyToggle}
              className="text-2xs border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold px-1.5 py-0.5 transition-colors"
              title="Toggle AUD/USD display"
            >{currencyMode === 'AUD' ? 'A$' : 'US$'}</button>
          )}
          <button onClick={onClose} aria-label="Close country panel" className="text-terminal-text-dim hover:text-terminal-text text-sm">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* ── Status badges ── */}
        <div className="px-3 py-2 border-b border-terminal-border/50">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {isPartner && <span title="Australia's top-five export markets and import sources, ABS 2024-25" className="text-2xs px-1.5 py-0.5 bg-terminal-green/10 text-terminal-green border border-terminal-green/30">ABS TOP-FIVE AU PARTNER</span>}
          </div>
          <button
            onClick={() => onAskAI({
              name,
              exchange:    exName,
              sector:      region,
              date:        todayAEST(),
              instruction: `Describe ${name}: its economy, its trade relationship with Australia, ASX-listed companies with operations or sales there, and its currency. Use only the figures given. Describe only: no forecasts and no view on markets or stocks.`,
            })}
            className="text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >ASK AI ◆</button>
        </div>


        {/* ── No-data fallback ── */}
        {!hasData && (
          <div className="px-3 py-4 border-b border-terminal-border/50">
            <div className="text-2xs text-terminal-gold font-bold mb-1">DATA PENDING</div>
            <div className="text-2xs text-terminal-text-dim leading-relaxed">
              Detailed data for this territory is not yet in our database.
            </div>
            <button
              onClick={() => onAskAI({
                name,
                date:        todayAEST(),
                instruction: `Tell me about ${name} — its geography, economy, political system, and strategic significance for Australia.`,
              })}
              className="mt-2 text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
            >ASK MADDENAI ◆</button>
          </div>
        )}

        {/* ── Tab strip — organises the sections below into 4 categories ── */}
        <div className="flex border-b border-terminal-border/50 flex-shrink-0">
          {COUNTRY_PANEL_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setPanelTab(t.id)}
              className={`flex-1 text-2xs font-bold tracking-wider py-1.5 border-b-2 transition-colors ${
                panelTab === t.id
                  ? 'text-terminal-gold border-terminal-gold'
                  : 'text-terminal-text-dim border-transparent hover:text-terminal-text'
              }`}
            >{t.label}</button>
          ))}
        </div>

        {/* ── Geography (ECONOMY tab) ── */}
        <div className={`px-3 py-2 border-b border-terminal-border/50 ${panelTab === 'economy' ? '' : 'hidden'}`}>
          {sec('Geography')}
          <PRow label="Capital"    value={capital} />
          <PRow label="Region"     value={region} />
          <PRow label="Currency"   value={currCode ? `${currCode}${currName ? ` — ${currName}` : ''}` : null} />
          <PRow label="Languages"  value={languages?.length ? languages.join(', ') : null} />
          <PRow label="Government" value={govType} />
        </div>

        {/* ── Local Time & Timezone (MARKETS tab) ── */}
        <div className={`px-3 py-2 border-b border-terminal-border/50 ${panelTab === 'markets' ? '' : 'hidden'}`}>
          {sec('Local Time')}
          <PRow label="Time now" value={lt} cls={lt ? 'text-terminal-text-bright font-mono font-bold' : 'text-terminal-text-dim'} />
          <PRow label="Timezone" value={tz} cls="text-terminal-text-dim" />
          {ex && <PRow label="Exchange" value={exName ?? ex.id} />}
          {ex && <PRow label="Index"    value={exIndex} cls="text-terminal-text-dim" />}
          {ex && <PRow label="Session"  value={exCountdown} cls={exCountdown ? 'text-terminal-gold' : 'text-terminal-text-dim'} />}
        </div>

        {/* ── Market Connection — Maddex-tracked stocks listed on this
            country's exchange, click opens the stock's detail modal ── */}
        {ex?.topStocks?.length > 0 && (
          <div className={`px-3 py-2 border-b border-terminal-border/50 ${panelTab === 'markets' ? '' : 'hidden'}`}>
            {sec('Market Connection')}
            <div className="flex flex-wrap gap-1.5">
              {ex.topStocks.slice(0, 6).map(symbol => (
                <button
                  key={symbol}
                  onClick={() => openModal({ symbol, name: symbol, type: symbol.endsWith('.AX') ? 'asx' : 'us' })}
                  className="text-2xs px-1.5 py-0.5 border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                >{symbol}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Macro Statistics (ECONOMY tab) ── */}
        <div className={`px-3 py-2 border-b border-terminal-border/50 ${panelTab === 'economy' ? '' : 'hidden'}`}>
          <div className="flex items-center justify-between gap-2">
            {sec('Macro Statistics')}
            {stats && <DataBadge cls="DELAYED" source="national statistics agencies, checked" at={COUNTRY_STATS_CHECKED} compact />}
          </div>
          <div className="flex justify-between text-2xs py-0.5">
            <span className="text-terminal-text-dim">GDP Growth</span>
            <div className="text-right">
              {gdpGrowth != null
                ? <span className={`font-bold ${gdpGrowth >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>{gdpGrowth >= 0 ? '+' : ''}{gdpGrowth}%</span>
                : <span className="text-terminal-text-bright">—</span>
              }
              {gdpLbl && <span className="text-terminal-text-dim/60 ml-1" title={stats.gdp.measure}>{gdpLbl} · {stats.gdp.measure}</span>}
              {stats?.gdp?.url && <a href={stats.gdp.url} target="_blank" rel="noopener noreferrer" className="text-terminal-text-dim/60 ml-1 underline" data-stat-source>source</a>}
              {gdpLbl && <OutOfDate label={gdpLbl} kind="gdp" />}
            </div>
          </div>
          <div className="flex justify-between text-2xs py-0.5">
            <span className="text-terminal-text-dim">Inflation (CPI)</span>
            <div className="text-right">
              {inflation != null
                ? <span className={`font-bold ${inflation > 4 ? 'text-terminal-red' : inflation > 2.5 ? 'text-terminal-gold' : 'text-terminal-green'}`}>{inflation}%</span>
                : <span className="text-terminal-text-bright">—</span>
              }
              {inflLbl && <span className="text-terminal-text-dim/60 ml-1" title={stats.cpi.measure}>{inflLbl} · {stats.cpi.measure}</span>}
              {stats?.cpi?.url && <a href={stats.cpi.url} target="_blank" rel="noopener noreferrer" className="text-terminal-text-dim/60 ml-1 underline" data-stat-source>source</a>}
              {inflLbl && <OutOfDate label={inflLbl} kind="cpi" />}
            </div>
          </div>
          <div className="flex justify-between text-2xs py-0.5">
            <span className="text-terminal-text-dim">Interest Rate</span>
            <div className="text-right">
              {intRate != null
                ? <span className="text-terminal-blue-bright font-bold">{intRate}%</span>
                : <span className="text-terminal-text-bright">{intRateNone ? 'No policy rate' : '—'}</span>
              }
              {intRateLbl && <span className="text-terminal-text-dim/60 ml-1">{intRateLbl}</span>}
              {intRateUrl && <a href={intRateUrl} target="_blank" rel="noopener noreferrer" className="text-terminal-text-dim/60 ml-1 underline" data-rate-source>source</a>}
              {intRateLbl && <OutOfDate label={intRateChecked ? `${intRateChecked}, checked` : intRateLbl} kind="rate" />}
              {(intRateNone || intRateNotRead) && <span className="block text-2xs text-terminal-text-dim/60" data-rate-note>{intRateNone ?? intRateNotRead}</span>}
              {intRateBank && !intRateLbl && !intRateNone && !intRateNotRead && <span className="text-terminal-text-dim/60 ml-1">{intRateBank}: rate not held</span>}
            </div>
          </div>
          {!stats && (
            <div className="text-2xs text-terminal-text-dim/70 pt-1" data-stats-note>
              GDP growth and inflation are shown only once read from the national statistics agency. More countries will be added as they are verified.
            </div>
          )}
        </div>

        {/* The Risk Assessment block (political stability, economic outlook,
            sanctions and conflict defaulting to "None", typed credit ratings)
            had no source or date and was removed on 15 Nov 2026. */}

        {/* ── Trade Intelligence (TRADE tab) ── */}
        <div className={`px-3 py-2 border-b border-terminal-border/50 ${panelTab === 'trade' ? '' : 'hidden'}`}>
          {sec(`Trade Intelligence — ${name}`)}

          {/* (a) Trade routes through this region */}
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1 mt-1">Trade Routes Through This Region</div>
          {(shippingRoutes.length + freightRoutes.length) === 0 ? (
            <div className="text-2xs text-terminal-text-dim/60 italic mb-2">No major mapped shipping/air corridors for this territory.</div>
          ) : (
            <div className="mb-2">
              {shippingRoutes.map(r => (
                <div key={r.id} className="flex justify-between text-2xs py-0.5">
                  <span className="text-terminal-text">🚢 {r.name}</span>
                  {r.status && <span className="text-terminal-text-dim" title="Maddex editorial label, undated">{r.status} · Maddex label</span>}
                </div>
              ))}
              {freightRoutes.map(r => (
                <div key={r.id} className="flex justify-between text-2xs py-0.5">
                  <span className="text-terminal-text">✈ {r.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* (b) Enhanced key trade partners */}
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1">Key Trade Partners</div>
          {enhancedPartners.length === 0 ? (
            <div className="text-2xs text-terminal-text-dim/60 italic mb-2">No trade partner data on record.</div>
          ) : (
            <div className="mb-2">
              {enhancedPartners.map(p => (
                <div key={p.name} className="flex items-center justify-between text-2xs py-0.5" data-partner>
                  <span className="text-terminal-text">{p.flag} {p.name}</span>
                  {p.trade && (
                    <span className="text-terminal-text-dim tabular-nums">
                      {COUNTRY_NAMES[n] === 'Australia' ? 'AU exports' : 'from AU'} {p.trade.exportsBn != null ? `A$${p.trade.exportsBn.toFixed(1)}B` : '—'}
                      {' · '}{COUNTRY_NAMES[n] === 'Australia' ? 'imports' : 'to AU'} {p.trade.importsBn != null ? `A$${p.trade.importsBn.toFixed(1)}B` : '—'}
                    </span>
                  )}
                </div>
              ))}
              <div className="text-2xs text-terminal-text-dim/60 mt-0.5" data-partner-source>
                {tradeSource
                  ? `Values: ${tradeSource.source} (${tradeSource.period}); "—" where the partner is outside the ABS top five. Other pairs: no bilateral values held.`
                  : 'No bilateral trade values are held for this country.'}
              </div>
            </div>
          )}

          {/* (c) Active disruptions affecting this country */}
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1">Active Disruptions</div>
          {disruptedRoutes.length === 0 ? (
            <div className="text-2xs text-terminal-text-dim/70 mb-2">No route mapped for {name} carries a Maddex "disrupted" label.</div>
          ) : (
            <div className="mb-2">
              {disruptedRoutes.map(r => (
                <div key={r.id} className="text-2xs text-terminal-red/90 leading-relaxed mb-1">
                  ⚠ {ROUTE_DISRUPTION_TEXT[r.id] ?? `${r.name} is currently ${r.status.toLowerCase()}.`}
                </div>
              ))}
            </div>
          )}

          {/* The 0–100 trade risk score that sat here was a typed base per
              rating plus fixed bumps, with 35 for an unknown rating: removed. */}
        </div>

        {/* ── Overview (ECONOMY tab) ── */}

        {/* ── Recent News (GEOPOLITICAL tab) ── */}
        <div className={`px-3 py-2 ${panelTab === 'geopolitical' ? '' : 'hidden'}`}>
          {sec('Recent News')}
          {relatedNews.length === 0
            ? <div className="text-2xs text-terminal-text-dim/50 italic">No recent news matching {name}</div>
            : relatedNews.map((item, i) => (
              <div key={i} className="mb-2 pb-2 border-b border-terminal-border/30 last:border-0">
                <div className="text-2xs text-terminal-text leading-snug">{item.headline}</div>
                <div className="text-2xs text-terminal-text-dim/60 mt-0.5">{item.source} · {item.time}</div>
                <button
                  onClick={() => onAskAI({
                    name:        item.headline,
                    sector:      'News',
                    date:        todayAEST(),
                    instruction: 'Explain what this headline reports and which parts of the Australian economy and which ASX sectors it connects to. Describe only: no forecasts and no view on markets or stocks.',
                  })}
                  className="mt-0.5 text-2xs text-terminal-gold/60 hover:text-terminal-gold"
                >ASK AI →</button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Maritime & Shipping ─────────────────────────────────────────────────

function MaritimeTab({ newsItems }) {
  const [expanded, setExpanded] = useState(null)
  const [impactChokepoint, setImpactChokepoint] = useState(null)

  const chokeStatuses = useMemo(() => CHOKEPOINTS.map(cp => {
    const related = (newsItems ?? []).filter(n => {
      const text = (n.headline + ' ' + (n.summary ?? '')).toLowerCase()
      return cp.keywords.some(kw => text.includes(kw.toLowerCase()))
    }).slice(0, 2)
    return { ...cp, baseline: cp.status, related, updatedAgo: timeAgo(related[0]?.pubDate) }
  }), [newsItems])

  const disrupted  = chokeStatuses.filter(c => c.status === 'DISRUPTED').length
  const monitored  = chokeStatuses.filter(c => c.status === 'MONITORED').length
  const open       = chokeStatuses.filter(c => c.status === 'OPEN').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        MARITIME & SHIPPING
        <div className="ml-auto flex flex-col items-end gap-0.5 font-normal normal-case text-2xs leading-none">
          <span className="text-terminal-red">● DISRUPTED</span>
          <span className="text-terminal-gold">● MONITORED</span>
          <span className="text-terminal-green">● OPEN</span>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 border-b border-terminal-border flex-shrink-0 text-center">
        <div className="py-1.5 border-r border-terminal-border">
          <div className={`text-xs font-bold ${disrupted > 0 ? 'text-terminal-red' : 'text-terminal-text-dim'}`}>{disrupted}</div>
          <div className="text-2xs text-terminal-text-dim">Disrupted</div>
        </div>
        <div className="py-1.5 border-r border-terminal-border">
          <div className={`text-xs font-bold ${monitored > 0 ? 'text-terminal-gold' : 'text-terminal-text-dim'}`}>{monitored}</div>
          <div className="text-2xs text-terminal-text-dim">Monitored</div>
        </div>
        <div className="py-1.5">
          <div className="text-xs font-bold text-terminal-green">{open}</div>
          <div className="text-2xs text-terminal-text-dim">Clear</div>
        </div>
      </div>

      {disrupted > 0 && (
        <div className="px-3 py-1.5 bg-terminal-red/10 border-b border-terminal-red/30 flex-shrink-0 text-2xs text-terminal-red font-bold">
          ⚠ ACTIVE DISRUPTION — {chokeStatuses.filter(c => c.status === 'DISRUPTED').map(c => c.name).join(', ')}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {chokeStatuses.map(cp => (
          <div key={cp.name} className={`border-b border-terminal-border/50 transition-colors hover:bg-terminal-accent/10 gold-hover`}>
            <button
              className="w-full flex items-start gap-2 px-3 py-2 text-left"
              onClick={() => setExpanded(expanded === cp.name ? null : cp.name)}
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${CHOKE_DOT[cp.status]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-2xs font-bold text-terminal-text-bright truncate">{cp.name}</span>
                  <span className={`text-2xs font-bold flex-shrink-0 ${CHOKE_COLOR[cp.status]}`}>{cp.status}</span>
                </div>
                <div className="text-2xs text-terminal-text-dim mt-0.5 leading-snug">{cp.note}</div>
                {cp.sources?.length > 0 && (
                  <div className="text-2xs text-terminal-text-dim/60 mt-0.5" data-chokepoint-sources>
                    {cp.sources.map((src, i) => (
                      <span key={src.url}>{i > 0 && ' · '}<a href={src.url} target="_blank" rel="noopener noreferrer" className="underline">{src.publisher}</a>, {formatDate(src.date)}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xs text-terminal-text-dim">{cp.commodity}</span>
                  {cp.updatedAgo && (
                    <span className="text-2xs text-terminal-text-dim/60 ml-auto">UPDATED {cp.updatedAgo.toUpperCase()}</span>
                  )}
                </div>
              </div>
              <span className="text-terminal-text-dim text-2xs flex-shrink-0">{expanded === cp.name ? '▲' : '▼'}</span>
            </button>

            {expanded === cp.name && (
              <div className="px-4 pb-2 space-y-1.5">
                <div className="text-2xs text-terminal-text-dim" data-route-status-source>
                  {`Status: ${ROUTE_STATUS_SOURCE}, reviewed ${formatDate(cp.asOf)}`}
                </div>
                {cp.history && (
                  <div className="text-2xs text-terminal-text-dim/80 border-l-2 border-terminal-border/60 pl-2">
                    {cp.history}
                  </div>
                )}
                {cp.asxStocks && (
                  <div>
                    <div className="text-2xs text-terminal-text-dim uppercase mb-0.5">ASX Exposure</div>
                    <div className="flex flex-wrap gap-1">
                      {cp.asxStocks.map(s => (
                        <span key={s} className="text-2xs px-1.5 py-0.5 border border-terminal-gold/30 text-terminal-gold">
                          {s.replace('.AX','')}
                        </span>
                      ))}
                    </div>
                    <div className="text-2xs text-terminal-text-dim/60 mt-0.5">{cp.asxNote}</div>
                  </div>
                )}
                {cp.related.length > 0 && (
                  <div className="space-y-1 mt-1">
                    <div className="text-2xs text-terminal-text-dim uppercase">Live news</div>
                    {cp.related.map((n, i) => (
                      <div key={i} className="text-2xs text-terminal-text leading-snug border-l-2 border-terminal-gold/40 pl-2">
                        {n.headline}
                        <span className="text-terminal-text-dim/60 ml-1">— {n.source}</span>
                      </div>
                    ))}
                  </div>
                )}
                {cp.related.length === 0 && (
                  <div className="text-2xs text-terminal-text-dim/50 italic">No matching news in current feed</div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setImpactChokepoint(cp)}
                    className="text-2xs border border-terminal-gold text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold"
                  >📊 VIEW PORTFOLIO IMPACT</button>
                  <button
                    onClick={() => dispatchAskAI({
                      name:        cp.name,
                      sector:      cp.commodity,
                      date:        todayAEST(),
                      instruction: `Describe the ${cp.name} shipping route and why it matters to Australian trade. Recorded status: ${cp.baseline} (${ROUTE_STATUS_SOURCE}, ${formatDate(cp.asOf)}). ${cp.note}. Companies Maddex links to the route: ${cp.asxStocks?.map(s => s.replace('.AX', '')).join(', ')}. Describe only; do not forecast prices or freight costs, and do not suggest any action.`,
                    })}
                    className="text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                  >ASK AI</button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="px-3 py-2 border-b border-terminal-border/50">
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1.5">Selected Cargo Ports</div>
          {MAJOR_PORTS.slice(0, 5).map(p => (
            <div key={p.name} className="flex items-center justify-between text-2xs py-0.5">
              <span className="text-terminal-text">▪ {p.name}</span>
            </div>
          ))}
        </div>

        <div className="px-3 py-1 text-2xs text-terminal-text-dim/50">
          Status: {ROUTE_STATUS_SOURCE}, reviewed {formatDate(CHOKEPOINT_ENTRIES[0])}{CHOKEPOINT_ENTRIES[0] !== CHOKEPOINT_ENTRIES.at(-1) ? ` to ${formatDate(CHOKEPOINT_ENTRIES.at(-1))}` : ''}; each route lists its sources. Headlines that mention a route are shown as related news and do not change its status
        </div>
      </div>

      {impactChokepoint && (
        <GeopoliticalImpact chokepoint={impactChokepoint} onClose={() => setImpactChokepoint(null)} />
      )}
    </div>
  )
}

// ─── Tab: Air Trade Routes ────────────────────────────────────────────────────

// The route volumes (1.2M T/yr), airport tonnages, "Top 5" rankings and
// trend arrows that stood here were typed without a source (Dubai was ranked
// first by cargo tonnage, which ACI's published rankings do not show), and the
// tab header dated them June 2026 with ACI and IATA as sources. Removed until
// a sourced copy is held; the tab now lists the commodity mix only.
const AU_FREIGHT_COMMODITIES = [
  { name:'Electronics',     dir:'IN',  note:'Mobile devices, components from Asia' },
  { name:'Pharmaceuticals', dir:'BOTH',note:'Clinical trials, vaccine cold chain' },
  { name:'Perishables',     dir:'OUT', note:'Beef, seafood, fresh produce to Asia' },
  { name:'Mail & Express',  dir:'BOTH',note:'Parcels and express documents' },
  { name:'Automotive',      dir:'IN',  note:'Parts, luxury vehicles from EU/Japan' },
]

// A source switched off for licence reasons (data/sourceLicence) says so,
// rather than its panel vanishing without a word.
function SwitchedOff({ what, why }) {
  return (
    <div className="text-2xs text-terminal-text-dim/70" data-switched-off>
      {what}: switched off. {why}, so it is not shown until a licence is in place.
    </div>
  )
}

function LiveAirTraffic({ flightData }) {
  if (licenceOff('opensky')) return <div className="p-2 border-b border-terminal-border"><SwitchedOff what="Live air traffic" why="OpenSky's terms need a written licence for commercial use" /></div>
  if (!flightData?.total) return null
  return (
    <div className="p-2 border-b border-terminal-border">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-terminal-green flex-shrink-0" />
        <span className="text-terminal-text-dim uppercase tracking-wider">Live Air Traffic (OpenSky)</span>
      </div>
      <div className="flex items-center gap-3 mb-1.5">
        <div><span className="text-terminal-gold font-bold">{flightData.airborne.toLocaleString()}</span> <span className="text-terminal-text-dim">airborne now</span></div>
        <div><span className="text-terminal-text-bright font-bold">{flightData.total.toLocaleString()}</span> <span className="text-terminal-text-dim">tracked</span></div>
      </div>
      <div className="text-terminal-text-dim/70 mb-1">Top 5 busiest regions</div>
      {flightData.byCountry.slice(0, 5).map(c => (
        <div key={c.country} className="flex items-center justify-between py-0.5 border-b border-terminal-border/20 last:border-0">
          <span className="text-terminal-text truncate mr-2">{c.country}</span>
          <span className="text-terminal-gold font-semibold flex-shrink-0">{c.count}</span>
        </div>
      ))}
    </div>
  )
}

function AirTradeRoutesTab({ flightData }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        AIR TRADE ROUTES
        <span className="ml-auto text-2xs text-terminal-text-dim font-normal normal-case" data-air-note>Descriptive · no volumes held</span>
      </div>

      <div className="flex-1 overflow-auto text-2xs">
        <LiveAirTraffic flightData={flightData} />

        {/* Key AU air freight commodities */}
        <div className="p-2 border-b border-terminal-border">
          <div className="text-terminal-text-dim uppercase mb-1.5 tracking-wider">AU Air Freight Commodities</div>
          <div className="text-terminal-text-dim/60 mb-1">▲ mostly exported · ▼ mostly imported · ◆ both ways</div>
          {AU_FREIGHT_COMMODITIES.map(c => (
            <div key={c.name} className="flex items-start gap-2 py-0.5">
              <span className={`flex-shrink-0 font-bold ${c.dir === 'IN' ? 'text-terminal-blue-bright' : c.dir === 'OUT' ? 'text-terminal-gold' : 'text-terminal-green'}`}>
                {c.dir === 'IN' ? '▼' : c.dir === 'OUT' ? '▲' : '◆'}
              </span>
              <div>
                <span className="text-terminal-text">{c.name}</span>
                <span className="text-terminal-text-dim/60 ml-2">{c.note}</span>
              </div>
            </div>
          ))}
        </div>

        {/* The "Air Freight Cost Index" (127.4, Jun 2026) was typed and
            labelled "hardcoded" on screen: removed until a licensed feed. */}
      </div>
    </div>
  )
}

// ─── Tab: Commodity Flows ─────────────────────────────────────────────────────

function CommodityFlowsTab({ onAskAI }) {
  const [selected, setSelected] = useState(null)

  // Rows held in verifiedConstants take its value, date and source, so Brent
  // here matches the map and the Markets panels. No dated daily change is held
  // for them, so their change shows as "—". The other rows are the May 2026
  // reference table as entered.
  const held = (key) => {
    const c = VERIFIED_CONSTANTS.commodities
    return { price: c[key], chg: null, src: `${c.sourceBy?.[key] ?? c.source}, ${formatDate(c.asOfBy?.[key] ?? c.asOf)} · hand-entered` }
  }
  // Only rows whose price is held in verifiedConstants with its own date and
  // source. Rows typed here from May 2026 quotes (coking coal, IOCJ, CBOT
  // soybeans and wheat, TTF, US Gulf LNG) with a day's change, a volume and a
  // hand-set "disruption risk" were removed on 7 Nov: none had a dated source
  // held, and the volumes were wrong (iron ore to China is several times the
  // 160Mt/yr shown).
  const COMMODITY_TABLE = [
    { name:'Iron Ore (62% Fe)',   route:'AU → China',        unit:'USD/t',     ...held('ironOreUSD') },
    { name:'LNG Spot (JKM)',      route:'AU → Japan/Korea',  unit:'USD/MMBtu', ...held('lngUSDPerMMBtu') },
    { name:'Thermal Coal (Newcastle)', route:'AU → India/Japan',  unit:'USD/t',     ...held('thermalCoalUSD') },
    { name:'Crude Oil (Brent)',   route:'Middle East → Asia', unit:'USD/bbl',  ...held('brentUSD') },
  ].filter((c) => typeof c.price === 'number')

  const trade = VERIFIED_CONSTANTS.auTrade

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        COMMODITY FLOWS
        <span className="ml-auto text-2xs font-normal normal-case text-terminal-text-dim">Dates per row</span>
      </div>

      {/* Australia's total exports, from the ABS release the trade panel uses. */}
      <div data-commodity-summary className="px-3 py-1.5 border-b border-terminal-border flex-shrink-0 text-2xs text-terminal-text-dim">
        AU exports, goods and services, {trade.period}:{' '}
        <span className="font-bold text-terminal-gold tabular-nums">A${trade.totalExportsBn.toFixed(1)}b</span>
        {' '}· ABS · prices below are hand-entered, not live
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-3 py-1 border-b border-terminal-border">
          <div className="text-2xs text-terminal-text-dim/70">Enable COMMODITIES layer on globe to see animated flow lines</div>
        </div>

        {COMMODITY_TABLE.map((c, i) => (
          <div key={i}
            className={`border-b border-terminal-border/50 cursor-pointer transition-colors hover:bg-terminal-accent/10 gold-hover ${selected === i ? 'bg-terminal-accent/20 border-terminal-gold/30' : ''}`}
            onClick={() => setSelected(selected === i ? null : i)}
          >
            <div className="flex items-center justify-between px-3 py-1.5 gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-2xs font-bold text-terminal-text-bright truncate">{c.name}</div>
                <div className="text-2xs text-terminal-text-dim">{c.route}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xs font-semibold text-terminal-text-bright">
                  {c.unit.startsWith('EUR') ? '€' : 'US$'}{c.price.toFixed(2)}
                  <span className="text-terminal-text-dim/60 text-2xs ml-0.5">{c.unit.split('/')[1]}</span>
                </div>
                {c.chg == null
                  ? <div className="text-2xs text-terminal-text-dim" title="No dated change held for this row">—</div>
                  : <div className={`text-2xs font-semibold ${c.chg > 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                      {c.chg > 0 ? '+' : ''}{c.chg.toFixed(1)}%
                    </div>}
              </div>
            </div>

            {selected === i && (
              <div className="px-3 pb-2 space-y-1">
                <div className="text-2xs text-terminal-text-dim/60">{c.src}</div>
                <button
                  onClick={e => { e.stopPropagation(); onAskAI({
                    name:        c.name,
                    sector:      'Commodities',
                    price:       `${c.unit.startsWith('EUR') ? '€' : 'US$'}${c.price.toFixed(2)}${c.unit.split('/')[1] ? ` /${c.unit.split('/')[1]}` : ''}`,
                    change:      c.chg == null ? undefined : `${c.chg > 0 ? '+' : ''}${c.chg.toFixed(1)}%`,
                    date:        todayAEST(),
                    instruction: `Describe the ${c.route} trade route for ${c.name}: what moves along it and what events have affected it. Use only the figures given; do not add prices, volumes, forecasts or views on markets or stocks.`,
                  }) }}
                  className="mt-1 text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                >ASK AI</button>
              </div>
            )}
          </div>
        ))}

        <div className="px-3 py-1 text-2xs text-terminal-text-dim/50 border-t border-terminal-border">
          Each price names its source and date · Volumes: Dept Resources 2025-26
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Geopolitical Risk ───────────────────────────────────────────────────

function GeoRiskTab({ newsItems, isLoading, onAskAI, updatedAt }) {
  const [filter, setFilter] = useState('ALL')

  const geoItems = useMemo(() => {
    const items = (newsItems ?? [])
      .filter(n => GEO_RISK_RE.test(n.headline + ' ' + (n.summary ?? '')))
      .map(n => {
        const text = n.headline + ' ' + (n.summary ?? '')
        const severity = detectSeverity(text)
        const impact   = detectImpact(text)
        let region = 'GLOBAL'
        for (const [r, re] of Object.entries(COUNTRY_KEYWORDS)) {
          if (re.test(text)) { region = r; break }
        }
        return { ...n, severity, impact, region }
      })
      .sort((a, b) => {
        const sev = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3 }
        return sev[a.severity] - sev[b.severity] || b.pubDate - a.pubDate
      })

    if (filter === 'ALL') return items.slice(0, 20)
    return items.filter(n => n.severity === filter || n.impact === filter || n.region === filter).slice(0, 20)
  }, [newsItems, filter])

  const filters = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'COMMODITIES', 'FX', 'SUPPLY CHAIN']

  if (isLoading) return <ModuleLoader name="GEO RISK" />

  const critCount = geoItems.filter(n => n.severity === 'CRITICAL').length
  const highCount = geoItems.filter(n => n.severity === 'HIGH').length
  const medCount  = geoItems.filter(n => n.severity === 'MEDIUM').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header flex-shrink-0">GEOPOLITICAL RISK FEED</div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 border-b border-terminal-border flex-shrink-0 text-center">
        <div className="py-1.5 border-r border-terminal-border">
          <div className="text-xs font-bold text-terminal-gold">{geoItems.length}</div>
          <div className="text-2xs text-terminal-text-dim">Events</div>
        </div>
        <div className="py-1.5 border-r border-terminal-border">
          <div className={`text-xs font-bold ${critCount > 0 ? 'text-terminal-red' : 'text-terminal-text-dim'}`}>{critCount}</div>
          <div className="text-2xs text-terminal-text-dim">Critical</div>
        </div>
        <div className="py-1.5 border-r border-terminal-border">
          <div className={`text-xs font-bold ${highCount > 0 ? 'text-orange-400' : 'text-terminal-text-dim'}`}>{highCount}</div>
          <div className="text-2xs text-terminal-text-dim">High</div>
        </div>
        <div className="py-1.5">
          <div className={`text-xs font-bold ${medCount > 0 ? 'text-terminal-gold' : 'text-terminal-text-dim'}`}>{medCount}</div>
          <div className="text-2xs text-terminal-text-dim">Medium</div>
        </div>
        <div className="col-span-4 px-2 py-1 border-t border-terminal-border/50 text-2xs text-terminal-text-dim/70 text-left" data-tag-note>{TAG_NOTE}</div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-terminal-border flex-shrink-0 overflow-x-auto">
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-2xs px-1.5 py-0.5 border whitespace-nowrap transition-colors ${
              filter === f
                ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10'
                : 'border-terminal-border text-terminal-text-dim hover:border-terminal-text'
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {geoItems.length === 0 && (
          <div className="flex items-center justify-center h-32 text-2xs text-terminal-text-dim/60">
            No matching geopolitical events in current feed
          </div>
        )}
        {geoItems.map((n, i) => (
          <div key={n.id ?? i}
            className={`px-2 py-2 border-b border-l-2 cursor-pointer hover:bg-terminal-accent/10 ${SEVERITY_BG[n.severity]} ${
              n.severity === 'CRITICAL' ? 'border-l-terminal-red' :
              n.severity === 'HIGH'     ? 'border-l-orange-500' :
              n.severity === 'MEDIUM'   ? 'border-l-terminal-gold' :
              'border-l-terminal-border'
            }`}
            onClick={() => n.link && window.open(n.link, '_blank', 'noopener')}
          >
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className={`text-2xs font-bold ${SEVERITY_COLOR[n.severity]}`} title={TAG_NOTE}>[{n.severity}]</span>
              <span className={`text-2xs font-semibold ${IMPACT_COLOR[n.impact]}`}>{n.impact}</span>
              <span className="text-2xs text-terminal-text-dim">· {n.region}</span>
              <span className="text-2xs text-terminal-text-dim ml-auto">{n.source} · {n.time}</span>
            </div>
            <div className="text-2xs text-terminal-text-bright leading-snug">{n.headline}</div>
            {n.summary && (
              <div className="text-2xs text-terminal-text-dim/70 mt-0.5 leading-snug line-clamp-2">{n.summary}</div>
            )}
            <button
              onClick={e => { e.stopPropagation(); onAskAI({
                name:        n.headline,
                sector:      n.region,
                date:        todayAEST(),
                instruction: 'Explain what this headline reports and which parts of the Australian economy and which ASX sectors it connects to. Describe only: no forecasts and no view on markets or stocks.',
              }) }}
              className="mt-1 text-2xs text-terminal-gold/60 hover:text-terminal-gold border border-terminal-gold/20 hover:border-terminal-gold/60 px-1.5 py-0.5 transition-colors"
            >ASK AI →</button>
          </div>
        ))}
      </div>
      <div className="px-3 py-1 text-2xs text-terminal-text-dim/50 border-t border-terminal-border flex-shrink-0 flex items-center justify-between">
        <span>Sources: Reuters World · BBC World · Reuters Top News (RSS2JSON)</span>
        {updatedAt > 0 && <span>FEED UPDATED {timeAgo(new Date(updatedAt))?.toUpperCase()}</span>}
      </div>
    </div>
  )
}

// ─── Tab: Market Sessions ─────────────────────────────────────────────────────

function MarketSessionsTab() {
  // Sydney time with its zone, from the shared ticker — the same second as
  // every other clock on screen.
  const now = sydneyClock(new Date(useNow()), { seconds: true }).text
  // `now` is NOT unnecessary, whatever eslint says. getStatus, localTime and
  // countdown all read the clock internally, so none of them appears in this
  // dependency array — the linter sees a memo over constants and concludes the
  // ticking value is surplus. Remove it and every countdown in this tab freezes
  // at the value it held on mount.
  const statuses = useMemo(() => EXCHANGES.map(ex => ({
    ...ex,
    status:    getStatus(ex),
    localT:    localTime(ex.tz),
    cd:        countdown(ex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [now])

  const openCount = statuses.filter(s => isOpenNow(s.status)).length

  // Determine active sessions
  // Same as `statuses` above: this body calls new Date() directly, so `now` is
  // the only thing that can tell React the result has expired.
  const activeSessions = useMemo(() => SESSIONS.map(s => {
    const local = new Date(new Date().toLocaleString('en-US', { timeZone: s.tz }))
    const day   = local.getDay()
    const mins  = local.getHours() * 60 + local.getMinutes()
    const open  = s.open[0] * 60 + s.open[1]
    const close = s.close[0] * 60 + s.close[1]
    const isOpen = day !== 0 && day !== 6 && mins >= open && mins < close
    return { ...s, isOpen, localT: localTime(s.tz) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [now])

  const REGION_ORDER = ['APAC', 'EUROPE', 'AMERICAS', 'MIDDLE EAST', 'AFRICA']
  const byRegion = {}
  for (const ex of statuses) {
    if (!byRegion[ex.region]) byRegion[ex.region] = []
    byRegion[ex.region].push(ex)
  }

  const dominantSession = activeSessions.find(s => s.isOpen)?.name ?? 'OFF-HOURS'
  const nextOpen = statuses.find(s => s.status === 'OPENING_SOON')
  const liquidity = openCount >= 3 ? 'HIGH' : openCount >= 1 ? 'MODERATE' : 'LOW'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        MARKET SESSIONS
        <span className="text-terminal-green text-2xs font-normal">{openCount} OPEN</span>
        <span className="ml-auto text-terminal-text-dim text-2xs font-normal normal-case">{now}</span>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 border-b border-terminal-border flex-shrink-0 text-center">
        <div className="py-1.5 border-r border-terminal-border">
          <div className="text-xs font-bold text-terminal-gold">{dominantSession}</div>
          <div className="text-2xs text-terminal-text-dim">Dominant session</div>
        </div>
        <div className="py-1.5 border-r border-terminal-border">
          <div className={`text-xs font-bold ${liquidity === 'HIGH' ? 'text-terminal-green' : liquidity === 'MODERATE' ? 'text-terminal-gold' : 'text-terminal-text-dim'}`}>{liquidity}</div>
          <div className="text-2xs text-terminal-text-dim">Liquidity</div>
        </div>
        <div className="py-1.5">
          <div className="text-xs font-bold text-terminal-text-bright">{nextOpen?.id ?? '—'}</div>
          <div className="text-2xs text-terminal-text-dim">Opens next</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">

        {/* Active sessions */}
        <div className="grid grid-cols-3 border-b border-terminal-border">
          {activeSessions.map(s => (
            <div key={s.name} className={`p-2 border-r border-terminal-border last:border-0 text-center ${s.isOpen ? '' : 'opacity-40'}`}>
              <div className={`w-1.5 h-1.5 rounded-full mx-auto mb-1 ${s.isOpen ? 'bg-terminal-green animate-pulse' : 'bg-terminal-border'}`} />
              <div className={`text-2xs font-bold ${s.isOpen ? 'text-terminal-gold' : 'text-terminal-text-dim'}`}>{s.name}</div>
              <div className="text-2xs text-terminal-text-dim">{s.localT}</div>
            </div>
          ))}
        </div>

        {/* All exchanges by region */}
        {REGION_ORDER.filter(r => byRegion[r]).map(region => (
          <div key={region}>
            <div className="px-3 py-1 bg-terminal-header text-2xs text-terminal-text-dim font-bold uppercase tracking-wide">
              {region}
            </div>
            {byRegion[region].map(ex => (
              <div key={ex.id}
                className={`flex items-center justify-between px-3 py-1.5 border-b border-terminal-border/50 hover:bg-terminal-accent/20 ${
                  ex.id === 'ASX' ? 'border-l-2 border-l-terminal-gold' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT_CLS[ex.status] ?? 'bg-terminal-border'}`} />
                  <div>
                    <div className={`text-xs font-bold leading-tight ${ex.id === 'ASX' ? 'text-terminal-gold' : 'text-terminal-text-bright'}`}>
                      {ex.id}
                    </div>
                    <div className="text-2xs text-terminal-text-dim leading-tight">{ex.city}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xs font-semibold ${STATUS_CLS[ex.status] ?? 'text-terminal-text-dim'}`}>
                    {STATUS_LABEL[ex.status] ?? ex.status}
                  </div>
                  <div className="text-2xs text-terminal-text-dim">{ex.localT} · {ex.currency}</div>
                  {ex.cd && <div className="text-2xs text-terminal-text-dim/60">{ex.cd}</div>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Exchange Detail Panel ────────────────────────────────────────────────────

// Open-Meteo current conditions for a financial centre's lat/lon — no key
// required, fetched once per exchange selection and cached for 30min.
function WeatherWidget({ lat, lon, city }) {
  const off = licenceOff('openmeteo')
  const { data, isLoading } = useQuery({
    queryKey: ['weather', lat, lon],
    queryFn:  () => fetchCurrentWeather(lat, lon),
    staleTime: 30 * 60_000,
    retry: 1,
    enabled: !off && lat != null && lon != null,
  })
  if (off) return <SwitchedOff what="Weather" why="Open-Meteo's free API is for non-commercial use only" />
  if (isLoading) return <div className="text-2xs text-terminal-text-dim/50">Loading weather…</div>
  if (!data) return null
  return (
    <div className="flex items-center gap-2 text-2xs">
      <span className="text-terminal-text-bright font-bold">{Math.round(data.temperature)}°C</span>
      <span className="text-terminal-text-dim">{weatherCodeLabel(data.weathercode)}</span>
      <span className="text-terminal-text-dim/50 ml-auto">{city}</span>
    </div>
  )
}

function ExchangePanel({ exchangeId, newsItems, onClose, onAskAI }) {
  const { setActiveModule } = useStore()
  const ex = EXCHANGES.find(e => e.id === exchangeId)

  // Above the early return below: a hook that only sometimes runs changes
  // the hook order between renders, which is the desync React's rule exists
  // to prevent.
  const relatedNews = useMemo(() => {
    if (!ex || !newsItems?.articles?.length) return []
    const re = new RegExp(ex.city + '|' + ex.country + '|' + ex.id, 'i')
    return newsItems.articles.filter(n => re.test(n.headline + ' ' + (n.summary ?? ''))).slice(0, 4)
  }, [newsItems, ex])

  if (!ex) return null

  const st = getStatus(ex)
  const lt = localTime(ex.tz)
  const cd = countdown(ex)

  // Session hours in the exchange's own local time
  const openHHMM  = `${String(ex.open[0]).padStart(2,'0')}:${String(ex.open[1]).padStart(2,'0')}`
  const closeHHMM = `${String(ex.close[0]).padStart(2,'0')}:${String(ex.close[1]).padStart(2,'0')}`

  return (
    <div className="flex flex-col h-full overflow-hidden panel-fade">
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT_CLS[st] ?? 'bg-terminal-border'}`} />
          <div>
            <div className="text-xs font-bold text-terminal-gold">{ex.id}</div>
            <div className="text-2xs text-terminal-text-dim">{ex.city} · {ex.country}</div>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close exchange panel" className="text-terminal-text-dim hover:text-terminal-text text-sm">✕</button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Status + AI */}
        <div className="px-3 py-2 border-b border-terminal-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-bold ${STATUS_CLS[st] ?? 'text-terminal-text-dim'}`}>{STATUS_LABEL[st] ?? st}</span>
            <button
              onClick={() => onAskAI({
                name:        ex.name,
                ticker:      ex.id,
                date:        todayAEST(),
                instruction: `Describe the ${ex.name} (${ex.id}): its trading session, main index (${ex.index}), currency (${ex.currency}) and best-known listed companies (${(ex.topStocks ?? []).slice(0,3).join(', ')}). Use only the figures given. Describe only: no forecasts and no view on markets or stocks.`,
              })}
              className="text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
            >ASK AI</button>
          </div>
          {cd && <div className="text-2xs text-terminal-gold">{cd}</div>}
          <div className="text-2xs text-terminal-text-dim mt-0.5">{lt} local · {ex.currency}</div>
          <div className="mt-1.5 pt-1.5 border-t border-terminal-border/40">
            <WeatherWidget lat={ex.lat} lon={ex.lon} city={ex.city} />
          </div>
          <button
            onClick={() => setActiveModule('markets')}
            className="mt-2 w-full text-2xs font-bold tracking-wide bg-terminal-gold text-terminal-bg py-1.5 hover:bg-terminal-gold-bright transition-colors"
          >VIEW IN MARKETS →</button>
        </div>

        {/* Exchange info */}
        <div className="px-3 py-2 border-b border-terminal-border/50 space-y-1">
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1.5">Exchange Details</div>
          {[
            ['Full Name', ex.name],
            ['Index', ex.index ?? '—'],
            ['Trading Hours', `${openHHMM} – ${closeHHMM} local`],
            ['Currency', ex.currency],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between text-2xs gap-2">
              <span className="text-terminal-text-dim flex-shrink-0">{label}</span>
              <span className="text-terminal-text-bright text-right">{value}</span>
            </div>
          ))}
        </div>

        {/* Top stocks */}
        {ex.topStocks?.length > 0 && (
          <div className="px-3 py-2 border-b border-terminal-border/50">
            <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1.5">Key Listed Stocks</div>
            <div className="flex flex-wrap gap-1">
              {ex.topStocks.map(s => (
                <span key={s} className="text-2xs px-1.5 py-0.5 border border-terminal-gold/30 text-terminal-gold">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Related news */}
        <div className="px-3 py-2">
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1.5">Related News</div>
          {relatedNews.length === 0 ? (
            <div className="text-2xs text-terminal-text-dim/50 italic">No recent news matching {ex.id}</div>
          ) : relatedNews.map((item, i) => (
            <div key={i} className="mb-2 pb-2 border-b border-terminal-border/30 last:border-0">
              <div className="text-2xs text-terminal-text leading-snug">{item.headline}</div>
              <div className="text-2xs text-terminal-text-dim/60 mt-0.5">{item.source}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── LEFT: Live Intelligence Feed ──────────────────────────────────────────

// The Freightos Baltic Index, from Freightos's own page (verifiedConstants
// freight): the latest weekly reading, its change on the week before, and
// the last four weekly readings as the sparkline. The Baltic Dry row and the
// typed seven-point "illustrative" trends were removed on 15 Nov 2026.
const FREIGHT = VERIFIED_CONSTANTS.freight
const FBX_WEEKS = FREIGHT.freightosWeekly
const SHIPPING_INDEX = [
  {
    name: 'FREIGHTOS (FBX) · US$/40FT', vkey: 'freight',
    value: FREIGHT.freightosFBX,
    chg: FBX_WEEKS.length > 1 ? Math.round((FBX_WEEKS.at(-1).value / FBX_WEEKS.at(-2).value - 1) * 1000) / 10 : null,
    chgLabel: FBX_WEEKS.length > 1 ? `vs ${formatDate(FBX_WEEKS.at(-2).date, { year: false })}` : null,
    trend: FBX_WEEKS.map((w) => w.value),
  },
]

function Sparkline({ points, positive }) {
  const w = 56, h = 16
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (points.length - 1)) * w} ${h - ((p - min) / range) * h}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <path d={path} fill="none" stroke={positive ? 'var(--color-gain, #3FB06B)' : 'var(--color-loss, #EB6B66)'} strokeWidth={1.25} />
    </svg>
  )
}

// Gold comes from liveDataService, which proxies spot via PAXG — an ERC-20
// token redeemable for one LBMA-vaulted ounce. It tracks spot closely and is
// genuinely live, but it is a proxy, so it is labelled as one rather than
// presented as a spot feed.
function useGoldPrice() {
  const [gold, setGold] = useState(null)
  const [source, setSource] = useState('failed')
  const [fetchedAt, setFetchedAt] = useState(null)
  const [ageMins, setAgeMins] = useState(null)

  useEffect(() => {
    let alive = true
    liveDataService.getGoldPrice().then(({ data, source: src, at }) => {
      if (!alive || !data) return
      setGold(data)
      setSource(src)
      setFetchedAt(at ?? Date.now())
    }).catch(() => { /* row simply does not render */ })
    return () => { alive = false }
  }, [])

  // Age is recomputed on a timer rather than read from the clock during
  // render: "4m ago" has to become "5m ago" on its own, and reading Date.now()
  // in a render body makes the output depend on when React happens to paint.
  useEffect(() => {
    if (fetchedAt == null) return
    const update = () => setAgeMins(Math.round((Date.now() - fetchedAt) / 60000))
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [fetchedAt])

  return { gold, source, ageMins }
}

const FX_CROSS_PAIRS = [
  { key: 'USD', label: 'AUD/USD', dp: 4 },
  { key: 'EUR', label: 'AUD/EUR', dp: 4 },
  { key: 'GBP', label: 'AUD/GBP', dp: 4 },
  { key: 'JPY', label: 'AUD/JPY', dp: 2 },
  { key: 'CNY', label: 'AUD/CNY', dp: 3 },
]

// Geo risk scores come from data/geopoliticalRisk.js — a documented rubric
// with a review date — not from counting headlines.
//
// regionRiskScore() used to live here: it matched news items by region name,
// weighted them by detectSeverity and summed the top five. Volume is not risk.
// It reported China 100, Middle East 100, Russia 100 and the United States 88,
// which says that all four are equally and maximally dangerous, and that the
// US is nearly as risky as an active war. What it actually measured was how
// often a place name appears in severe-sounding coverage.

// ─── Left panel building blocks ─────────────────────────────────────────────

// Section wrapper. Every section in this panel collapses, and which ones are
// collapsed persists — the panel is 300px against a full-height map, so what
// a given person wants visible varies more than any default can capture.
function CollapsibleSection({ id, title, badge, defaultOpen = true, hidden = false, children }) {
  const [open, setOpen] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('maddex_intel_sections') ?? '{}')
      return saved[id] ?? defaultOpen
    } catch { return defaultOpen }
  })

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      try {
        const saved = JSON.parse(localStorage.getItem('maddex_intel_sections') ?? '{}')
        localStorage.setItem('maddex_intel_sections', JSON.stringify({ ...saved, [id]: next }))
      } catch { /* best-effort */ }
      return next
    })
  }

  if (hidden) return null
  return (
    <div className="flex-shrink-0 border-b border-terminal-border">
      {/* Scoped to this panel rather than reusing .panel-header, which every
          other module also renders — restyling it here would silently change
          fourteen modules to suit one. */}
      <button
        onClick={toggle}
        aria-expanded={open}
        className="intel-section-header w-full flex items-center justify-between"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className="flex-shrink-0 transition-transform duration-200"
            style={{ fontSize: 11, color: PAL.muted, transform: open ? 'none' : 'rotate(-90deg)' }}
          >▾</span>
          <span className="intel-section-title truncate">{title}</span>
        </span>
        {badge && <span className="flex-shrink-0">{badge}</span>}
      </button>
      {open && <div className="intel-section-body">{children}</div>}
    </div>
  )
}

// Which of the user's watched stocks are exposed to what is happening on the
// map. Keyword-matched against the same disruption and geopolitical rows the
// map draws, so the panel and the map are describing one world.
const EXPOSURE_MAP = {
  BHP: ['China demand', 'Iron ore'],
  RIO: ['China demand', 'Iron ore'],
  FMG: ['China demand', 'Iron ore'],
  S32: ['China demand', 'Commodities'],
  WDS: ['Red Sea', 'LNG pricing'],
  STO: ['Oil price', 'Middle East'],
  WTC: ['Taiwan Strait', 'Logistics'],
  GNC: ['Ukraine', 'Wheat'],
  QAN: ['Fuel cost', 'Air freight'],
  CBA: ['RBA policy'],
  NAB: ['RBA policy'],
  ANZ: ['RBA policy'],
  WBC: ['RBA policy'],
}

function PortfolioExposure({ watchlist }) {
  const rows = useMemo(() => {
    const syms = (watchlist ?? []).map((w) => String(w.symbol ?? w).replace('.AX', '').toUpperCase())
    return syms
      .map((sym) => ({ sym, tags: EXPOSURE_MAP[sym] }))
      .filter((r) => r.tags)
      .slice(0, 6)
  }, [watchlist])

  if (!watchlist?.length) {
    return (
      <div className="px-2 py-2 text-2xs text-terminal-text-dim/70">
        Add stocks to see exposure analysis
      </div>
    )
  }
  if (!rows.length) {
    return (
      <div className="px-2 py-2 text-2xs text-terminal-text-dim/70">
        No watched stocks map to current global events
      </div>
    )
  }

  return (
    <div className="px-2 py-1">
      {rows.map((r) => (
        <div key={r.sym} className="flex items-center justify-between py-1 gap-2">
          <span className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-2xs text-terminal-text-bright font-semibold w-9">{r.sym}</span>
            {/* One dot per exposure — a count reads faster than a list. */}
            <span className="text-terminal-gold text-[11px] tracking-tight">{'●'.repeat(r.tags.length)}</span>
          </span>
          <span className="text-[11px] text-terminal-text-dim text-right truncate">{r.tags.join(', ')}</span>
        </div>
      ))}
    </div>
  )
}

// Layout, top to bottom: the ticker, the filter bar, three compact sections
// (market hours, commodities, geopolitical risk), then the feed. Every section
// collapses and remembers it; the filter hides the sections and ticker items
// outside the chosen category, and remembers too.
//
// Each section names the filters it belongs to. LIVE keeps the sections whose
// figures update in real time (market hours, gold, seismic, FX).
function IntelFeedPanel({ newsItems, audRates, watchlist, earthquakes, quakesAt, onFocusQuake, onFocusPoint }) {
  const { gold } = useGoldPrice()
  const [filter, setFilter] = useState(readIntelFilter)
  const pickFilter = (f) => { setFilter(f); saveIntelFilter(f) }
  const show = (...cats) => filter === 'ALL' || cats.includes(filter)

  const alerts = useMemo(() => {
    if (!newsItems?.length) return []
    return newsItems
      .map(n => ({ ...n, severity: detectSeverity(`${n.headline} ${n.summary ?? ''}`) }))
      .filter(n => n.severity === 'CRITICAL' || n.severity === 'HIGH')
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 4)
  }, [newsItems])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <IntelTicker earthquakes={earthquakes} filter={filter} />
      <IntelFilterBar value={filter} onChange={pickFilter} />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar">
        <CollapsibleSection id="hours" title="MARKET HOURS" hidden={!show('MARKETS', 'LIVE')}>
          <MarketHoursCompact onFocus={onFocusPoint} />
        </CollapsibleSection>

        <CollapsibleSection id="commodity-intel" title="COMMODITY INTELLIGENCE" hidden={!show('MACRO', 'MARKETS', 'LIVE')}
          badge={<HandEnteredBadge dataKey="commodities" />}>
          <CommodityIntel gold={gold} onFocus={onFocusPoint} />
        </CollapsibleSection>

        <CollapsibleSection id="geo-risk" title="GEOPOLITICAL RISK" hidden={!show('GEO')}
          badge={<DataBadge cls="DELAYED" source="Maddex editorial, reviewed" at={RISK_LAST_REVIEWED} compact />}>
          <GeoRiskCards onFocus={onFocusPoint} />
        </CollapsibleSection>

        <CollapsibleSection id="alerts" title="TAGGED HEADLINES" hidden={!show('GEO')}>
          <div className="flex flex-col gap-1.5">
            <div className="text-2xs text-terminal-text-dim/60" data-tag-note>Headlines with a CRITICAL or HIGH word tag. {TAG_NOTE.split('. ').slice(-1)[0]}</div>
            {alerts.length === 0 && (
              <div className="text-2xs text-terminal-text-dim/60 py-1">No headline carries a CRITICAL or HIGH word tag.</div>
            )}
            {alerts.map((a, i) => (
              <div
                key={a.id ?? i}
                onClick={() => a.link && window.open(a.link, '_blank', 'noopener')}
                className={`px-2 py-1.5 border-l-2 text-2xs leading-snug cursor-pointer text-terminal-text-bright ${
                  a.severity === 'CRITICAL' ? 'border-l-terminal-red bg-terminal-red/10' : 'border-l-orange-500 bg-orange-500/10'
                }`}
              >
                <div>{a.headline}</div>
                {a.source && (
                  <div className="mt-1">
                    <span style={{
                      fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, letterSpacing: '0.1em', padding: '1px 5px', borderRadius: 2,
                      background: 'rgba(99,120,153,0.14)', border: '1px solid rgba(99,120,153,0.28)', color: PAL.dim, whiteSpace: 'nowrap',
                    }}>{String(a.source).toUpperCase()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="seismic" title="SEISMIC ACTIVITY" hidden={!show('SEISMIC', 'LIVE')}
          badge={earthquakes ? <DataBadge cls="LIVE" source="USGS · M4.5+ · 7 days" at={quakesAt || null} compact /> : null}>
          <SeismicSection earthquakes={earthquakes} onFocus={onFocusQuake} bare />
        </CollapsibleSection>

        <CollapsibleSection id="exposure" title="PORTFOLIO EXPOSURE" hidden={!show('GEO')}>
          <PortfolioExposure watchlist={watchlist} />
        </CollapsibleSection>

        <CollapsibleSection id="freight" title="FREIGHT" hidden={!show('MACRO', 'MARKETS')} badge={<HandEnteredBadge dataKey="freight" />}>
          <div>
            {SHIPPING_INDEX.map((s) => (
              <div key={s.name} className="flex items-center justify-between py-1 gap-2">
                <span className="text-2xs text-terminal-text-dim flex-shrink-0">{s.name}</span>
                <Sparkline points={s.trend} positive={s.chg >= 0} />
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-2xs text-terminal-text-bright tabular-nums">{s.value.toLocaleString()}</span>
                  <span className={`text-2xs tabular-nums text-right ${s.chg == null ? 'text-terminal-text-dim' : s.chg >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`} title={s.chgLabel ?? undefined}>
                    {s.chg == null ? '—' : `${s.chg >= 0 ? '▲' : '▼'}${Math.abs(s.chg).toFixed(1)}% ${s.chgLabel}`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="fx" title="CURRENCY CROSS" hidden={!show('MARKETS', 'MACRO', 'LIVE')}>
          <div>
            {FX_CROSS_PAIRS.map(p => {
              const v = audRates?.[p.key]
              return (
                <div key={p.key} className="flex items-center justify-between py-1">
                  <span className="text-2xs text-terminal-text-dim">{p.label}</span>
                  <span className="text-2xs text-terminal-text-bright tabular-nums">{v != null ? v.toFixed(p.dp) : '—'}</span>
                </div>
              )
            })}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}

// ─── RIGHT empty-state: world stats summary ────────────────────────────────

function StatBlock({ label, value, accent }) {
  return (
    <div className="border border-terminal-border px-2.5 py-2">
      <div className={`text-lg font-bold tabular-nums ${accent ?? 'text-terminal-text-bright'}`}>{value}</div>
      <div className="text-[11px] text-terminal-text-dim tracking-wide uppercase mt-0.5">{label}</div>
    </div>
  )
}

function WorldStatsSummary() {
  // Recounted each minute: computed once, it kept the count from when the
  // tab opened however long the reader stayed.
  useNow(60_000)
  const openCount = EXCHANGES.filter(ex => isOpenNow(getStatus(ex))).length
  const avgRisk = avgGeoRisk()

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      <div className="text-2xs text-terminal-text-dim leading-relaxed">
        Select a country or exchange on the globe for a detailed view — or browse trade flows,
        geopolitical risk and market sessions via the tabs above.
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatBlock label="Exchanges Tracked" value={EXCHANGES.length} />
        <StatBlock label="Open Now" value={openCount} accent="text-terminal-green" />
        <StatBlock label="Countries" value={COUNTRIES.length} />
        <StatBlock label="Avg Geo Risk" value={avgRisk} accent={riskBand(avgRisk).tw} />
      </div>
      <ScoreNote method="country-risk" asOf={formatDate(RISK_LAST_REVIEWED)} />
    </div>
  )
}
// EdgeRail and SlideOverPanel lived here. They were the narrow-viewport half
// of a two-engine layout — 32px rails with slide-over overlays below 1700px,
// inline columns above it. The dual-pin system replaces both at every width,
// so keeping them would leave a second layout engine that nothing renders and
// that the next person would reasonably assume is still in use.

// ─── Main Module ──────────────────────────────────────────────────────────────

export default function GlobalModule() {
  // The shared ticker (hooks/useNow), in 30 s steps: the module is too heavy
  // to repaint every second, and only the news cutoff reads it.
  const nowMs = useNow(30_000)
  const [activeTab, setActiveTab]     = useState('summary')
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [selectedExchange, setSelectedExchange] = useState(null)
  // Mobile only (<768px) — the feed/globe/detail columns stack instead of
  // sitting side by side, so a small screen needs an explicit switcher.
  // Panel rails. Below 1700px both side panels are overlays; only one is
  // open at a time because two 300px+ overlays on a 1216px map leave less
  // map than the three-column layout this replaced.
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  // ── Dual-pin layout ─────────────────────────────────────────────────────
  //
  // Four states rather than the old wide/narrow split. That split decided FOR
  // the user based on viewport: three inline columns above 1700px, overlays on
  // rails below, and no way to say "I want the intel feed AND the map". This
  // makes it a choice.
  //
  //   A  map only          B  left + map
  //   C  map + right       D  both
  //
  // Default B: the intelligence feed is the most valuable context to have
  // beside the map, and a first-time visitor who sees only a map does not
  // learn the panel exists.
  const [layout, setLayoutState] = useState(() => {
    try {
      const saved = localStorage.getItem('maddex_global_layout')
      return ['A', 'B', 'C', 'D'].includes(saved) ? saved : 'B'
    } catch { return 'B' }
  })
  const setLayout = useCallback((next) => {
    setLayoutState(next)
    try { localStorage.setItem('maddex_global_layout', next) } catch { /* quota */ }
  }, [])

  // Cmd/Ctrl + [ and ] toggle the two panels. Bracket keys because they sit
  // either side of the map on the keyboard the way the panels sit either side
  // of it on screen.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== '[' && e.key !== ']') return
      const el = document.activeElement
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      e.preventDefault()
      const left = e.key === '['
      setLayoutState((cur) => {
        const hasL = cur === 'B' || cur === 'D'
        const hasR = cur === 'C' || cur === 'D'
        const nl = left ? !hasL : hasL
        const nr = left ? hasR : !hasR
        const next = nl && nr ? 'D' : nl ? 'B' : nr ? 'C' : 'A'
        try { localStorage.setItem('maddex_global_layout', next) } catch { /* quota */ }
        return next
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const [leftPinned, setLeftPinned] = useState(() => {
    try { return localStorage.getItem('maddex_global_left_pinned') === 'true' } catch { return false }
  })
  const toggleLeftPin = useCallback(() => {
    setLeftPinned((v) => {
      const next = !v
      try { localStorage.setItem('maddex_global_left_pinned', String(next)) } catch { /* quota */ }
      return next
    })
  }, [])
  const contentRef = useRef(null)
  const [contentWidth, setContentWidth] = useState(null)
  // 'map' | 'classic'.
  //
  // Default is 'map'. This comment previously explained why it was 'classic'
  // — the Carto basemap tiles were not painting at the time — and that has
  // since been fixed and confirmed in the browser: coastlines, borders and
  // city lights all render on the INTEL style.
  const [viewMode, setViewMode] = useState('map')

  // Measured, not a media query: this module can also render inside a split
  // pane or a popped-out window, where the viewport width says nothing about
  // how much room the content row actually has.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setContentWidth(entry.contentRect.width))
    ro.observe(el)
    setContentWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  // Null until measured — assume narrow, so the map never flashes at 556px
  // before the observer reports.
  const wideLayout = contentWidth != null && contentWidth >= 1700

  // ── Derived visibility, with the min-map-width guard ────────────────────
  //
  // State D needs 280 + 500 + 280 = 1060px of content width. Below that the
  // right panel drops out and the layout degrades to B rather than squeezing
  // the map under its floor — the map is the module, and a 400px map with two
  // panels beside it is two panels with a stripe between them.
  //
  // Degrading rather than blocking matters: the user keeps the state they
  // chose, and it comes back the moment the window is wide enough.
  const DUAL_MIN = 280 + 500 + 280
  const roomForBoth = contentWidth == null || contentWidth >= DUAL_MIN
  const rightWanted = layout === 'C' || layout === 'D'
  const leftVisible = layout === 'B' || layout === 'D'
  const rightVisible = rightWanted && (layout === 'C' || roomForBoth)
  const dualBlocked = layout === 'D' && !roomForBoth

  // Escape closes whichever overlay is open.
  useEffect(() => {
    if (!leftOpen && !rightOpen) return
    const onKey = (e) => { if (e.key === 'Escape') { setLeftOpen(false); setRightOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leftOpen, rightOpen])

  // Tells the TopBar which view is showing, so the breadcrumb can read
  // "GLOBAL · INTELLIGENCE MAP" rather than just "GLOBAL". An event rather
  // than shared state: the TopBar has no business reaching into this module,
  // and thirteen other modules should not have to opt out of a store field.
  useEffect(() => {
    const label = { map: 'INTELLIGENCE MAP', classic: 'CLASSIC GLOBE' }[viewMode]
    window.dispatchEvent(new CustomEvent('madden:subview', { detail: { module: 'global', label } }))
  }, [viewMode])
  const { watchlist } = useStore()

  const { rates, audUsd } = useAudRates()

  // Currency mode (AUD vs USD) — persisted to localStorage
  const [currencyMode, setCurrencyMode] = useState(() => {
    try { return localStorage.getItem('maddex_currency_pref') ?? 'AUD' } catch { return 'AUD' }
  })
  const handleCurrencyToggle = useCallback(() => {
    setCurrencyMode(m => {
      const next = m === 'AUD' ? 'USD' : 'AUD'
      try { localStorage.setItem('maddex_currency_pref', next) } catch { /* quota, private mode, or blocked site data — persistence is best-effort */ }
      return next
    })
  }, [])

  // No country-data refresh on open (15 Nov 2026): it fetched World Bank
  // indicators from every reader's browser into a panel that now shows
  // verified figures only.


  // General news (for country panels)
  const { data: newsItems } = useQuery({
    queryKey: ['news'],
    queryFn:  fetchNews,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })

  // Geo-specific news (Reuters World + BBC) — refetched every 10 minutes so
  // chokepoint status / conflict-zone severity track breaking news, not just
  // the last manual refresh.
  const { data: geoNewsItems, isLoading: geoNewsLoading, dataUpdatedAt: geoNewsUpdatedAt } = useQuery({
    queryKey: ['geoNews'],
    queryFn:  fetchGeoNews,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })

  // Live aircraft (OpenSky) — airborne count by origin country, for the AIR tab
  const { data: flightRaw } = useQuery({
    queryKey: ['opensky'],
    queryFn:  fetchFlightData,
    // Switched off for licence reasons: not polled at all (it used to fail
    // every 5 minutes, then retry).
    enabled:  !licenceOff('opensky'),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })
  const flightData = useMemo(() => transformFlightData(flightRaw), [flightRaw])

  // USGS M4.5+, last 7 days — the same feed (and cache) the intel map's
  // seismic layer and header count read, so every seismic figure on this
  // screen agrees.
  const { data: earthquakes, dataUpdatedAt: quakesAt } = useQuery({
    queryKey: ['usgsQuakes45w'],
    queryFn:  async () => (await liveDataService.getEarthquakes(4.5)).data ?? [],
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })

  // Combine for geopolitical tab.
  //
  // Filtered to market-relevant stories here, not only inside fetchGeoNews,
  // because this list feeds four surfaces: ACTIVE INTELLIGENCE, the CRITICAL
  // EVENT banner, the maritime tab and the geo-risk tab. The main news feed
  // contributes to it too and carries sport and crime of its own.
  //
  // ACTIVE INTELLIGENCE selects on severity, and detectSeverity keys on words
  // like "dies" and "attacked" — so a crocodile handler killed at a PNG
  // wildlife park scored HIGH and led the panel as market intelligence.
  // Severity answers "how urgent", never "is this about markets".
  const allNewsItems = useMemo(() => {
    const all = [...(geoNewsItems ?? []), ...(newsItems?.articles ?? [])]
    // Deduplicate by headline
    const seen = new Set()
    const deduped = all.filter(n => { if (seen.has(n.headline)) return false; seen.add(n.headline); return true })
    return filterFinanceRelevant(deduped)
  }, [geoNewsItems, newsItems])

  // Critical-event alert banner — any CRITICAL-severity geo article from the last 60 minutes
  const criticalAlert = useMemo(() => {
    if (!nowMs) return null
    const cutoff = nowMs - 60 * 60 * 1000
    return allNewsItems
      .filter(n => n.pubDate && new Date(n.pubDate).getTime() >= cutoff)
      .map(n => ({ ...n, severity: detectSeverity(`${n.headline} ${n.summary ?? ''}`) }))
      .filter(n => n.severity === 'CRITICAL')
      .sort((a, b) => b.pubDate - a.pubDate)[0] ?? null
  }, [allNewsItems, nowMs])

  const handleAskAI = useCallback((fields) => {
    dispatchAskAI(fields)
  }, [])

  // Globe country click — rewires the orphaned CountryPanel back to the globe.
  const handleCountryClick = useCallback((numericId) => {
    setSelectedCountry(numericId)
    // Opens the detail overlay so a map click has a visible result at any
    // width, rather than silently updating a panel behind a closed rail.
    setRightOpen(true)
    setLeftOpen(false)
  }, [])

  // Globe exchange-marker click — resolve the exchange's country (via this
  // module's own 51-entry EXCHANGES array) and show the same CountryPanel,
  // which already surfaces the linked exchange's session countdown.
  const handleExchangeClick = useCallback((exchangeId) => {
    const ex = EXCHANGES.find(e => e.id === exchangeId)
    if (ex?.countryId) setSelectedCountry(ex.countryId)
    setRightOpen(true)
    setLeftOpen(false)
  }, [])

  // A NEW object per request, deliberately. The map flies when this prop
  // changes identity, so reusing one object would make a second click on the
  // same earthquake do nothing.
  const [mapFocus, setMapFocus] = useState(null)
  const handleFocusQuake = useCallback((q) => {
    if (!Array.isArray(q?.coordinates)) return
    setMapFocus({ longitude: q.coordinates[0], latitude: q.coordinates[1], zoom: 5, pitch: 40, at: Date.now() })
  }, [])

  // Fly the map to a point — a commodity region, a risk region, an exchange.
  const handleFocusPoint = useCallback((p) => {
    if (p?.longitude == null || p?.latitude == null) return
    setMapFocus({ longitude: p.longitude, latitude: p.latitude, zoom: p.zoom ?? 4, pitch: 35, at: Date.now() })
  }, [])

  // Short labels, because six tabs share a 340px overlay and anything longer
  // truncates — "MARITI…" and "GEO RI…" are worse than a shorter word that
  // fits. A terminal audience reads SHIPPING and RISK without hesitation.
  //
  // `title` carries the full name for the hover, so nothing is lost: the tab
  // is abbreviated on the face and spelled out on contact.
  const TABS = [
    { id:'summary',     label:'WORLD',    title:'World summary'        },
    { id:'maritime',    label:'SHIPPING', title:'Maritime trade routes' },
    { id:'air',         label:'AIR',      title:'Air freight routes'    },
    { id:'commodities', label:'COMMOD',   title:'Commodity flows'       },
    { id:'geopolitical',label:'RISK',     title:'Geopolitical risk'     },
    { id:'sessions',    label:'HOURS',    title:'Market sessions'       },
    { id:'exchange',    label:'EXCH',     title:'Selected exchange', hidden: !selectedExchange && activeTab !== 'exchange' },
  ]

  // Panel contents, defined once and rendered either inline (wide) or inside a
  // slide-over (narrow). Duplicating this JSX across the two branches would
  // mean two places to keep in step, and React would remount the whole subtree
  // on every crossing of the breakpoint.
  const feedPanel = (
    <IntelFeedPanel
      newsItems={allNewsItems}
      quakesAt={quakesAt}
      audRates={rates}
      onFocusPoint={handleFocusPoint}
      watchlist={watchlist}
      earthquakes={earthquakes}
      onFocusQuake={handleFocusQuake}
    />
  )

  const rightPanel = (
    <>
      <TabBar
        tabs={TABS.filter(t => !t.hidden).map(t => ({ key: t.id, label: t.label, title: t.title }))}
        activeKey={activeTab}
        onChange={setActiveTab}
        size={9}
        fill
      />
      <div className="flex-1 overflow-hidden">
        {selectedCountry != null ? (
          <CountryPanel
            id={selectedCountry}
            newsItems={allNewsItems}
            audRates={rates}
            audUsd={audUsd}
            currencyMode={currencyMode}
            onCurrencyToggle={handleCurrencyToggle}
            onClose={() => setSelectedCountry(null)}
            onAskAI={handleAskAI}
          />
        ) : activeTab === 'exchange' && selectedExchange ? (
          <ExchangePanel
            exchangeId={selectedExchange}
            newsItems={allNewsItems}
            onClose={() => { setSelectedExchange(null); setActiveTab('summary') }}
            onAskAI={handleAskAI}
          />
        ) : activeTab === 'summary' ? (
          <WorldStatsSummary />
        ) : activeTab === 'maritime' ? (
          <MaritimeTab newsItems={allNewsItems} />
        ) : activeTab === 'air' ? (
          <AirTradeRoutesTab flightData={flightData} />
        ) : activeTab === 'commodities' ? (
          <CommodityFlowsTab onAskAI={handleAskAI} />
        ) : activeTab === 'geopolitical' ? (
          <GeoRiskTab newsItems={allNewsItems} isLoading={geoNewsLoading} onAskAI={handleAskAI} updatedAt={geoNewsUpdatedAt} />
        ) : activeTab === 'sessions' ? (
          <MarketSessionsTab />
        ) : null}
      </div>
    </>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader
        title="GLOBAL"
        subtitle="Trade Flows · Market Breadth · Country Risk"
        moduleId="global"
        right={
          /* The view switch belongs to the module, not to the map, so it
             lives in the header. Floating it over the globe put it in the
             same top-right corner as the map's own fullscreen button, the
             detail panel and the classic globe's control pills — four
             things competing for one corner, and the highest z-index won. */
          <>
          {/* Layout presets. Four glyphs rather than four words: they are
              pictures of the layout they select, which is faster to read than
              "LEFT + MAP" and does not need translating. D disables itself
              when the viewport cannot hold it, with the reason in the tooltip
              rather than silently doing something else. */}
          <div className="flex items-center border border-terminal-border rounded-sm overflow-hidden flex-shrink-0 mr-2" role="group" aria-label="Panel layout">
            {[
              ['B', '◧', 'Intel panel + map  (⌘[)', true],
              ['A', '▣', 'Map only', true],
              ['C', '▨', 'Map + detail panel  (⌘])', true],
              ['D', '⊞', roomForBoth ? 'Both panels  (⌘[ ⌘])' : 'Both panels — window too narrow', roomForBoth],
            ].map(([mode, glyph, title, enabled]) => (
              <button
                key={mode}
                onClick={() => enabled && setLayout(mode)}
                disabled={!enabled}
                aria-pressed={layout === mode}
                title={title}
                className={`text-2xs px-2 py-1 font-bold transition-colors ${
                  layout === mode ? 'bg-terminal-gold text-terminal-bg'
                    : enabled ? 'text-terminal-text-dim hover:text-terminal-gold'
                    : 'text-terminal-text-dim/25 cursor-not-allowed'
                }`}
              >{glyph}</button>
            ))}
          </div>

          <div className="flex items-center border border-terminal-border rounded-full overflow-hidden flex-shrink-0" role="group" aria-label="Globe view mode">
            {[['map', 'INTEL MAP'], ['classic', 'CLASSIC GLOBE']].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={`text-2xs px-2.5 py-1 font-bold whitespace-nowrap transition-colors ${viewMode === mode ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
              >{label}</button>
            ))}
          </div>
          </>
        }
      />

      {/* Says why, rather than leaving the user to wonder why ⊞ did nothing.
          Degrading silently is worse than degrading loudly. */}
      {dualBlocked && (
        <div className="flex items-center gap-2 px-3 py-1 flex-shrink-0"
          style={{ background: 'rgba(201,168,76,0.08)', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
          <span className="text-2xs text-terminal-gold">⊞</span>
          <span className="text-2xs text-terminal-text-dim">
            Window too narrow for both panels — the map has a 500px floor. Showing the intelligence panel only.
          </span>
        </div>
      )}

      {/* Critical-event alert banner */}
      {criticalAlert && (
        <div className="flex items-center gap-3 px-3 py-1 bg-terminal-red/15 border-b border-terminal-red/50 flex-shrink-0" title={TAG_NOTE}>
          <span className="text-terminal-red text-2xs font-bold tracking-widest flex-shrink-0">HEADLINE · LAST HOUR · CRITICAL WORD TAG</span>
          <span className="text-2xs text-terminal-text truncate">{criticalAlert.headline}</span>
          <span className="text-2xs text-terminal-text-dim flex-shrink-0">{timeAgo(criticalAlert.pubDate)} · {criticalAlert.source}</span>
        </div>
      )}

      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>

        {/* ── Main content row ──────────────────────────────────────────────
            The map is the module. Below 1700px the two side panels stop being
            columns and become overlays on a 32px rail, so the map keeps the
            full content width instead of being squeezed into the ~556px that
            was left after a 300px feed and a 340px tab panel. At 1280px the
            map now measures ~1216px rather than 556px.

            Above 1700px there is genuinely room for three columns, so the
            panels stay inline — an overlay covering a map that had space
            beside it would be worse, not better. */}
        <div ref={contentRef} style={{ flex:1, display:'flex', minHeight:0, position:'relative', overflow:'hidden' }}>

          {/* Left feed. Always mounted, width-animated — see .global-panel in
              index.css for why width rather than transform. Keeping it mounted
              also means its feed subscriptions and scroll position survive a
              collapse, so reopening returns you to where you were rather than
              to the top of a freshly-fetched list. */}
          <div className={`global-panel flex flex-col border-r border-terminal-border ${leftVisible ? 'visible' : ''}`}>
            <div className="flex flex-col h-full" style={{ width: 280 }}>
              <div className="flex items-center gap-2 px-3 flex-shrink-0"
                style={{ height: 28, borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                <span className="text-2xs text-terminal-gold font-bold tracking-widest">INTELLIGENCE</span>
                <button
                  onClick={toggleLeftPin}
                  title={leftPinned ? 'Unpin panel' : 'Pin panel open'}
                  aria-pressed={leftPinned}
                  aria-label="Pin intelligence panel open"
                  className="ml-auto transition-colors"
                  style={{ color: leftPinned ? PAL.gold : PAL.muted, fontSize: 11 }}
                >📌</button>
                <button
                  onClick={() => setLayout(layout === 'D' ? 'C' : 'A')}
                  title="Close panel"
                  aria-label="Close intelligence panel"
                  className="text-terminal-text-dim hover:text-terminal-gold transition-colors"
                  style={{ fontSize: 11 }}
                >✕</button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">{feedPanel}</div>
            </div>
          </div>

          {/* Map — takes whatever the panels leave, never below 500px. */}
          <div className="global-map-container" style={{ overflow:'hidden', minHeight:0 }}>
            {/* Rail shown only when the left panel is collapsed, so there is
                always a way back to it without hunting the header. */}
            {!leftVisible && (
              <button
                onClick={() => setLayout(layout === 'C' ? 'D' : 'B')}
                title="Open intelligence panel (⌘[)"
                style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: 32, zIndex: 40,
                  background: 'rgba(6,13,26,0.92)', borderRight: '1px solid rgba(201,168,76,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <span style={{
                  writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                  fontSize: 11, letterSpacing: '0.2em', color: PAL.gold,
                  fontFamily: '"IBM Plex Mono", monospace',
                }}>INTEL</span>
              </button>
            )}
            <Suspense fallback={<Viz3DLoader />}>
              {/* Two views. The Immersive 3D globe was removed — the intel
                  map is the primary view and the classic globe is the
                  orientation view; a third that did neither job better than
                  either was a toggle nobody had a reason to press.
                  Anything not 'classic' falls through to the map, so a
                  persisted 'globe3d' from an older session lands somewhere
                  real instead of rendering nothing. */}
              {viewMode === 'classic' ? (
                <MaddexGlobe
                  onCountryClick={handleCountryClick}
                  onExchangeClick={handleExchangeClick}
                  earthquakes={earthquakes}
                  chromeInset={wideLayout ? { left: 0, right: 0 } : { left: 36, right: 36 }}
                  focusTarget={mapFocus}
                />
              ) : (
                <DeckGLMap
                  onExchangeSelect={handleExchangeClick}
                  watchlist={watchlist}
                  // The rails overlay the map's edges below 1700px, so the
                  // map's own chrome steps inside them. Zero when the panels
                  // are inline columns and nothing is covering the edges.
                  chromeInset={wideLayout ? { left: 0, right: 0 } : { left: 36, right: 36 }}
                  focusTarget={mapFocus}
                />
              )}
            </Suspense>
          </div>

          {/* Right detail/tabs panel — same width-animated treatment. */}
          <div className={`global-panel flex flex-col border-l border-terminal-border ${rightVisible ? 'visible' : ''}`}>
            <div className="flex flex-col h-full" style={{ width: 280 }}>
              <div className="flex items-center gap-2 px-3 flex-shrink-0"
                style={{ height: 28, borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                <span className="text-2xs text-terminal-gold font-bold tracking-widest">DETAIL</span>
                <button
                  onClick={() => setLayout(layout === 'D' ? 'B' : 'A')}
                  title="Close panel (⌘])"
                  aria-label="Close detail panel"
                  className="ml-auto text-terminal-text-dim hover:text-terminal-gold transition-colors"
                  style={{ fontSize: 11 }}
                >✕</button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">{rightPanel}</div>
            </div>
          </div>

          {/* The old narrow-layout branch lived here: two 32px EdgeRails plus
              a pair of SlideOverPanel overlays, rendered whenever the content
              was under 1700px. The dual-pin system above replaces it at every
              width, and leaving both in place put four extra elements in the
              same flex row — 32 + 32 + 300 + 340 = 704px of it — which is why
              the right panel measured 1px while carrying the visible class.
              One layout engine, not two. */}

        </div>{/* end main content row */}
      </div>{/* end outer flex-col */}
    </div>
  )
}
