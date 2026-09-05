import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchGeoNews, fetchNews, fetchFlightData, transformFlightData } from '../../services/api'
import { fetchSignificantEarthquakes, fetchCurrentWeather, weatherCodeLabel } from '../../services/globalDataService'
import { useAudRates } from '../../hooks/useAudRates'
import { useStore } from '../../store/useStore'
import { useCountryData } from '../../hooks/useCountryData'
import COUNTRIES from '../../data/countryDatabase'
import { initCountryDataRefresh } from '../../services/countryApiService'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { SHIPPING_ROUTES, FREIGHT_ROUTES } from '../../data/globeRoutes'
import { ModuleLoader, Viz3DLoader } from '../../components/ui/ModuleStates'
import ModuleHeader from '../../components/ui/ModuleHeader'
import GeopoliticalImpact from '../../components/global/GeopoliticalImpact'
import TabBar from '../../components/ui/TabBar'

// Code-split — d3 + topojson-client pull in a large bundle only needed once
// the user actually opens the Global module.
const MaddexGlobe = lazy(() => import('../../components/globe/MaddexGlobe'))
// Three.js globe is heavier still (three + @react-three/fiber/drei) — only
// loaded once the user actually switches to the 3D view.
const Globe3D = lazy(() => import('../../components/globe/Globe3D'))
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
  208:'Denmark', 212:'Dominica', 214:'Dominican Republic', 218:'Ecuador', 818:'Egypt',
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

// ─── Country Detail Data — July 2026 release values ──────────────────────────

const COUNTRY_DETAIL = {
  // ── Core G20 + APAC ──
  36:  { currency:'AUD', tz:'Australia/Sydney',   exchange:'ASX',         index:'ASX 200',      flag:'🇦🇺',
         macro:{ gdp:1.5, gdpLbl:'Q4 2025, ABS', cpi:3.8, cpiLbl:'Q2 2026, ABS', rate:4.35, rateLbl:'May 2026, RBA' },
         partners:['China','Japan','South Korea','India','United States','United Kingdom'] },
  840: { currency:'USD', tz:'America/New_York',   exchange:'NYSE',        index:'S&P 500',      flag:'🇺🇸',
         macro:{ gdp:2.8, gdpLbl:'Q1 2026, BEA', cpi:2.4, cpiLbl:'Apr 2026, BLS', rate:4.38, rateLbl:'May 2026, Fed' },
         partners:['Mexico','Canada','China','Japan','Germany','United Kingdom'] },
  156: { currency:'CNY', tz:'Asia/Shanghai',      exchange:'SSE',         index:'CSI 300',      flag:'🇨🇳',
         macro:{ gdp:4.8, gdpLbl:'Q1 2026, NBS', cpi:0.1, cpiLbl:'Apr 2026, NBS', rate:3.10, rateLbl:'Jun 2026, PBoC' },
         partners:['United States','Japan','South Korea','Germany','Australia','Vietnam'] },
  392: { currency:'JPY', tz:'Asia/Tokyo',         exchange:'TSE',         index:'Nikkei 225',   flag:'🇯🇵',
         macro:{ gdp:0.8, gdpLbl:'Q4 2025, CAO', cpi:3.2, cpiLbl:'Apr 2026, Stat Bureau', rate:0.50, rateLbl:'May 2026, BoJ' },
         partners:['China','United States','South Korea','Australia','Germany','Vietnam'] },
  826: { currency:'GBP', tz:'Europe/London',      exchange:'LSE',         index:'FTSE 100',     flag:'🇬🇧',
         macro:{ gdp:1.1, gdpLbl:'Q4 2025, ONS', cpi:2.6, cpiLbl:'Apr 2026, ONS', rate:4.50, rateLbl:'May 2026, BoE' },
         partners:['United States','Germany','France','Netherlands','China','Ireland'] },
  276: { currency:'EUR', tz:'Europe/Berlin',      exchange:'XETRA',       index:'DAX 40',       flag:'🇩🇪',
         macro:{ gdp:1.2, gdpLbl:'Q1 2026, Eurostat', cpi:2.2, cpiLbl:'May 2026, Destatis', rate:2.50, rateLbl:'Jul 2026, ECB' },
         partners:['United States','France','Netherlands','China','Poland','Italy'] },
  124: { currency:'CAD', tz:'America/Toronto',    exchange:'TSX',         index:'TSX Composite', flag:'🇨🇦',
         macro:{ gdp:1.5, gdpLbl:'Q4 2025, StatCan', cpi:2.3, cpiLbl:'Apr 2026, StatCan', rate:2.75, rateLbl:'Apr 2026, BoC' },
         partners:['United States','China','United Kingdom','Japan','Germany','Mexico'] },
  554: { currency:'NZD', tz:'Pacific/Auckland',   exchange:'NZX',         index:'NZX 50',       flag:'🇳🇿',
         macro:{ gdp:0.7, gdpLbl:'Q4 2025, Stats NZ', cpi:2.5, cpiLbl:'Q1 2026, Stats NZ', rate:3.50, rateLbl:'May 2026, RBNZ' },
         partners:['China','Australia','United States','Japan','South Korea','Singapore'] },
  356: { currency:'INR', tz:'Asia/Kolkata',       exchange:'NSE',         index:'NIFTY 50',     flag:'🇮🇳',
         macro:{ gdp:6.5, gdpLbl:'Q4 2025, MoSPI', cpi:4.6, cpiLbl:'Apr 2026, MoSPI', rate:6.00, rateLbl:'Apr 2026, RBI' },
         partners:['United States','China','UAE','Saudi Arabia','Russia','Australia'] },
  410: { currency:'KRW', tz:'Asia/Seoul',         exchange:'KRX',         index:'KOSPI',        flag:'🇰🇷',
         macro:{ gdp:2.0, gdpLbl:'Q1 2026, BoK', cpi:2.1, cpiLbl:'Apr 2026, Stat Korea', rate:2.75, rateLbl:'May 2026, BoK' },
         partners:['China','United States','Vietnam','Japan','Australia','Germany'] },
  702: { currency:'SGD', tz:'Asia/Singapore',     exchange:'SGX',         index:'STI',          flag:'🇸🇬',
         macro:{ gdp:3.8, gdpLbl:'Q1 2026, MTI', cpi:1.1, cpiLbl:'Apr 2026, Singstat', rate:3.04, rateLbl:'Apr 2026, MAS' },
         partners:['China','Malaysia','United States','Indonesia','Japan','South Korea'] },
  // ── Americas ──
  76:  { currency:'BRL', tz:'America/Sao_Paulo',  exchange:'B3',          index:'Ibovespa',     flag:'🇧🇷',
         macro:{ gdp:2.8, gdpLbl:'Q4 2025, IBGE', cpi:5.5, cpiLbl:'Apr 2026, IBGE', rate:13.75, rateLbl:'May 2026, BCB' },
         partners:['China','United States','Argentina','Netherlands','Chile','Germany'] },
  484: { currency:'MXN', tz:'America/Mexico_City',exchange:'BMV',         index:'IPC',          flag:'🇲🇽',
         macro:{ gdp:1.2, gdpLbl:'Q4 2025, INEGI', cpi:3.8, cpiLbl:'Apr 2026, INEGI', rate:9.00, rateLbl:'May 2026, Banxico' },
         partners:['United States','China','Canada','Germany','South Korea','Japan'] },
  32:  { currency:'ARS', tz:'America/Argentina/Buenos_Aires',exchange:'BYMA',index:'Merval',   flag:'🇦🇷',
         macro:{ gdp:-1.8, gdpLbl:'2025, INDEC', cpi:142.7, cpiLbl:'Apr 2026, INDEC', rate:32.00, rateLbl:'May 2026, BCRA' },
         partners:['Brazil','China','United States','Chile','Germany','Spain'] },
  152: { currency:'CLP', tz:'America/Santiago',   exchange:'BCS',         index:'IPSA',         flag:'🇨🇱',
         macro:{ gdp:2.4, gdpLbl:'Q4 2025, INE', cpi:3.8, cpiLbl:'Apr 2026, INE', rate:5.00, rateLbl:'May 2026, BCCh' },
         partners:['China','United States','Brazil','Japan','South Korea','Argentina'] },
  170: { currency:'COP', tz:'America/Bogota',     exchange:'BVC',         index:'COLCAP',       flag:'🇨🇴',
         macro:{ gdp:2.8, gdpLbl:'Q4 2025, DANE', cpi:5.8, cpiLbl:'Apr 2026, DANE', rate:9.25, rateLbl:'May 2026, BanRep' },
         partners:['United States','China','Panama','Ecuador','Mexico','Brazil'] },
  // ── Middle East & Africa ──
  682: { currency:'SAR', tz:'Asia/Riyadh',        exchange:'Tadawul',     index:'TASI',         flag:'🇸🇦',
         macro:{ gdp:1.8, gdpLbl:'Q4 2025, GASTAT', cpi:2.0, cpiLbl:'Apr 2026, GASTAT', rate:5.50, rateLbl:'May 2026, SAMA' },
         partners:['China','Japan','South Korea','India','United States','Australia'] },
  784: { currency:'AED', tz:'Asia/Dubai',         exchange:'ADX',         index:'DFM General',  flag:'🇦🇪',
         macro:{ gdp:4.5, gdpLbl:'2025, StatCo', cpi:2.3, cpiLbl:'Mar 2026, StatCo', rate:4.40, rateLbl:'May 2026, CBUAE' },
         partners:['China','India','United States','Japan','Saudi Arabia','Germany'] },
  818: { currency:'EGP', tz:'Africa/Cairo',       exchange:'EGX',         index:'EGX 30',       flag:'🇪🇬',
         macro:{ gdp:4.2, gdpLbl:'FY25, CAPMAS', cpi:24.1, cpiLbl:'Apr 2026, CAPMAS', rate:27.25, rateLbl:'May 2026, CBE' },
         partners:['China','United States','Saudi Arabia','UAE','Turkey','Italy'] },
  566: { currency:'NGN', tz:'Africa/Lagos',       exchange:'NGX',         index:'NGX All-Share', flag:'🇳🇬',
         macro:{ gdp:3.2, gdpLbl:'Q4 2025, NBS', cpi:33.2, cpiLbl:'Apr 2026, NBS', rate:27.50, rateLbl:'May 2026, CBN' },
         partners:['India','Spain','United States','China','Netherlands','South Africa'] },
  710: { currency:'ZAR', tz:'Africa/Johannesburg',exchange:'JSE',         index:'JSE All Share', flag:'🇿🇦',
         macro:{ gdp:1.1, gdpLbl:'Q4 2025, StatSA', cpi:3.2, cpiLbl:'Apr 2026, StatSA', rate:7.50, rateLbl:'May 2026, SARB' },
         partners:['China','United States','Germany','United Kingdom','Japan','India'] },
  // ── Europe ──
  250: { currency:'EUR', tz:'Europe/Paris',       exchange:'Euronext',    index:'CAC 40',       flag:'🇫🇷',
         macro:{ gdp:1.2, gdpLbl:'Q1 2026, Eurostat', cpi:2.2, cpiLbl:'May 2026, INSEE', rate:2.50, rateLbl:'Jul 2026, ECB' },
         partners:['Germany','United States','Italy','Belgium','Spain','Netherlands'] },
  792: { currency:'TRY', tz:'Europe/Istanbul',    exchange:'Borsa Istanbul',index:'BIST 100',   flag:'🇹🇷',
         macro:{ gdp:2.8, gdpLbl:'Q4 2025, Turkstat', cpi:38.1, cpiLbl:'Apr 2026, Turkstat', rate:42.50, rateLbl:'May 2026, TCMB' },
         partners:['Russia','Germany','China','United States','Italy','United Kingdom'] },
  756: { currency:'CHF', tz:'Europe/Zurich',      exchange:'SIX',         index:'SMI',          flag:'🇨🇭',
         macro:{ gdp:1.5, gdpLbl:'Q4 2025, FSO', cpi:0.3, cpiLbl:'Apr 2026, FSO', rate:0.25, rateLbl:'Mar 2026, SNB' },
         partners:['Germany','United States','China','France','Italy','United Kingdom'] },
  578: { currency:'NOK', tz:'Europe/Oslo',        exchange:'Oslo Bors',   index:'OBX',          flag:'🇳🇴',
         macro:{ gdp:1.8, gdpLbl:'Q4 2025, SSB', cpi:2.6, cpiLbl:'Apr 2026, SSB', rate:4.50, rateLbl:'May 2026, Norges Bank' },
         partners:['Germany','United Kingdom','Netherlands','United States','Sweden','China'] },
  752: { currency:'SEK', tz:'Europe/Stockholm',   exchange:'Nasdaq Stockholm',index:'OMXS30',   flag:'🇸🇪',
         macro:{ gdp:1.2, gdpLbl:'Q4 2025, SCB', cpi:1.8, cpiLbl:'Apr 2026, SCB', rate:2.25, rateLbl:'May 2026, Riksbank' },
         partners:['Germany','Norway','United States','Denmark','Finland','Netherlands'] },
  643: { currency:'RUB', tz:'Europe/Moscow',      exchange:'MOEX',        index:'MOEX',         flag:'🇷🇺',
         macro:{ gdp:2.2, gdpLbl:'2025, Rosstat', cpi:9.8, cpiLbl:'Apr 2026, Rosstat', rate:21.00, rateLbl:'Apr 2026, CBR' },
         partners:['China','India','Turkey','Belarus','Kazakhstan','UAE'] },
  // ── Asia ──
  344: { currency:'HKD', tz:'Asia/Hong_Kong',     exchange:'HKEX',        index:'Hang Seng',    flag:'🇭🇰',
         macro:{ gdp:2.8, gdpLbl:'Q4 2025, CSD', cpi:1.8, cpiLbl:'Mar 2026, CSD', rate:4.75, rateLbl:'May 2026, HKMA' },
         partners:['China','United States','Japan','Taiwan','India','Singapore'] },
  158: { currency:'TWD', tz:'Asia/Taipei',        exchange:'TWSE',        index:'TAIEX',        flag:'🇹🇼',
         macro:{ gdp:3.8, gdpLbl:'Q4 2025, DGBAS', cpi:2.1, cpiLbl:'Apr 2026, DGBAS', rate:2.00, rateLbl:'Mar 2026, CBC' },
         partners:['China','United States','Japan','South Korea','Hong Kong','Singapore'] },
  704: { currency:'VND', tz:'Asia/Ho_Chi_Minh',   exchange:'HOSE',        index:'VN-Index',     flag:'🇻🇳',
         macro:{ gdp:6.8, gdpLbl:'Q1 2026, GSO', cpi:3.2, cpiLbl:'Apr 2026, GSO', rate:4.50, rateLbl:'May 2026, SBV' },
         partners:['China','United States','South Korea','Japan','Australia','Germany'] },
  764: { currency:'THB', tz:'Asia/Bangkok',       exchange:'SET',         index:'SET',          flag:'🇹🇭',
         macro:{ gdp:2.8, gdpLbl:'Q4 2025, NESDC', cpi:0.8, cpiLbl:'Apr 2026, MOC', rate:2.00, rateLbl:'May 2026, BoT' },
         partners:['China','United States','Japan','Vietnam','Singapore','Malaysia'] },
  458: { currency:'MYR', tz:'Asia/Kuala_Lumpur',  exchange:'Bursa',       index:'FBMKLCI',      flag:'🇲🇾',
         macro:{ gdp:4.5, gdpLbl:'Q4 2025, DOSM', cpi:1.8, cpiLbl:'Mar 2026, DOSM', rate:3.00, rateLbl:'May 2026, BNM' },
         partners:['China','Singapore','United States','Japan','Thailand','Australia'] },
  608: { currency:'PHP', tz:'Asia/Manila',        exchange:'PSE',         index:'PSEi',         flag:'🇵🇭',
         macro:{ gdp:5.8, gdpLbl:'Q1 2026, PSA', cpi:3.2, cpiLbl:'Apr 2026, PSA', rate:5.50, rateLbl:'May 2026, BSP' },
         partners:['China','United States','Japan','Hong Kong','South Korea','Singapore'] },
  360: { currency:'IDR', tz:'Asia/Jakarta',       exchange:'IDX',         index:'JCI',          flag:'🇮🇩',
         macro:{ gdp:4.9, gdpLbl:'Q1 2026, BPS', cpi:2.5, cpiLbl:'Apr 2026, BPS', rate:5.75, rateLbl:'May 2026, BI' },
         partners:['China','Japan','United States','Singapore','India','Australia'] },
  586: { currency:'PKR', tz:'Asia/Karachi',       exchange:'PSX',         index:'KSE 100',      flag:'🇵🇰',
         macro:{ gdp:2.4, gdpLbl:'FY25, PBS', cpi:12.4, cpiLbl:'Apr 2026, PBS', rate:12.00, rateLbl:'May 2026, SBP' },
         partners:['China','United Arab Emirates','United States','Saudi Arabia','Afghanistan','Germany'] },
  // ── Ukraine (conflict — data as available) ──
  804: { currency:'UAH', tz:'Europe/Kyiv',        exchange:'PFTS',        index:'UX',           flag:'🇺🇦',
         macro:{ gdp:-4.0, gdpLbl:'2023, SSSU', cpi:12.0, cpiLbl:'Apr 2025, SSSU', rate:14.5, rateLbl:'Apr 2025, NBU' },
         partners:['Germany','Poland','United States','Romania','Turkey','China'] },
}

// ─── Country classification sets ─────────────────────────────────────────────

const CONFLICT_COUNTRIES = new Set([804, 275, 887, 729, 760, 104, 466, 706])  // Ukraine, Palestine, Yemen, Sudan, Syria, Myanmar, Mali, Somalia
const STRESS_COUNTRIES   = new Set([643, 364, 408, 862, 112])                  // Russia, Iran, N.Korea, Venezuela, Belarus
const PARTNER_COUNTRIES  = new Set([156, 392, 410, 356, 840, 826])             // China, Japan, S.Korea, India, US, UK

// ─── Extended country data (capital, pop, economy brief, AU trade note) ───────

const COUNTRY_EXTRA = {
  36:  { capital:'Canberra', pop:'26.5M', economy:'Commodity-driven open economy. Top exports: iron ore, LNG, coal, gold, beef. Services dominate GDP at 70%. Mining investment cycle and China demand are primary growth levers.', auTrade:'N/A (domestic)', risk:'VERY LOW' },
  840: { capital:'Washington D.C.', pop:'337M', economy:'World\'s largest economy. Services-led with dominant tech, finance, and defence sectors. Federal Reserve policy sets global risk tone. USD remains reserve currency.', auTrade:'AU exports US$14B: beef, wine, aluminium, gold. AU imports US$33B: aircraft, pharma, machinery. AUSFTA in place.', risk:'LOW' },
  156: { capital:'Beijing', pop:'1.41B', economy:'World\'s second-largest economy. State-directed market model with manufacturing and export strengths. Property sector deleveraging and demographic headwinds are key risks. Yuan internationalisation ongoing.', auTrade:'AU\'s #1 trade partner — AU exports ~A$200B: iron ore (60%), LNG, coal, beef, wine. Trade relationship strained 2020-23, partially recovering.', risk:'MEDIUM' },
  392: { capital:'Tokyo', pop:'124M', economy:'Advanced economy with manufacturing excellence in auto, robotics, and electronics. Deflationary mindset entrenched; BOJ ultra-loose policy ending. Yen weakness boosts exporters.', auTrade:'AU exports ~A$55B: LNG, coal, beef, wheat. Long-term LNG contracts key. Japan #2 AU trade partner.', risk:'LOW' },
  826: { capital:'London', pop:'67.6M', economy:'Financial services hub; post-Brexit adjusting. High inflation required aggressive BoE tightening. North Sea energy sector benefits from elevated prices. Labour productivity weak.', auTrade:'AU exports A$8B: gold, wine, beef, LNG. Strong financial and capital market ties. AUKUS partner.', risk:'LOW' },
  276: { capital:'Berlin', pop:'84.7M', economy:'Europe\'s largest economy, export-led via auto, machinery, chemicals. Energy shock post-2022 hit hard — industrial competitiveness remains challenged. ECB policy dominant driver.', auTrade:'AU exports A$3B: coal, gold, wool, meat. Germany AU\'s 10th trade partner. EU-AU FTA negotiations ongoing.', risk:'LOW' },
  124: { capital:'Ottawa', pop:'39.6M', economy:'Resource-rich open economy closely tied to US via USMCA. Oil sands, mining, and agriculture key. BoC cutting rates as housing affordability crisis deepens. CAD tracks commodity prices.', auTrade:'AU exports A$2B: gold, coal, LNG. Competitor in global LNG and agricultural markets. CPTPP partners.', risk:'LOW' },
  356: { capital:'New Delhi', pop:'1.44B', economy:'World\'s fastest-growing major economy. Services and manufacturing expanding. Demographics favourable. Inflation and current account deficit are recurring risks. RBI conservative.', auTrade:'AU exports A$18B: coal, gold, copper, education, LNG. Rapidly growing relationship. ECTA signed 2022.', risk:'LOW' },
  410: { capital:'Seoul', pop:'51.7M', economy:'Export powerhouse — semiconductors, auto, shipbuilding, steel. POSCO and Samsung globally critical. K-pop and culture exports growing. Birth rate crisis threatens long-term growth.', auTrade:'AU exports A$22B: LNG, iron ore, coal, beef. Korea AU\'s 4th trade partner. KAFTA signed 2014.', risk:'LOW' },
  702: { capital:'Singapore', pop:'5.9M', economy:'Financial hub and logistics centre for SE Asia. Entrepôt trade model. MAS manages inflation via exchange rate. Tech, biomedical, and financial services diversifying revenue base.', auTrade:'AU exports A$9B: gold, education, LNG, machinery. Major investment flows in both directions. Singapore #5 AU partner.', risk:'VERY LOW' },
  682: { capital:'Riyadh', pop:'32.2M', economy:'Oil-dependent economy diversifying via Vision 2030. ARAMCO IPO and giga-projects (NEOM) central. Non-oil GDP growing 6%+. Subsidy reform and female workforce integration ongoing.', auTrade:'AU exports A$2B: wheat, barley, meat. Saudi investment in AU agriculture and infrastructure growing.', risk:'LOW' },
  784: { capital:'Abu Dhabi', pop:'9.9M', economy:'UAE is the most diversified Gulf economy. Dubai financial hub. Abu Dhabi sovereign wealth (ADIA ~US$993B) deploys globally. Strong FDI attraction via free zones.', auTrade:'AU exports A$4B: gold, aluminium, LNG. Major airline transit hub (Etihad) connecting AU to Europe.', risk:'VERY LOW' },
  76:  { capital:'Brasília', pop:'215M', economy:'Agriculture superpower (soy, corn, beef, coffee) and large industrial base. Fiscal consolidation ongoing under Lula. BRL volatility linked to commodity prices and US Fed.', auTrade:'AU competes in iron ore, coal, and agriculture markets. Bilateral trade A$3B. CPTPP negotiations.', risk:'MEDIUM' },
  643: { capital:'Moscow', pop:'146M', economy:'Sanctions-hit economy rerouting trade via China, India, Turkey. Military spending surge drives short-term growth. Ruble managed. Long-term competitiveness damage accumulating.', auTrade:'Minimal — AU sanctions imposed 2022. AU energy sector benefits from Russian supply disruption to Europe.', risk:'VERY HIGH' },
  804: { capital:'Kyiv', pop:'44M (pre-war)', economy:'Under sustained military attack since Feb 2022. GDP contracted 29% in 2022, partial recovery. Agriculture (grain) and defence manufacturing key recovery sectors.', auTrade:'Minimal direct trade. AU providing military aid ~A$1.3B+. AU grain sector impacted by Ukrainian wheat supply disruptions.', risk:'CRITICAL' },
}

function getRiskRating(n) {
  const ex = COUNTRY_EXTRA[n]
  if (ex?.risk) return ex.risk
  if (CONFLICT_COUNTRIES.has(n)) return 'CRITICAL'
  if (STRESS_COUNTRIES.has(n))   return 'VERY HIGH'
  if (PARTNER_COUNTRIES.has(n))  return 'LOW'
  return 'MODERATE'
}

const RISK_COLOR = {
  'VERY LOW':'text-terminal-green', 'LOW':'text-terminal-green',
  'MODERATE':'text-terminal-gold', 'MEDIUM':'text-terminal-gold',
  'HIGH':'text-orange-400', 'VERY HIGH':'text-terminal-red', 'CRITICAL':'text-terminal-red',
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

// Deterministic (not random-on-every-render) pseudo-stats for a country/
// partner pair — illustrative, in the same spirit as the app's other
// synthetic overlays (crypto adoption tiers, heat colouring), used only
// because no per-partner bilateral trade dataset exists for ~190 countries.
function seededHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}
function partnerTradeStats(countryId, partnerName) {
  const h = seededHash(`${countryId}:${partnerName}`)
  const value = 2 + (h % 380) / 10 // A$2.0B - A$39.9B
  const balanceSign = (h >> 8) % 2 === 0 ? 1 : -1
  const balance = balanceSign * value * (0.1 + ((h >> 4) % 40) / 100)
  const trend = ['growing', 'stable', 'declining'][(h >> 12) % 3]
  return { value, balance, trend }
}
const TREND_ARROW = { growing: '▲', stable: '→', declining: '▼' }
const TREND_COLOR = { growing: 'text-terminal-green', stable: 'text-terminal-text-dim', declining: 'text-terminal-red' }

const RISK_BASE_SCORE = { 'VERY LOW': 10, LOW: 25, MODERATE: 40, MEDIUM: 45, HIGH: 65, 'VERY HIGH': 80, CRITICAL: 95 }
function computeTradeRiskScore({ riskRating, hasDisruptedRoute, riskyPartnerCount }) {
  let score = RISK_BASE_SCORE[riskRating] ?? 35
  if (hasDisruptedRoute) score += 15
  score += Math.min(10, riskyPartnerCount * 5)
  return Math.max(0, Math.min(100, score))
}
function riskScoreColor(score) {
  if (score >= 67) return { bar: 'bg-terminal-red', text: 'text-terminal-red' }
  if (score >= 34) return { bar: 'bg-terminal-gold', text: 'text-terminal-gold' }
  return { bar: 'bg-terminal-green', text: 'text-terminal-green' }
}

// ─── Exchanges — full global list with coordinates ────────────────────────────

const EXCHANGES = [
  // ── Australia & Oceania ──
  { id:'ASX',   abbr:'ASX',  name:'Australian Securities Exchange',   city:'Sydney',       country:'Australia',   lat:-33.8688, lon:151.2093, tz:'Australia/Sydney',               open:[10,0],  close:[16,0],  countryId:36,  currency:'AUD', region:'APAC',       index:'ASX 200',     listedCos:2200, mktCapB:1900, topStocks:['BHP.AX','CBA.AX','CSL.AX','WES.AX','NAB.AX'] },
  { id:'NZX',   abbr:'NZX',  name:'New Zealand Exchange',             city:'Wellington',   country:'New Zealand', lat:-41.2865, lon:174.7762, tz:'Pacific/Auckland',               open:[10,0],  close:[16,45], countryId:554, currency:'NZD', region:'APAC',       index:'NZX 50',      listedCos:178,  mktCapB:140,  topStocks:['FPH.AX','FBU.NZ','MEL.NZ'] },
  // ── Asia ──
  { id:'TSE',   abbr:'TSE',  name:'Tokyo Stock Exchange',             city:'Tokyo',        country:'Japan',       lat:35.6762,  lon:139.6503, tz:'Asia/Tokyo',                     open:[9,0],   close:[15,30], countryId:392, currency:'JPY', region:'APAC',       index:'Nikkei 225',  listedCos:3800, mktCapB:6600, topStocks:['TM','SONY','7267.T','9984.T','6501.T'] },
  { id:'SSE',   abbr:'SSE',  name:'Shanghai Stock Exchange',          city:'Shanghai',     country:'China',       lat:31.2304,  lon:121.4737, tz:'Asia/Shanghai',                  open:[9,30],  close:[15,0],  countryId:156, currency:'CNY', region:'APAC',       index:'SSE Composite',listedCos:2200, mktCapB:6300, topStocks:['601398.SS','600028.SS','601857.SS'] },
  { id:'SZSE',  abbr:'SZ',   name:'Shenzhen Stock Exchange',          city:'Shenzhen',     country:'China',       lat:22.5431,  lon:114.0579, tz:'Asia/Shanghai',                  open:[9,30],  close:[15,0],  countryId:156, currency:'CNY', region:'APAC',       index:'SZSE Component',listedCos:2700, mktCapB:4800, topStocks:['000858.SZ','000001.SZ'] },
  { id:'HKEX',  abbr:'HK',   name:'Hong Kong Exchange',               city:'Hong Kong',    country:'Hong Kong',   lat:22.3193,  lon:114.1694, tz:'Asia/Hong_Kong',                 open:[9,30],  close:[16,0],  countryId:344, currency:'HKD', region:'APAC',       index:'Hang Seng',   listedCos:2600, mktCapB:3300, topStocks:['0700.HK','0939.HK','9988.HK'] },
  { id:'KRX',   abbr:'KRX',  name:'Korea Exchange',                   city:'Seoul',        country:'South Korea', lat:37.5665,  lon:126.9780, tz:'Asia/Seoul',                     open:[9,0],   close:[15,30], countryId:410, currency:'KRW', region:'APAC',       index:'KOSPI',       listedCos:2500, mktCapB:1900, topStocks:['005930.KS','000660.KS','035420.KS'] },
  { id:'SGX',   abbr:'SGX',  name:'Singapore Exchange',               city:'Singapore',    country:'Singapore',   lat:1.3521,   lon:103.8198, tz:'Asia/Singapore',                 open:[9,0],   close:[17,0],  countryId:702, currency:'SGD', region:'APAC',       index:'STI',         listedCos:680,  mktCapB:650,  topStocks:['D05.SI','O39.SI','U11.SI'] },
  { id:'BSE',   abbr:'BSE',  name:'Bombay Stock Exchange',            city:'Mumbai',       country:'India',       lat:19.0760,  lon:72.8777,  tz:'Asia/Kolkata',                   open:[9,15],  close:[15,30], countryId:356, currency:'INR', region:'APAC',       index:'SENSEX',      listedCos:5300, mktCapB:3800, topStocks:['RELIANCE.BO','TCS.BO','HDFCBANK.BO'] },
  { id:'NSE',   abbr:'NSE',  name:'National Stock Exchange India',    city:'Mumbai',       country:'India',       lat:19.0560,  lon:72.8677,  tz:'Asia/Kolkata',                   open:[9,15],  close:[15,30], countryId:356, currency:'INR', region:'APAC',       index:'NIFTY 50',    listedCos:2000, mktCapB:3800, topStocks:['RELIANCE.NS','TCS.NS','INFY.NS'] },
  { id:'IDX',   abbr:'IDX',  name:'Indonesia Stock Exchange',         city:'Jakarta',      country:'Indonesia',   lat:-6.2088,  lon:106.8456, tz:'Asia/Jakarta',                   open:[9,0],   close:[15,50], countryId:360, currency:'IDR', region:'APAC',       index:'JCI',         listedCos:900,  mktCapB:580,  topStocks:['BBCA.JK','BMRI.JK','TLKM.JK'] },
  { id:'Bursa', abbr:'BM',   name:'Bursa Malaysia',                   city:'Kuala Lumpur', country:'Malaysia',    lat:3.1390,   lon:101.6869, tz:'Asia/Kuala_Lumpur',              open:[9,0],   close:[17,0],  countryId:458, currency:'MYR', region:'APAC',       index:'FBMKLCI',     listedCos:1000, mktCapB:400,  topStocks:['1155.KL','5183.KL','1023.KL'] },
  { id:'SET',   abbr:'SET',  name:'Stock Exchange of Thailand',       city:'Bangkok',      country:'Thailand',    lat:13.7563,  lon:100.5018, tz:'Asia/Bangkok',                   open:[10,0],  close:[16,30], countryId:764, currency:'THB', region:'APAC',       index:'SET',         listedCos:700,  mktCapB:580,  topStocks:['PTT.BK','AOT.BK','KBANK.BK'] },
  { id:'PSE',   abbr:'PSE',  name:'Philippine Stock Exchange',        city:'Manila',       country:'Philippines', lat:14.5995,  lon:120.9842, tz:'Asia/Manila',                    open:[9,30],  close:[15,30], countryId:608, currency:'PHP', region:'APAC',       index:'PSEi',        listedCos:280,  mktCapB:200,  topStocks:['SM.PS','BDO.PS','ALI.PS'] },
  { id:'TWSE',  abbr:'TW',   name:'Taiwan Stock Exchange',            city:'Taipei',       country:'Taiwan',      lat:25.0330,  lon:121.5654, tz:'Asia/Taipei',                    open:[9,0],   close:[13,30], countryId:158, currency:'TWD', region:'APAC',       index:'TAIEX',       listedCos:950,  mktCapB:2400, topStocks:['2330.TW','2317.TW','2454.TW'] },
  // ── Europe ──
  { id:'LSE',   abbr:'LSE',  name:'London Stock Exchange',            city:'London',       country:'UK',          lat:51.5074,  lon:-0.1278,  tz:'Europe/London',                  open:[8,0],   close:[16,30], countryId:826, currency:'GBP', region:'EUROPE',     index:'FTSE 100',    listedCos:2000, mktCapB:3600, topStocks:['SHEL','AZN','HSBC','BP','ULVR'] },
  { id:'EURONXT',abbr:'PAR', name:'Euronext Paris',                   city:'Paris',        country:'France',      lat:48.8566,  lon:2.3522,   tz:'Europe/Paris',                   open:[9,0],   close:[17,30], countryId:250, currency:'EUR', region:'EUROPE',     index:'CAC 40',      listedCos:1500, mktCapB:5600, topStocks:['MC.PA','OR.PA','TTE.PA'] },
  { id:'XETRA', abbr:'FRA',  name:'Frankfurt Stock Exchange',         city:'Frankfurt',    country:'Germany',     lat:50.1109,  lon:8.6821,   tz:'Europe/Berlin',                  open:[9,0],   close:[17,30], countryId:276, currency:'EUR', region:'EUROPE',     index:'DAX 40',      listedCos:450,  mktCapB:2200, topStocks:['SAP.DE','SIE.DE','ALV.DE'] },
  { id:'SIX',   abbr:'SIX',  name:'Swiss Exchange',                   city:'Zurich',       country:'Switzerland', lat:47.3769,  lon:8.5417,   tz:'Europe/Zurich',                  open:[9,0],   close:[17,30], countryId:756, currency:'CHF', region:'EUROPE',     index:'SMI',         listedCos:250,  mktCapB:1900, topStocks:['NESN.SW','ROG.SW','NOVN.SW'] },
  { id:'AMS',   abbr:'AMS',  name:'Euronext Amsterdam',               city:'Amsterdam',    country:'Netherlands', lat:52.3676,  lon:4.9041,   tz:'Europe/Amsterdam',               open:[9,0],   close:[17,30], countryId:528, currency:'EUR', region:'EUROPE',     index:'AEX',         listedCos:140,  mktCapB:1200, topStocks:['ASML.AS','ADYEN.AS','HEIA.AS'] },
  { id:'BME',   abbr:'MAD',  name:'Madrid Stock Exchange',            city:'Madrid',       country:'Spain',       lat:40.4168,  lon:-3.7038,  tz:'Europe/Madrid',                  open:[9,0],   close:[17,30], countryId:724, currency:'EUR', region:'EUROPE',     index:'IBEX 35',     listedCos:130,  mktCapB:780,  topStocks:['SAN.MC','BBVA.MC','ITX.MC'] },
  { id:'MIL',   abbr:'MIL',  name:'Borsa Italiana',                   city:'Milan',        country:'Italy',       lat:45.4654,  lon:9.1859,   tz:'Europe/Rome',                    open:[9,0],   close:[17,30], countryId:380, currency:'EUR', region:'EUROPE',     index:'FTSE MIB',    listedCos:230,  mktCapB:830,  topStocks:['ENI.MI','ISP.MI','UCG.MI'] },
  { id:'STK',   abbr:'STK',  name:'Nasdaq OMX Stockholm',             city:'Stockholm',    country:'Sweden',      lat:59.3293,  lon:18.0686,  tz:'Europe/Stockholm',               open:[9,0],   close:[17,30], countryId:752, currency:'SEK', region:'EUROPE',     index:'OMXS30',      listedCos:1000, mktCapB:900,  topStocks:['VOLV-B.ST','ERIC-B.ST','ATCO-A.ST'] },
  { id:'OSL',   abbr:'OSL',  name:'Oslo Bors',                        city:'Oslo',         country:'Norway',      lat:59.9139,  lon:10.7522,  tz:'Europe/Oslo',                    open:[9,0],   close:[16,30], countryId:578, currency:'NOK', region:'EUROPE',     index:'OBX',         listedCos:250,  mktCapB:380,  topStocks:['EQNR.OL','DNB.OL','AKER.OL'] },
  { id:'CPH',   abbr:'CPH',  name:'Nasdaq Copenhagen',                city:'Copenhagen',   country:'Denmark',     lat:55.6761,  lon:12.5683,  tz:'Europe/Copenhagen',              open:[9,0],   close:[17,0],  countryId:208, currency:'DKK', region:'EUROPE',     index:'OMXC25',      listedCos:180,  mktCapB:480,  topStocks:['NOVO-B.CO','DSV.CO','MAERSK-B.CO'] },
  { id:'HEL',   abbr:'HEL',  name:'Nasdaq Helsinki',                  city:'Helsinki',     country:'Finland',     lat:60.1699,  lon:24.9384,  tz:'Europe/Helsinki',                open:[9,0],   close:[17,30], countryId:246, currency:'EUR', region:'EUROPE',     index:'OMXH25',      listedCos:180,  mktCapB:290,  topStocks:['NOKIA.HE','FORTUM.HE'] },
  { id:'WSE',   abbr:'WSE',  name:'Warsaw Stock Exchange',            city:'Warsaw',       country:'Poland',      lat:52.2297,  lon:21.0122,  tz:'Europe/Warsaw',                  open:[9,0],   close:[17,0],  countryId:616, currency:'PLN', region:'EUROPE',     index:'WIG20',       listedCos:380,  mktCapB:220,  topStocks:['PKN.WA','PKO.WA','PZU.WA'] },
  { id:'WBAG',  abbr:'VIE',  name:'Vienna Stock Exchange',            city:'Vienna',       country:'Austria',     lat:48.2082,  lon:16.3738,  tz:'Europe/Vienna',                  open:[9,0],   close:[17,30], countryId:40,  currency:'EUR', region:'EUROPE',     index:'ATX',         listedCos:90,   mktCapB:140,  topStocks:['OMV.VI','VIG.VI','VER.VI'] },
  { id:'EBR',   abbr:'BRU',  name:'Euronext Brussels',                city:'Brussels',     country:'Belgium',     lat:50.8503,  lon:4.3517,   tz:'Europe/Brussels',                open:[9,0],   close:[17,30], countryId:56,  currency:'EUR', region:'EUROPE',     index:'BEL 20',      listedCos:140,  mktCapB:380,  topStocks:['UCB.BR','ACKB.BR','ABI.BR'] },
  { id:'ELX',   abbr:'LIS',  name:'Euronext Lisbon',                  city:'Lisbon',       country:'Portugal',    lat:38.7223,  lon:-9.1393,  tz:'Europe/Lisbon',                  open:[8,0],   close:[16,30], countryId:620, currency:'EUR', region:'EUROPE',     index:'PSI 20',      listedCos:50,   mktCapB:90,   topStocks:['EDP.LS','GALP.LS','NOS.LS'] },
  { id:'ATHEX', abbr:'ATH',  name:'Athens Stock Exchange',            city:'Athens',       country:'Greece',      lat:37.9838,  lon:23.7275,  tz:'Europe/Athens',                  open:[10,15], close:[16,0],  countryId:300, currency:'EUR', region:'EUROPE',     index:'ATHEX Composite', listedCos:150, mktCapB:90, topStocks:['OPAP.AT','ETE.AT','ALPHA.AT'] },
  { id:'BIST',  abbr:'IST',  name:'Borsa Istanbul',                   city:'Istanbul',     country:'Turkey',      lat:41.0082,  lon:28.9784,  tz:'Europe/Istanbul',                open:[10,0],  close:[18,0],  countryId:792, currency:'TRY', region:'EUROPE',     index:'BIST 100',    listedCos:500,  mktCapB:480,  topStocks:['THYAO.IS','GARAN.IS','AKBNK.IS'] },
  { id:'MOEX',  abbr:'MOX',  name:'Moscow Exchange',                  city:'Moscow',       country:'Russia',      lat:55.7558,  lon:37.6173,  tz:'Europe/Moscow',                  open:[10,0],  close:[18,50], countryId:643, currency:'RUB', region:'EUROPE',     index:'MOEX',        listedCos:230,  mktCapB:520,  topStocks:['GAZP.ME','SBER.ME','LKOH.ME'] },
  // ── Middle East & Africa ──
  { id:'Tadawul',abbr:'TAD', name:'Tadawul',                          city:'Riyadh',       country:'Saudi Arabia',lat:24.7136,  lon:46.6753,  tz:'Asia/Riyadh',                    open:[10,0],  close:[15,0],  countryId:682, currency:'SAR', region:'MIDDLE EAST',index:'TASI',        listedCos:280,  mktCapB:2800, topStocks:['2222.SR','1211.SR','1120.SR'] },
  { id:'DFM',   abbr:'DFM',  name:'Dubai Financial Market',           city:'Dubai',        country:'UAE',         lat:25.2048,  lon:55.2708,  tz:'Asia/Dubai',                     open:[10,0],  close:[14,50], countryId:784, currency:'AED', region:'MIDDLE EAST',index:'DFM General', listedCos:100,  mktCapB:180,  topStocks:['EMAAR.DU','DU.DU','DIB.DU'] },
  { id:'ADX',   abbr:'ADX',  name:'Abu Dhabi Securities Exchange',    city:'Abu Dhabi',    country:'UAE',         lat:24.4539,  lon:54.3773,  tz:'Asia/Dubai',                     open:[10,0],  close:[14,50], countryId:784, currency:'AED', region:'MIDDLE EAST',index:'FTSE ADX',    listedCos:70,   mktCapB:800,  topStocks:['ADNOCDIST.AD','IHC.AD','ALDAR.AD'] },
  { id:'TASE',  abbr:'TLV',  name:'Tel Aviv Stock Exchange',          city:'Tel Aviv',     country:'Israel',      lat:32.0853,  lon:34.7818,  tz:'Asia/Jerusalem',                 open:[9,59],  close:[17,25], countryId:376, currency:'ILS', region:'MIDDLE EAST',index:'TA-125',      listedCos:500,  mktCapB:220,  topStocks:['NICE','CYBR','CHKP'] },
  { id:'EGX',   abbr:'EGX',  name:'Egyptian Exchange',                city:'Cairo',        country:'Egypt',       lat:30.0444,  lon:31.2357,  tz:'Africa/Cairo',                   open:[10,0],  close:[14,30], countryId:818, currency:'EGP', region:'AFRICA',     index:'EGX 30',      listedCos:250,  mktCapB:30,   topStocks:['HRHO.CA','ETEL.CA','SWDY.CA'] },
  { id:'JSE',   abbr:'JSE',  name:'JSE',                              city:'Johannesburg', country:'South Africa', lat:-26.2041, lon:28.0473,  tz:'Africa/Johannesburg',            open:[9,0],   close:[17,0],  countryId:710, currency:'ZAR', region:'AFRICA',     index:'JSE All Share',listedCos:400, mktCapB:1000, topStocks:['NPN.JO','BHP.JO','CFR.JO'] },
  { id:'NGX',   abbr:'NGX',  name:'Nigerian Exchange',                city:'Lagos',        country:'Nigeria',     lat:6.5244,   lon:3.3792,   tz:'Africa/Lagos',                   open:[9,30],  close:[14,30], countryId:566, currency:'NGN', region:'AFRICA',     index:'NGX All-Share',listedCos:150, mktCapB:75,   topStocks:['AIRTELAFRI.NG','DANGCEM.NG'] },
  { id:'CBSX',  abbr:'CSB',  name:'Casablanca Stock Exchange',        city:'Casablanca',   country:'Morocco',     lat:33.5731,  lon:-7.5898,  tz:'Africa/Casablanca',              open:[9,30],  close:[15,30], countryId:504, currency:'MAD', region:'AFRICA',     index:'MASI',        listedCos:80,   mktCapB:65,   topStocks:['IAM.CS','ATW.CS','BCP.CS'] },
  { id:'NSEN',  abbr:'NBI',  name:'Nairobi Securities Exchange',      city:'Nairobi',      country:'Kenya',       lat:-1.2921,  lon:36.8219,  tz:'Africa/Nairobi',                 open:[9,30],  close:[15,0],  countryId:404, currency:'KES', region:'AFRICA',     index:'NSE 20',      listedCos:65,   mktCapB:20,   topStocks:['EABL.KE','SAFCOM.KE'] },
  // ── Americas ──
  { id:'NYSE',  abbr:'NYSE', name:'NYSE',                             city:'New York',     country:'USA',         lat:40.7128,  lon:-74.0060, tz:'America/New_York',               open:[9,30],  close:[16,0],  countryId:840, currency:'USD', region:'AMERICAS',   index:'S&P 500',     listedCos:2400, mktCapB:28000,topStocks:['JPM','JNJ','UNH','BRK-B','XOM'] },
  { id:'NASDAQ',abbr:'NQ',   name:'NASDAQ',                           city:'New York',     country:'USA',         lat:40.7580,  lon:-73.9855, tz:'America/New_York',               open:[9,30],  close:[16,0],  countryId:840, currency:'USD', region:'AMERICAS',   index:'NASDAQ 100',  listedCos:3600, mktCapB:22000,topStocks:['AAPL','NVDA','MSFT','AMZN','META'] },
  { id:'TSX',   abbr:'TSX',  name:'Toronto Stock Exchange',           city:'Toronto',      country:'Canada',      lat:43.6532,  lon:-79.3832, tz:'America/Toronto',                open:[9,30],  close:[16,0],  countryId:124, currency:'CAD', region:'AMERICAS',   index:'TSX Composite',listedCos:1500, mktCapB:3000, topStocks:['SHOP.TO','RY.TO','TD.TO'] },
  { id:'BMV',   abbr:'MEX',  name:'Mexican Stock Exchange',           city:'Mexico City',  country:'Mexico',      lat:19.4326,  lon:-99.1332, tz:'America/Mexico_City',            open:[8,30],  close:[15,0],  countryId:484, currency:'MXN', region:'AMERICAS',   index:'IPC',         listedCos:140,  mktCapB:380,  topStocks:['AMXL.MX','WALMEX.MX','GFNORTEO.MX'] },
  { id:'B3',    abbr:'B3',   name:'B3 Brazil',                        city:'São Paulo',    country:'Brazil',      lat:-23.5505, lon:-46.6333, tz:'America/Sao_Paulo',              open:[10,0],  close:[17,55], countryId:76,  currency:'BRL', region:'AMERICAS',   index:'Ibovespa',    listedCos:500,  mktCapB:850,  topStocks:['PETR4.SA','VALE3.SA','ITUB4.SA'] },
  { id:'BCBA',  abbr:'BUE',  name:'Buenos Aires Stock Exchange',      city:'Buenos Aires', country:'Argentina',   lat:-34.6037, lon:-58.3816, tz:'America/Argentina/Buenos_Aires', open:[11,0],  close:[17,0],  countryId:32,  currency:'ARS', region:'AMERICAS',   index:'Merval',      listedCos:100,  mktCapB:45,   topStocks:['YPF','GGAL','VIST'] },
  { id:'BVC',   abbr:'BOG',  name:'Colombian Stock Exchange',         city:'Bogotá',       country:'Colombia',    lat:4.7110,   lon:-74.0721, tz:'America/Bogota',                 open:[9,0],   close:[16,0],  countryId:170, currency:'COP', region:'AMERICAS',   index:'COLCAP',      listedCos:80,   mktCapB:90,   topStocks:['PFBCOLOM.CL','ECOPETROL.CL'] },
  { id:'BVL',   abbr:'LIM',  name:'Lima Stock Exchange',              city:'Lima',         country:'Peru',        lat:-12.0464, lon:-77.0428, tz:'America/Lima',                   open:[9,0],   close:[16,0],  countryId:604, currency:'PEN', region:'AMERICAS',   index:'S&P BVL',     listedCos:270,  mktCapB:90,   topStocks:['ALICORC1.LM','BACKUSI1.LM'] },
  { id:'STGO',  abbr:'SCL',  name:'Santiago Stock Exchange',          city:'Santiago',     country:'Chile',       lat:-33.4489, lon:-70.6693, tz:'America/Santiago',               open:[9,30],  close:[16,0],  countryId:152, currency:'CLP', region:'AMERICAS',   index:'IPSA',        listedCos:220,  mktCapB:230,  topStocks:['SQM-B.SN','FALABELLA.SN','COPEC.SN'] },
]

const COUNTRY_TO_EXCHANGE = {}
for (const ex of EXCHANGES) {
  if (ex.countryId && !COUNTRY_TO_EXCHANGE[ex.countryId]) COUNTRY_TO_EXCHANGE[ex.countryId] = ex.id
}

// ─── Chokepoints ──────────────────────────────────────────────────────────────

const CHOKEPOINTS = [
  {
    name:'Strait of Hormuz', lat:26.5,  lon:56.5,  status:'MONITORED',
    keywords:['Iran','Hormuz','Persian Gulf','tanker'],
    cargoValue:'US$1.2B/day',  commodity:'Crude Oil / LNG',
    note:'20% of global oil transit — US-Iran tensions elevated, IRGC harassment incidents',
    impact:'~35Mt crude oil/day',
    history:'Disrupted 1980-88 (Tanker War), 2019 (Iran seizures). AU imports ~60% Middle East crude.',
    asxStocks:['WDS.AX','STO.AX','BPT.AX','VEA.AX'],
    asxNote:'AU energy companies with Middle East LNG exposure',
  },
  {
    name:'Suez Canal', lat:30.4, lon:32.3, status:'DISRUPTED',
    keywords:['Suez','Red Sea','Houthi','Yemen','Bab-el-Mandeb'],
    cargoValue:'US$12B/day',   commodity:'Mixed Cargo / Container',
    note:'Houthi attacks forcing rerouting via Cape of Good Hope — +10-14 day transit',
    impact:'~15% of global trade',
    history:'Blocked 1967-75 (Six-Day War). Current Houthi campaign since Nov 2023 adds A$1,500-2,000/TEU.',
    asxStocks:['MQG.AX','BXB.AX','WTC.AX','QAN.AX'],
    asxNote:'AU logistics, freight, and airline stocks exposed to cost inflation',
  },
  {
    name:'Strait of Malacca', lat:2.5, lon:101.0, status:'OPEN',
    keywords:['Malacca','piracy','Singapore strait','Indonesia'],
    cargoValue:'US$5.3B/day',  commodity:'Oil / LNG / Container',
    note:'Normal operations — key corridor for AU iron ore/LNG to northeast Asia',
    impact:'~25% of traded goods',
    history:'Piracy peak 2003-04 — now patrol by Littoral Security Initiative. AU iron ore, coal, LNG transit daily.',
    asxStocks:['BHP.AX','RIO.AX','FMG.AX','WDS.AX'],
    asxNote:'AU bulk commodity exporters: critical transit route for China-bound shipments',
  },
  {
    name:'Panama Canal', lat:9.1, lon:-79.7, status:'OPEN',
    keywords:['Panama Canal','drought','congestion','vessel'],
    cargoValue:'US$270B/year', commodity:'Container / LNG / Bulk',
    note:'Water levels recovering after 2024-25 drought disruption — canal at normal capacity',
    impact:'~6% of global trade',
    history:'2024 drought restricted to 24 ships/day (from 36). LNG prices spiked 18% during restrictions.',
    asxStocks:['WDS.AX','BXB.AX','AMC.AX'],
    asxNote:'AU LNG exporters and packaging companies with US-Asia container flow exposure',
  },
  {
    name:'Taiwan Strait', lat:25.0, lon:121.0, status:'MONITORED',
    keywords:['Taiwan','PLAN','China military','Taiwan strait','exercises'],
    cargoValue:'US$5.5T/year',  commodity:'Semiconductor / Container',
    note:'PLA exercise activity intermittent — critical semiconductor supply route',
    impact:'50% global chip production',
    history:'1995-96 Third Taiwan Crisis. Blockade scenario would cut ~92% of advanced chips globally for 6-12 months.',
    asxStocks:['WTC.AX','XRO.AX','CPU.AX','TNE.AX'],
    asxNote:'AU tech companies dependent on semiconductor supply chains through Taiwan',
  },
  {
    name:'Bosphorus Strait', lat:41.1, lon:29.0, status:'OPEN',
    keywords:['Bosphorus','Black Sea','Turkey strait','Russia grain'],
    cargoValue:'US$1.4B/day',  commodity:'Grain / Oil / Steel',
    note:'Turkey exercising Montreux Convention — Russian warship limits apply',
    impact:'Russian grain exports',
    history:'Closed to warships since Mar 2022 under Montreux. Russian grain exports rerouted. AU wheat prices influenced.',
    asxStocks:['GNC.AX','AWB.AX','ILU.AX'],
    asxNote:'AU grain traders and agricultural companies with global wheat/barley pricing exposure',
  },
  {
    name:'Cape of Good Hope', lat:-34.0, lon:18.5, status:'MONITORED',
    keywords:['Cape','South Africa','rerouting','Good Hope'],
    cargoValue:'US$2.1B/day',  commodity:'Container / Bulk / Oil',
    note:'Traffic surged 350% since Houthi disruptions — port congestion developing',
    impact:'Suez Canal overflow route',
    history:'Main route pre-Suez (1869). Currently handling 500+ extra vessels/month diverted from Red Sea.',
    asxStocks:['MQG.AX','BXB.AX','TCL.AX'],
    asxNote:'Freight cost pass-through to AU logistics, toll infrastructure, and global supply chain operators',
  },
]

// ─── Commodity Flows (for map overlay) ───────────────────────────────────────

// GeoJSON coordinates: [longitude, latitude]
const COMMODITY_FLOWS = [
  { id:'fe-au-cn', from:[133,-25], to:[121,35],  label:'Iron Ore',  color:'#C9A84C', width:3, vol:'155Mt/yr', val:'~A$19B', risk:'LOW',    desc:'Pilbara → Qingdao (62% Fe fines)', src:'Dept Resources 2025-26' },
  { id:'co-au-cn', from:[133,-25], to:[118,31],  label:'Coal',      color:'#6b7280', width:2, vol:'68Mt/yr',  val:'~A$13B', risk:'LOW',    desc:'QLD thermal & coking coal → China', src:'Dept Resources 2025-26' },
  { id:'lng-au-jp',from:[133,-25], to:[138,35],  label:'LNG',       color:'#3b82f6', width:3, vol:'24Mt/yr',  val:'~A$20B', risk:'LOW',    desc:'Woodside/Chevron LNG → Osaka/Nagoya', src:'Dept Resources 2025-26' },
  { id:'co-au-jp', from:[133,-25], to:[138,36],  label:'Coal',      color:'#6b7280', width:2, vol:'52Mt/yr',  val:'~A$9B',  risk:'LOW',    desc:'QLD & NSW coal → Japan power stations', src:'Dept Resources 2025-26' },
  { id:'lng-au-kr',from:[133,-25], to:[128,36],  label:'LNG',       color:'#3b82f6', width:2, vol:'10Mt/yr',  val:'~A$9B',  risk:'LOW',    desc:'APLNG → Incheon terminal', src:'Dept Resources 2025-26' },
  { id:'fe-au-kr', from:[133,-25], to:[130,35],  label:'Iron Ore',  color:'#C9A84C', width:2, vol:'45Mt/yr',  val:'~A$5B',  risk:'LOW',    desc:'Pilbara → POSCO Pohang', src:'Dept Resources 2025-26' },
  { id:'co-au-in', from:[133,-25], to:[77,20],   label:'Coal',      color:'#6b7280', width:2, vol:'48Mt/yr',  val:'~A$6B',  risk:'MEDIUM', desc:'QLD coal → Mundra / Dahej', src:'Dept Resources 2025-26' },
  { id:'oil-me-as',from:[51,26],   to:[121,30],  label:'Crude Oil', color:'#ef4444', width:4, vol:'17Mb/day', val:'~A$1.4B/day', risk:'HIGH', desc:'Middle East crude → China/Japan/Korea via Hormuz', src:'IEA 2025' },
  { id:'fe-br-cn', from:[-50,-15], to:[122,28],  label:'Iron Ore',  color:'#f97316', width:3, vol:'205Mt/yr', val:'~A$24B', risk:'LOW',    desc:'Carajás Mine → Qingdao via Atlantic-Cape', src:'Vale 2025-26' },
  { id:'soy-br-cn',from:[-55,-12], to:[121,30],  label:'Soybeans',  color:'#84cc16', width:2, vol:'90Mt/yr',  val:'~A$58B', risk:'LOW',    desc:'Mato Grosso → Qingdao — China 65% of Brazil soy exports', src:'Abiove 2025-26' },
  { id:'gas-ru-cn',from:[90,60],   to:[110,40],  label:'Gas/Oil',   color:'#dc2626', width:2, vol:'40bcm/yr', val:'~A$16B', risk:'MEDIUM', desc:'Power of Siberia — post-2022 EU redirect to China', src:'IEA 2025' },
  { id:'lng-us-gl',from:[-90,30],  to:[138,35],  label:'LNG',       color:'#a78bfa', width:2, vol:'95Mt/yr',  val:'~A$65B', risk:'LOW',    desc:'US Gulf Coast LNG → Asia/Europe — Sabine Pass/Freeport', src:'FERC 2025-26' },
]

// ─── Geographic Markers ───────────────────────────────────────────────────────

const MAJOR_PORTS = [
  { name:'Shanghai',    lat:31.2,  lon:121.5, type:'port',    rank:1  },
  { name:'Singapore',   lat:1.26,  lon:103.8, type:'port',    rank:2  },
  { name:'Rotterdam',   lat:51.9,  lon:4.5,   type:'port',    rank:3  },
  { name:'Ningbo',      lat:29.9,  lon:121.6, type:'port',    rank:4  },
  { name:'Busan',       lat:35.1,  lon:129.1, type:'port',    rank:5  },
  { name:'Shenzhen',    lat:22.5,  lon:114.1, type:'port',    rank:6  },
  { name:'Guangzhou',   lat:22.6,  lon:113.7, type:'port',    rank:7  },
  { name:'Dubai',       lat:25.3,  lon:55.4,  type:'port',    rank:8  },
  { name:'Port Hedland',lat:-20.3, lon:118.6, type:'port',    rank:9  },
  { name:'Sydney',      lat:-33.9, lon:151.2, type:'port',    rank:10 },
  { name:'Los Angeles', lat:33.7,  lon:-118.2,type:'port',    rank:11 },
  { name:'Hamburg',     lat:53.5,  lon:10.0,  type:'port',    rank:12 },
]

const MAJOR_AIRPORTS = [
  { name:'Dubai (DXB)',  lat:25.25, lon:55.37, vol:'88M pax',  type:'hub' },
  { name:'Singapore (SIN)',lat:1.36,lon:103.99,vol:'67M pax',  type:'hub' },
  { name:'London (LHR)', lat:51.48, lon:-0.46, vol:'79M pax',  type:'hub' },
  { name:'JFK',          lat:40.64, lon:-73.78,vol:'62M pax',  type:'hub' },
  { name:'LAX',          lat:33.94, lon:-118.4,vol:'88M pax',  type:'hub' },
  { name:'Sydney (SYD)', lat:-33.94,lon:151.18,vol:'44M pax',  type:'hub' },
  { name:'Hong Kong (HKG)',lat:22.31,lon:113.91,vol:'38M pax', type:'hub' },
  { name:'Memphis (MEM)',lat:35.04, lon:-89.98,vol:'4.4M T',   type:'cargo'},
  { name:'Frankfurt (FRA)',lat:50.03,lon:8.57,  vol:'60M pax', type:'hub' },
]

// ─── Air Trade Routes ──────────────────────────────────────────────────────────

const AIR_TRADE_ROUTES = [
  // Gold — AU origin/destination
  { id:'syd-sin', label:'Sydney → Singapore', from:[151.2,-33.9], to:[103.8,1.3],  color:'#C9A84C', type:'gold',
    dailyFlights:28, carriers:['Qantas','Singapore Airlines','Scoot'], cargoSplit:'35% cargo',
    auNote:'Primary gateway for AU exports to SE Asia. Top commodities: fresh produce, medical supplies, manufactured goods.' },
  { id:'syd-hkg', label:'Sydney → Hong Kong',  from:[151.2,-33.9], to:[114.2,22.3], color:'#C9A84C', type:'gold',
    dailyFlights:14, carriers:['Cathay Pacific','Qantas'], cargoSplit:'40% cargo',
    auNote:'Key AU–China freight corridor. Electronics, consumer goods inbound; food/resources outbound.' },
  { id:'syd-dxb', label:'Sydney → Dubai',       from:[151.2,-33.9], to:[55.4,25.3],  color:'#C9A84C', type:'gold',
    dailyFlights:21, carriers:['Emirates','Qantas'], cargoSplit:'30% cargo',
    auNote:'Transhipped hub for Europe/Middle East freight. Emirates operates largest AU capacity.' },
  { id:'mel-lax', label:'Melbourne → Los Angeles', from:[144.9,-37.8], to:[-118.4,33.9], color:'#C9A84C', type:'gold',
    dailyFlights:10, carriers:['Qantas','United'], cargoSplit:'25% cargo',
    auNote:'Longest non-stop AU route. Key corridor for AU–US trade in pharma, luxury goods, beef.' },
  // Blue — major international corridors
  { id:'sin-lhr', label:'Singapore → London',  from:[103.8,1.3],  to:[-0.5,51.5],  color:'#3b82f6', type:'blue',
    dailyFlights:18, carriers:['Singapore Airlines','British Airways'], cargoSplit:'38% cargo',
    auNote:'Major transhipment route for AU exports reaching Europe via Singapore hub.' },
  { id:'dxb-lhr', label:'Dubai → London',      from:[55.4,25.3],  to:[-0.5,51.5],  color:'#3b82f6', type:'blue',
    dailyFlights:42, carriers:['Emirates','flydubai','British Airways'], cargoSplit:'28% cargo',
    auNote:'World\'s busiest long-haul route. Dubai serves as primary hub for AU–Europe connections.' },
  { id:'jfk-lhr', label:'New York → London',   from:[-73.8,40.6], to:[-0.5,51.5],  color:'#3b82f6', type:'blue',
    dailyFlights:55, carriers:['British Airways','American','Delta','Virgin Atlantic'], cargoSplit:'22% cargo',
    auNote:'Highest-frequency transatlantic route. Critical for AU trade with North Atlantic markets.' },
  { id:'hkg-jfk', label:'Hong Kong → New York', from:[114.2,22.3], to:[-73.8,40.6], color:'#3b82f6', type:'blue',
    dailyFlights:12, carriers:['Cathay Pacific','American'], cargoSplit:'45% cargo',
    auNote:'Key transpacific cargo corridor. AU goods transhipped via HKG reach US east coast here.' },
  // Teal — cargo-heavy routes
  { id:'nrt-lax', label:'Tokyo → Los Angeles', from:[139.8,35.7], to:[-118.4,33.9], color:'#14b8a6', type:'teal',
    dailyFlights:20, carriers:['ANA','JAL','United'], cargoSplit:'55% cargo',
    auNote:'Heavy electronics/automotive parts flow. AU exports (beef, seafood) move via NRT to US.' },
  { id:'sin-bom', label:'Singapore → Mumbai',  from:[103.8,1.3],  to:[72.9,19.1],  color:'#14b8a6', type:'teal',
    dailyFlights:16, carriers:['IndiGo','Air India','Singapore Airlines'], cargoSplit:'50% cargo',
    auNote:'Fast-growing India–ASEAN cargo corridor. AU perishables increasingly transshipped here.' },
]

// lat/lon for projection([lon, lat])
const CONFLICT_ZONES = [
  { name:'Ukraine war',          lat:49.0, lon:32.0,  color:'#ff1744', radius:8 },
  { name:'Gaza / West Bank',     lat:31.5, lon:34.8,  color:'#ff1744', radius:5 },
  { name:'Yemen / Red Sea',      lat:15.5, lon:44.0,  color:'#ff6d00', radius:6 },
  { name:'Sudan',                lat:15.5, lon:32.5,  color:'#ff1744', radius:6 },
  { name:'Syria',                lat:35.0, lon:38.5,  color:'#ff6d00', radius:4 },
  { name:'Myanmar',              lat:19.8, lon:96.1,  color:'#ff6d00', radius:4 },
  { name:'Taiwan Strait',        lat:24.5, lon:120.5, color:'#f59e0b', radius:5 },
]

const SHIPPING_LANES = [
  // Major sea routes (polylines of [lon, lat])
  { id:'transpacific', pts:[[-118.2,33.7],[160,35],[140,35],[135,34],[130,35]] },
  { id:'europe-suez',  pts:[[4.5,51.9],[2.3,51.5],[-0.1,51.5],[-5,36],[32.3,30.4],[43,12.5],[51,23],[57,21],[72,21],[79,9],[103.8,1.3]] },
  { id:'au-asia',      pts:[[115,-20],[105,0],[103.8,1.3],[110,20],[121,30]] },
  { id:'au-me',        pts:[[115,-20],[80,10],[55,23],[50,26]] },
  { id:'cape-route',   pts:[[18.5,-34],[0,-30],[-5,36]] },
]

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
const isSoonSt   = st => st === 'OPENING_SOON' || st === 'CLOSING_SOON'
const STATUS_LABEL = { OPEN:'OPEN', CLOSING_SOON:'CLOSING SOON', OPENING_SOON:'OPENING SOON', CLOSED:'CLOSED' }
const STATUS_CLS   = {
  OPEN:         'text-terminal-green',
  CLOSING_SOON: 'text-terminal-gold',
  OPENING_SOON: 'text-terminal-gold',
  CLOSED:       'text-terminal-text-dim',
}
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

// ─── Dynamic chokepoint status from live news ────────────────────────────────
// cp.status in CHOKEPOINTS is the last-known baseline. Live news can escalate
// it to DISRUPTED or de-escalate it back to OPEN; with no fresh signal we keep
// the baseline rather than guessing.
const CHOKE_DISRUPT_RE = /block|clos|attack|strikes?|halt|suspend|sink|seiz|explod|sank/i
const CHOKE_REOPEN_RE  = /reopen|resum|lift(ed|s)?|clear(ed)?|restor|normal/i

function computeChokeStatus(cp, related) {
  if (!related.length) return cp.status
  const text = related.map((r) => `${r.headline} ${r.summary ?? ''}`).join(' ').toLowerCase()
  if (CHOKE_REOPEN_RE.test(text))  return 'OPEN'
  if (CHOKE_DISRUPT_RE.test(text)) return 'DISRUPTED'
  return 'MONITORED'
}

function timeAgo(date) {
  if (!date) return null
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Dynamic conflict-zone severity from live news ───────────────────────────
const ZONE_KEYWORDS = {
  'Ukraine war':      /ukraine|kyiv|zelensky|kharkiv|zaporizhzhia/i,
  'Gaza / West Bank': /gaza|west bank|hamas|israel|idf/i,
  'Yemen / Red Sea':  /yemen|houthi|red sea|hormuz/i,
  Sudan:              /sudan|khartoum|rsf\b/i,
  Syria:              /\bsyria\b|damascus/i,
  Myanmar:            /myanmar|burma|rohingya/i,
  'Taiwan Strait':    /taiwan|pla\b|china military|taiwan strait/i,
}
const SEVERITY_TO_COLOR  = { CRITICAL: '#ff1744', HIGH: '#ff6d00', MEDIUM: '#f59e0b', LOW: '#4A6080' }
const SEVERITY_TO_RADIUS = { CRITICAL: 9, HIGH: 7, MEDIUM: 5, LOW: 4 }

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

const FALLBACK_AUD_USD = 0.6520

function fmtGdpTotal(usdMillions, audUsd, mode) {
  if (usdMillions == null) return null
  const v = mode === 'AUD' ? usdMillions / audUsd : usdMillions
  const sym = mode === 'AUD' ? 'A$' : 'US$'
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(2)}T`
  if (v >= 1_000)     return `${sym}${(v / 1_000).toFixed(1)}B`
  return `${sym}${v.toFixed(0)}M`
}

function fmtPerCapita(usd, audUsd, mode) {
  if (usd == null) return null
  const v = mode === 'AUD' ? usd / audUsd : usd
  const sym = mode === 'AUD' ? 'A$' : 'US$'
  return `${sym}${Math.round(v).toLocaleString('en-AU')}`
}

function fmtAuTrade(audMillions, audUsd, mode) {
  if (audMillions == null) return null
  // auTradeValue stored in AUD millions — convert to USD if needed
  const v = mode === 'USD' ? audMillions * audUsd : audMillions
  const sym = mode === 'USD' ? 'US$' : 'A$'
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(2)}T`
  if (v >= 1_000)     return `${sym}${(v / 1_000).toFixed(1)}B`
  return `${sym}${v.toFixed(0)}M`
}

function FreshnessDot({ status }) {
  if (status === 'fresh')     return <span title="Live data (≤7 days)" style={{ color: '#22c55e', fontSize: 9 }}>●</span>
  if (status === 'stale')     return <span title="Stale data (>7 days)" style={{ color: '#fbbf24', fontSize: 9 }}>●</span>
  return <span title="Hardcoded data" style={{ color: '#6b7280', fontSize: 9 }}>●</span>
}

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
    setTime(fmt())
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [fmt])
  return time
}

function fmtPop(p) {
  if (p == null) return null
  if (p >= 1_000_000_000) return `${(p / 1e9).toFixed(2)}B`
  if (p >= 1_000_000)     return `${(p / 1e6).toFixed(1)}M`
  if (p >= 1_000)         return `${(p / 1e3).toFixed(0)}K`
  return p.toLocaleString()
}

// ─── Country Panel ────────────────────────────────────────────────────────────

// Helper: row with label + value, always rendered
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

function CountryPanel({ id, newsItems, audRates, audUsd = FALLBACK_AUD_USD, currencyMode = 'AUD', onCurrencyToggle, onClose, onAskAI }) {
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
  const pop         = enriched?.population ?? null
  const area        = enriched?.area ?? null
  const region      = enriched?.region ?? null
  const currCode    = detail?.currency ?? enriched?.currency?.code ?? null
  const currName    = enriched?.currency?.name ?? null
  const languages   = enriched?.languages ?? null
  const govType     = enriched?.governmentType ?? null

  // Economy
  const gdpTotal    = enriched?.gdpTotal    ?? null
  const gdpPerCap   = enriched?.gdpPerCapita ?? null
  const gdpGrowth   = detail?.macro?.gdp   ?? enriched?.gdpGrowth   ?? null
  const gdpLbl      = detail?.macro?.gdpLbl ?? null
  const inflation   = detail?.macro?.cpi   ?? enriched?.inflation   ?? null
  const inflLbl     = detail?.macro?.cpiLbl ?? null
  const intRate     = detail?.macro?.rate  ?? enriched?.interestRate ?? null
  const intRateLbl  = detail?.macro?.rateLbl ?? null
  const intRateBank = enriched?.interestRateBank ?? null
  const unemployment = enriched?.unemployment ?? null

  // Trade
  const topExports  = enriched?.topExports         ?? null
  const topImports  = enriched?.topImports         ?? null
  const partners    = detail?.partners ?? enriched?.topTradingPartners ?? null
  const auTrade     = extra?.auTrade   ?? enriched?.auRelationship ?? null
  const auTradeVal  = enriched?.auTradeValue        ?? null

  // Exchange
  const exName      = detail?.exchange ?? null
  const exIndex     = detail?.index    ?? null

  // Risk
  const creditRating     = enriched?.creditRating     ?? null
  const polStability     = enriched?.politicalStability ?? null
  const econOutlook      = enriched?.economicOutlook    ?? null
  const sanctionsStatus  = enriched?.sanctionsStatus    ?? null
  const conflictStatus   = enriched?.conflictStatus     ?? null
  const description      = extra?.economy ?? enriched?.description ?? null
  const dataAsAt         = dbEntry?.dataAsAt ?? null

  const isConflict = CONFLICT_COUNTRIES.has(n)
  const isStress   = STRESS_COUNTRIES.has(n)
  const isPartner  = PARTNER_COUNTRIES.has(n)
  const riskRating = getRiskRating(n)
  const hasData    = !!(enriched || detail)

  // ── Trade Intelligence ──
  const routeMap        = COUNTRY_ROUTE_MAP[n] ?? { shipping: [], freight: [] }
  const shippingRoutes   = routeMap.shipping.map(id => findRoute(id, 'SHIPPING')).filter(Boolean)
  const freightRoutes    = routeMap.freight.map(id => findRoute(id, 'FREIGHT')).filter(Boolean)
  const disruptedRoutes  = shippingRoutes.filter(r => r.status === 'DISRUPTED' || r.status === 'CONGESTED')
  const enhancedPartners = (partners ?? []).slice(0, 5).map(p => ({ name: p, flag: flagForPartnerName(p), ...partnerTradeStats(n, p) }))
  const riskyPartnerCount = (partners ?? []).filter(p => {
    const pid = NAME_TO_ID[p]
    return pid != null && (CONFLICT_COUNTRIES.has(pid) || STRESS_COUNTRIES.has(pid))
  }).length
  const tradeRiskScore = computeTradeRiskScore({ riskRating, hasDisruptedRoute: disruptedRoutes.length > 0, riskyPartnerCount })
  const riskScoreColors = riskScoreColor(tradeRiskScore)

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
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text text-sm">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* ── Status badges ── */}
        <div className="px-3 py-2 border-b border-terminal-border/50">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {isConflict && <span className="text-2xs px-1.5 py-0.5 bg-terminal-red/20 text-terminal-red border border-terminal-red/30">⚠ CONFLICT ZONE</span>}
            {isStress && !isConflict && <span className="text-2xs px-1.5 py-0.5 bg-orange-900/20 text-orange-400 border border-orange-400/30">⚠ SANCTIONED</span>}
            {isPartner && <span className="text-2xs px-1.5 py-0.5 bg-terminal-green/10 text-terminal-green border border-terminal-green/30">★ AU TRADE PARTNER</span>}
            <span className={`text-2xs px-1.5 py-0.5 border border-current/30 ${RISK_COLOR[riskRating] ?? 'text-terminal-text-dim'}`}>RISK: {riskRating}</span>
          </div>
          <button
            onClick={() => onAskAI({
              name,
              exchange:    exName,
              sector:      region,
              date:        todayAEST(),
              instruction: `Provide a professional analysis of ${name} for Australian investors. Include: economic outlook, key risks, trade relationship with Australia, ASX stocks with exposure, and AUD implications.`,
            })}
            className="text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >ASK AI ◆</button>
        </div>

        {/* ── Quick Stats — 4-box at-a-glance row ── */}
        {hasData && (
          <div className="grid grid-cols-4 border-b border-terminal-border/50 text-center">
            {[
              ['Population',   fmtPop(pop)],
              ['GDP',          fmtGdpTotal(gdpTotal, audUsd, currencyMode)],
              ['Unemployment', unemployment != null ? `${unemployment}%` : null],
              ['Inflation',    inflation != null ? `${inflation}%` : null],
            ].map(([label, value]) => (
              <div key={label} className="py-1.5 px-1 border-r border-terminal-border/50 last:border-r-0">
                <div className="text-xs font-bold text-terminal-text-bright">{value ?? '—'}</div>
                <div className="text-2xs text-terminal-text-dim/70">{label}</div>
              </div>
            ))}
          </div>
        )}

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
          <PRow label="Population" value={fmtPop(pop)} />
          <PRow label="Area"       value={area != null ? `${area.toLocaleString('en-AU')} km²` : null} />
          <PRow label="Region"     value={region} />
          <PRow label="Currency"   value={currCode ? `${currCode}${currName ? ` — ${currName}` : ''}` : null} />
          <PRow label="Languages"  value={languages?.length ? languages.join(', ') : null} />
          <PRow label="Government" value={govType} />
          <PRow label="Neighbours" value={enriched?.neighbours?.length ? enriched.neighbours.join(', ') : null} />
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
          {sec('Macro Statistics')}
          {/* GDP Total — dual currency */}
          <div className="flex justify-between text-2xs py-0.5">
            <span className="text-terminal-text-dim">GDP Total</span>
            {gdpTotal != null
              ? <div className="text-right">
                  <span className="font-bold text-terminal-text-bright">{fmtGdpTotal(gdpTotal, audUsd, currencyMode)}</span>
                  <span className="text-terminal-text-dim/50 ml-1.5">({fmtGdpTotal(gdpTotal, audUsd, currencyMode === 'AUD' ? 'USD' : 'AUD')})</span>
                </div>
              : <span className="text-terminal-text-bright">—</span>
            }
          </div>
          {/* GDP Per Capita — dual currency */}
          <div className="flex justify-between text-2xs py-0.5">
            <span className="text-terminal-text-dim">GDP / Capita</span>
            {gdpPerCap != null
              ? <div className="text-right">
                  <span className="font-bold text-terminal-text-bright">{fmtPerCapita(gdpPerCap, audUsd, currencyMode)}</span>
                  <span className="text-terminal-text-dim/50 ml-1.5">({fmtPerCapita(gdpPerCap, audUsd, currencyMode === 'AUD' ? 'USD' : 'AUD')})</span>
                </div>
              : <span className="text-terminal-text-bright">—</span>
            }
          </div>
          <div className="flex justify-between text-2xs py-0.5">
            <span className="text-terminal-text-dim">GDP Growth</span>
            <div className="text-right">
              {gdpGrowth != null
                ? <span className={`font-bold ${gdpGrowth >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>{gdpGrowth >= 0 ? '+' : ''}{gdpGrowth}%</span>
                : <span className="text-terminal-text-bright">—</span>
              }
              {gdpLbl && <span className="text-terminal-text-dim/60 ml-1">{gdpLbl}</span>}
            </div>
          </div>
          <div className="flex justify-between text-2xs py-0.5">
            <span className="text-terminal-text-dim">Inflation (CPI)</span>
            <div className="text-right">
              {inflation != null
                ? <span className={`font-bold ${inflation > 4 ? 'text-terminal-red' : inflation > 2.5 ? 'text-terminal-gold' : 'text-terminal-green'}`}>{inflation}%</span>
                : <span className="text-terminal-text-bright">—</span>
              }
              {inflLbl && <span className="text-terminal-text-dim/60 ml-1">{inflLbl}</span>}
            </div>
          </div>
          <div className="flex justify-between text-2xs py-0.5">
            <span className="text-terminal-text-dim">Interest Rate</span>
            <div className="text-right">
              {intRate != null
                ? <span className="text-terminal-blue-bright font-bold">{intRate}%</span>
                : <span className="text-terminal-text-bright">—</span>
              }
              {intRateLbl && <span className="text-terminal-text-dim/60 ml-1">{intRateLbl}</span>}
              {intRateBank && !intRateLbl && <span className="text-terminal-text-dim/60 ml-1">{intRateBank}</span>}
            </div>
          </div>
          <PRow label="Unemployment" value={unemployment != null ? `${unemployment}%` : null} />
          <PRow label="Data as at"   value={dataAsAt} cls="text-terminal-text-dim" />
        </div>

        {/* ── Risk Assessment (GEOPOLITICAL tab) ── */}
        <div className={`px-3 py-2 border-b border-terminal-border/50 ${panelTab === 'geopolitical' ? '' : 'hidden'}`}>
          {sec('Risk Assessment')}
          <PRow label="Political Stability" value={polStability} />
          <PRow label="Economic Outlook"    value={econOutlook} />
          <PRow
            label="Sanctions"
            value={sanctionsStatus ?? 'None'}
            cls={sanctionsStatus && sanctionsStatus !== 'None' && sanctionsStatus !== 'none' ? 'text-terminal-red' : 'text-terminal-green'}
          />
          <PRow
            label="Conflict Status"
            value={conflictStatus ?? 'None'}
            cls={isConflict ? 'text-terminal-red font-bold' : conflictStatus === 'MONITORED' ? 'text-terminal-gold' : 'text-terminal-green'}
          />
          {creditRating && (
            <PRow
              label="Credit Rating"
              value={`${creditRating.moodys ?? 'NR'} / ${creditRating.sp ?? 'NR'} / ${creditRating.fitch ?? 'NR'}`}
              cls="text-terminal-text-dim"
            />
          )}
          {!creditRating && <PRow label="Credit Rating" value={null} />}
        </div>

        {/* ── Trade (TRADE tab) ── */}
        <div className={`px-3 py-2 border-b border-terminal-border/50 ${panelTab === 'trade' ? '' : 'hidden'}`}>
          {sec('Trade')}
          <PRow label="Top Exports" value={topExports?.length ? topExports.slice(0,3).join(', ') : null} />
          <PRow label="Top Imports" value={topImports?.length ? topImports.slice(0,3).join(', ') : null} />
          {/* Trading partners as chips */}
          {partners?.length
            ? <div className="flex justify-between text-2xs py-0.5">
                <span className="text-terminal-text-dim flex-shrink-0">Top Partners</span>
                <div className="flex flex-wrap gap-1 justify-end ml-2">
                  {partners.slice(0,5).map(p => (
                    <span key={p} className="text-2xs px-1 py-0 border border-terminal-border/60 text-terminal-text">{p}</span>
                  ))}
                </div>
              </div>
            : <PRow label="Top Partners" value={null} />
          }
        </div>

        {/* ── AU Relationship (TRADE tab) ── */}
        <div className={`px-3 py-2 border-b border-terminal-border/50 ${panelTab === 'trade' ? '' : 'hidden'}`}>
          {sec('AU Trade Relationship')}
          {auTrade
            ? <div className="text-2xs text-terminal-text leading-relaxed mb-1">{auTrade}</div>
            : <div className="text-2xs text-terminal-text-dim italic">No significant bilateral relationship on record.</div>
          }
          {auTradeVal != null && (
            <div className="flex justify-between text-2xs mt-1 pt-1 border-t border-terminal-border/30">
              <span className="text-terminal-text-dim">AU Bilateral Trade</span>
              <div className="text-right">
                <span className="font-bold text-terminal-text-bright">{fmtAuTrade(auTradeVal, audUsd, currencyMode)}</span>
                <span className="text-terminal-text-dim/50 ml-1.5">({fmtAuTrade(auTradeVal, audUsd, currencyMode === 'AUD' ? 'USD' : 'AUD')})</span>
              </div>
            </div>
          )}
        </div>

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
                  <span className={r.status === 'ACTIVE' ? 'text-terminal-green' : r.status === 'DISRUPTED' ? 'text-terminal-red' : 'text-terminal-gold'}>{r.status}</span>
                </div>
              ))}
              {freightRoutes.map(r => (
                <div key={r.id} className="flex justify-between text-2xs py-0.5">
                  <span className="text-terminal-text">✈ {r.name}</span>
                  <span className="text-terminal-green">ACTIVE</span>
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
                <div key={p.name} className="flex items-center justify-between text-2xs py-0.5">
                  <span className="text-terminal-text">{p.flag} {p.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-terminal-text-dim">A${p.value.toFixed(1)}B</span>
                    <span className={p.balance >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>
                      {p.balance >= 0 ? '+' : ''}{p.balance.toFixed(1)}B
                    </span>
                    <span className={TREND_COLOR[p.trend]} title={p.trend}>{TREND_ARROW[p.trend]}</span>
                  </div>
                </div>
              ))}
              <div className="text-2xs text-terminal-text-dim/40 italic mt-0.5">Illustrative bilateral estimates — value / net balance / trend</div>
            </div>
          )}

          {/* (c) Active disruptions affecting this country */}
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1">Active Disruptions</div>
          {disruptedRoutes.length === 0 ? (
            <div className="text-2xs text-terminal-green/80 mb-2">No active shipping disruptions materially affecting trade to/from {name} at this time.</div>
          ) : (
            <div className="mb-2">
              {disruptedRoutes.map(r => (
                <div key={r.id} className="text-2xs text-terminal-red/90 leading-relaxed mb-1">
                  ⚠ {ROUTE_DISRUPTION_TEXT[r.id] ?? `${r.name} is currently ${r.status.toLowerCase()}.`}
                </div>
              ))}
            </div>
          )}

          {/* (d) Trade risk score */}
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1">Trade Risk Score</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-terminal-border/40 rounded-sm overflow-hidden">
              <div className={`h-full ${riskScoreColors.bar}`} style={{ width: `${tradeRiskScore}%` }} />
            </div>
            <span className={`text-2xs font-bold ${riskScoreColors.text}`}>{tradeRiskScore}/100</span>
          </div>
        </div>

        {/* ── Overview (ECONOMY tab) ── */}
        {description && (
          <div className={`px-3 py-2 border-b border-terminal-border/50 ${panelTab === 'economy' ? '' : 'hidden'}`}>
            {sec('Overview')}
            <div className="text-2xs text-terminal-text leading-relaxed">{description}</div>
          </div>
        )}

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
                    instruction: 'Analyse the market impact of this headline for Australian investors and the ASX.',
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
    return { ...cp, status: computeChokeStatus(cp, related), related, updatedAgo: timeAgo(related[0]?.pubDate) }
  }), [newsItems])

  const disrupted  = chokeStatuses.filter(c => c.status === 'DISRUPTED').length
  const monitored  = chokeStatuses.filter(c => c.status === 'MONITORED').length
  const open       = chokeStatuses.filter(c => c.status === 'OPEN').length
  const totalValue = '$25.4T'

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
      <div className="grid grid-cols-4 border-b border-terminal-border flex-shrink-0 text-center">
        <div className="py-1.5 border-r border-terminal-border">
          <div className="text-xs font-bold text-terminal-gold">{totalValue}</div>
          <div className="text-2xs text-terminal-text-dim">Annual cargo</div>
        </div>
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
          ⚠ ACTIVE DISRUPTION — {chokeStatuses.filter(c => c.status === 'DISRUPTED').map(c => c.name).join(', ')} — Monitor AU energy/commodity exposure
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
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xs text-terminal-gold">{cp.cargoValue}</span>
                  <span className="text-2xs text-terminal-text-dim">· {cp.commodity}</span>
                  {cp.updatedAgo && (
                    <span className="text-2xs text-terminal-text-dim/60 ml-auto">UPDATED {cp.updatedAgo.toUpperCase()}</span>
                  )}
                </div>
              </div>
              <span className="text-terminal-text-dim text-2xs flex-shrink-0">{expanded === cp.name ? '▲' : '▼'}</span>
            </button>

            {expanded === cp.name && (
              <div className="px-4 pb-2 space-y-1.5">
                <div className="text-2xs text-terminal-text-dim">
                  <span className="text-terminal-gold">Impact:</span> {cp.impact}
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
                      instruction: `Analyse the market impact of ${cp.name} (${cp.status}) on Australian investors. Cargo value: ${cp.cargoValue}. ${cp.note}. Key ASX stocks affected: ${cp.asxStocks?.join(', ')}. Include supply chain risks, AU commodity exposure, and freight cost outlook.`,
                    })}
                    className="text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                  >ASK AI</button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="px-3 py-2 border-b border-terminal-border/50">
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1.5">Major Cargo Hubs</div>
          {MAJOR_PORTS.slice(0, 5).map(p => (
            <div key={p.name} className="flex items-center justify-between text-2xs py-0.5">
              <span className="text-terminal-text">▪ {p.name}</span>
              <span className="text-terminal-text-dim">Rank #{p.rank}</span>
            </div>
          ))}
        </div>

        <div className="px-3 py-1 text-2xs text-terminal-text-dim/50">
          Status: Reuters/BBC live news keyword matching · Static fallback: Jun 2026
        </div>
      </div>

      {impactChokepoint && (
        <GeopoliticalImpact chokepoint={impactChokepoint} onClose={() => setImpactChokepoint(null)} />
      )}
    </div>
  )
}

// ─── Tab: Air Trade Routes ────────────────────────────────────────────────────

const TOP_CARGO_ROUTES = [
  { rank:1, route:'Hong Kong → Chicago (ORD)', vol:'1.2M T/yr', trend:'▲', note:'Electronics, pharma' },
  { rank:2, route:'Incheon → Los Angeles',     vol:'1.1M T/yr', trend:'▲', note:'Semiconductors, auto parts' },
  { rank:3, route:'Shanghai → Los Angeles',    vol:'0.95M T/yr', trend:'▲', note:'Consumer goods, e-commerce' },
  { rank:4, route:'Dubai → London (LHR)',      vol:'0.88M T/yr', trend:'—', note:'Re-export hub, mixed cargo' },
  { rank:5, route:'Frankfurt → Chicago',       vol:'0.75M T/yr', trend:'▼', note:'Machinery, automotive' },
]

const TOP_CARGO_AIRPORTS = [
  { name:'Dubai (DXB)',      vol:'5.1M T', rank:1, trend:'▲' },
  { name:'Hong Kong (HKG)', vol:'4.7M T', rank:2, trend:'▲' },
  { name:'Memphis (MEM)',   vol:'4.4M T', rank:3, trend:'—', note:'FedEx hub' },
  { name:'Shanghai (PVG)',  vol:'3.9M T', rank:4, trend:'▲' },
  { name:'Incheon (ICN)',   vol:'3.1M T', rank:5, trend:'▲' },
]

const AU_AIRPORT_CARGO = [
  { name:'Sydney (SYD)',    vol:'624K T', trend:'▲', note:'Largest AU gateway' },
  { name:'Melbourne (MEL)', vol:'415K T', trend:'▲', note:'Growing e-commerce' },
  { name:'Brisbane (BNE)',  vol:'218K T', trend:'▲', note:'Perishables/meat' },
]

const AU_FREIGHT_COMMODITIES = [
  { name:'Electronics',     dir:'IN',  note:'Mobile devices, components from Asia' },
  { name:'Pharmaceuticals', dir:'BOTH',note:'Clinical trials, vaccine cold chain' },
  { name:'Perishables',     dir:'OUT', note:'Beef, seafood, fresh produce to Asia' },
  { name:'Mail & Express',  dir:'BOTH',note:'E-commerce volume surging post-2020' },
  { name:'Automotive',      dir:'IN',  note:'Parts, luxury vehicles from EU/Japan' },
]

function LiveAirTraffic({ flightData }) {
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

function AirTradeRoutesTab({ selectedArc, onArcClick, flightData }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        AIR TRADE ROUTES
        <span className="ml-auto text-2xs text-terminal-text-dim font-normal normal-case">Jun 2026 · ACI/IATA</span>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 border-b border-terminal-border flex-shrink-0 text-center">
        <div className="py-1.5 border-r border-terminal-border">
          <div className="text-xs font-bold text-terminal-gold">10</div>
          <div className="text-2xs text-terminal-text-dim">Routes monitored</div>
        </div>
        <div className="py-1.5 border-r border-terminal-border">
          <div className="text-xs font-bold text-terminal-text-bright">$6.8T</div>
          <div className="text-2xs text-terminal-text-dim">Annual value</div>
        </div>
        <div className="py-1.5">
          <div className="text-xs font-bold text-terminal-green">NORMAL</div>
          <div className="text-2xs text-terminal-text-dim">Status</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto text-2xs">

        {/* Selected arc detail */}
        {selectedArc ? (
          <div className="p-2 border-b border-terminal-border" style={{ borderLeftWidth:3, borderLeftColor: selectedArc.color }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold" style={{ color: selectedArc.color }}>{selectedArc.label}</span>
              <button onClick={() => onArcClick?.(null)} className="text-terminal-text-dim hover:text-terminal-text">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-terminal-text-dim mb-1">
              <div><span className="text-terminal-text-bright">~{selectedArc.dailyFlights}</span> daily flights</div>
              <div><span className="text-terminal-text-bright">{selectedArc.cargoSplit}</span></div>
            </div>
            <div className="text-terminal-text-dim mb-1">
              {selectedArc.carriers.join(' · ')}
            </div>
            <div className="text-terminal-text-dim/80 border-t border-terminal-border/40 pt-1 mt-1">
              {selectedArc.auNote}
            </div>
          </div>
        ) : (
          <div className="p-2 border-b border-terminal-border text-terminal-text-dim/60">
            Click an arc on the globe for route details
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-3 px-2 py-1.5 border-b border-terminal-border">
          <span className="flex items-center gap-1"><span className="w-2 h-1.5 inline-block" style={{background:'#C9A84C'}}/>AU Origin/Dest</span>
          <span className="flex items-center gap-1"><span className="w-2 h-1.5 inline-block" style={{background:'#3b82f6'}}/>Intl Corridor</span>
          <span className="flex items-center gap-1"><span className="w-2 h-1.5 inline-block" style={{background:'#14b8a6'}}/>Cargo Heavy</span>
        </div>

        <LiveAirTraffic flightData={flightData} />

        {/* Top cargo routes globally */}
        <div className="p-2 border-b border-terminal-border">
          <div className="text-terminal-text-dim uppercase mb-1.5 tracking-wider">Top 5 Global Cargo Routes</div>
          {TOP_CARGO_ROUTES.map(r => (
            <div key={r.rank} className="flex items-center justify-between py-0.5 border-b border-terminal-border/20 last:border-0">
              <span className="text-terminal-text-dim w-4 flex-shrink-0">{r.rank}.</span>
              <span className="flex-1 text-terminal-text truncate mr-2">{r.route}</span>
              <span className="text-terminal-gold font-semibold flex-shrink-0 mr-1">{r.vol}</span>
              <span className={r.trend === '▲' ? 'text-terminal-green' : r.trend === '▼' ? 'text-terminal-red' : 'text-terminal-text-dim'}>{r.trend}</span>
            </div>
          ))}
        </div>

        {/* Top cargo airports */}
        <div className="p-2 border-b border-terminal-border">
          <div className="text-terminal-text-dim uppercase mb-1.5 tracking-wider">Top Cargo Airports (2025-26)</div>
          {TOP_CARGO_AIRPORTS.map(a => (
            <div key={a.name} className="flex items-center justify-between py-0.5">
              <span className="text-terminal-text">{a.name}</span>
              <span className="flex items-center gap-1.5">
                <span className="text-terminal-gold font-semibold">{a.vol}</span>
                <span className={a.trend === '▲' ? 'text-terminal-green' : a.trend === '▼' ? 'text-terminal-red' : 'text-terminal-text-dim'}>{a.trend}</span>
              </span>
            </div>
          ))}
        </div>

        {/* AU airport volumes */}
        <div className="p-2 border-b border-terminal-border">
          <div className="text-terminal-text-dim uppercase mb-1.5 tracking-wider">Australian Airports — Cargo</div>
          {AU_AIRPORT_CARGO.map(a => (
            <div key={a.name} className="flex items-center justify-between py-0.5">
              <div>
                <span className="text-terminal-text">{a.name}</span>
                <span className="text-terminal-text-dim/60 ml-2">{a.note}</span>
              </div>
              <span className="text-terminal-gold font-semibold">{a.vol}</span>
            </div>
          ))}
        </div>

        {/* Key AU air freight commodities */}
        <div className="p-2 border-b border-terminal-border">
          <div className="text-terminal-text-dim uppercase mb-1.5 tracking-wider">AU Air Freight Commodities</div>
          {AU_FREIGHT_COMMODITIES.map(c => (
            <div key={c.name} className="flex items-start gap-2 py-0.5">
              <span className={`flex-shrink-0 font-bold ${c.dir === 'IN' ? 'text-terminal-blue-bright' : c.dir === 'OUT' ? 'text-terminal-gold' : 'text-terminal-green'}`}>
                {c.dir === 'IN' ? '↓' : c.dir === 'OUT' ? '↑' : '↕'}
              </span>
              <div>
                <span className="text-terminal-text">{c.name}</span>
                <span className="text-terminal-text-dim/60 ml-2">{c.note}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Freight cost index */}
        <div className="p-2">
          <div className="text-terminal-text-dim uppercase mb-1.5 tracking-wider">Air Freight Cost Index</div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-terminal-gold">127.4</div>
              <div className="text-terminal-text-dim">Jun 2026</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1 text-terminal-green text-xs">▲ +3.2% <span className="text-terminal-text-dim">vs May</span></div>
              <div className="text-terminal-text-dim/60 mt-0.5">Index base = 100 (Jan 2020). Elevated due to fuel costs + demand normalisation.</div>
            </div>
          </div>
          <div className="text-terminal-text-dim/40 mt-2">Source: Freightos Baltic Air Index · hardcoded Jun 2026</div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Commodity Flows ─────────────────────────────────────────────────────

function CommodityFlowsTab({ onAskAI }) {
  const [selected, setSelected] = useState(null)

  const COMMODITY_TABLE = [
    { name:'Iron Ore (62% Fe)',   route:'AU → China',        unit:'USD/t',     price:98.50,  chg:-1.8, src:'Platts, May 2026',   risk:'LOW',    vol:'160Mt/yr', coinId:null },
    { name:'LNG Spot (JKM)',      route:'AU → Japan/Korea',  unit:'USD/MMBtu', price:11.20,  chg:+2.3, src:'Platts, May 2026',   risk:'LOW',    vol:'22Mt/yr',  coinId:null },
    { name:'Thermal Coal (5500)', route:'AU → India/Japan',  unit:'USD/t',     price:114.00, chg:-0.5, src:'Argus, May 2026',    risk:'LOW',    vol:'45Mt/yr',  coinId:null },
    { name:'Coking Coal (HCC)',   route:'AU → China/India',  unit:'USD/t',     price:198.00, chg:+0.8, src:'Argus, May 2026',    risk:'MEDIUM', vol:'70Mt/yr',  coinId:null },
    { name:'Crude Oil (Brent)',   route:'Middle East → Asia', unit:'USD/bbl',  price:76.50,  chg:-0.7, src:'ICE, May 2026',      risk:'HIGH',   vol:'15Mb/day', coinId:null },
    { name:'Iron Ore (IOCJ)',     route:'Brazil → China',    unit:'USD/t',     price:101.00, chg:-0.2, src:'Platts, May 2026',   risk:'LOW',    vol:'200Mt/yr', coinId:null },
    { name:'Soybeans (CBOT)',     route:'Brazil → China',    unit:'USD/bu',    price:10.42,  chg:+0.4, src:'CBOT, May 2026',     risk:'LOW',    vol:'85Mt/yr',  coinId:null },
    { name:'Wheat (SRW CBOT)',    route:'AU/US → SE Asia',   unit:'USD/bu',    price:5.42,   chg:-0.3, src:'CBOT, May 2026',     risk:'LOW',    vol:'30Mt/yr',  coinId:null },
    { name:'Natural Gas (TTF)',   route:'Russia → China',    unit:'EUR/MWh',   price:32.50,  chg:+1.2, src:'TTF Hub, May 2026',  risk:'HIGH',   vol:'38bcm/yr', coinId:null },
    { name:'LNG (US Gulf)',       route:'US → Global',       unit:'USD/MMBtu', price:9.80,   chg:+0.6, src:'Henry Hub+, May 2026',risk:'LOW',   vol:'90Mt/yr',  coinId:null },
  ]

  const riskColor = { LOW:'text-terminal-green', MEDIUM:'text-terminal-gold', HIGH:'text-terminal-red' }

  const atRisk = COMMODITY_TABLE.filter(c => c.risk === 'HIGH').map(c => c.name.split(' ')[0]).join(', ')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        COMMODITY FLOWS
        <span className="ml-auto text-2xs font-normal normal-case text-terminal-text-dim">May 2026</span>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 border-b border-terminal-border flex-shrink-0 text-center">
        <div className="py-1.5 border-r border-terminal-border">
          <div className="text-xs font-bold text-terminal-gold">~A$76B</div>
          <div className="text-2xs text-terminal-text-dim">AU export value/yr</div>
        </div>
        <div className="py-1.5 border-r border-terminal-border">
          <div className="text-xs font-bold text-terminal-red">{atRisk}</div>
          <div className="text-2xs text-terminal-text-dim">Most at-risk</div>
        </div>
        <div className="py-1.5">
          <div className="text-xs font-bold text-terminal-gold">↑ Momentum</div>
          <div className="text-2xs text-terminal-text-dim">LNG, Coal up</div>
        </div>
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
                <div className={`text-2xs font-semibold ${c.chg > 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {c.chg > 0 ? '+' : ''}{c.chg.toFixed(1)}%
                </div>
              </div>
            </div>

            {selected === i && (
              <div className="px-3 pb-2 space-y-1">
                <div className="flex justify-between text-2xs">
                  <span className="text-terminal-text-dim">Volume</span>
                  <span className="text-terminal-gold font-semibold">{c.vol}</span>
                </div>
                <div className="flex justify-between text-2xs">
                  <span className="text-terminal-text-dim">Disruption risk</span>
                  <span className={`font-bold ${riskColor[c.risk]}`}>{c.risk}</span>
                </div>
                <div className="text-2xs text-terminal-text-dim/60">{c.src}</div>
                <button
                  onClick={e => { e.stopPropagation(); onAskAI({
                    name:        c.name,
                    sector:      'Commodities',
                    price:       `${c.unit.startsWith('EUR') ? '€' : 'US$'}${c.price.toFixed(2)}${c.unit.split('/')[1] ? ` /${c.unit.split('/')[1]}` : ''}`,
                    change:      `${c.chg > 0 ? '+' : ''}${c.chg.toFixed(1)}%`,
                    date:        todayAEST(),
                    instruction: `Analyse supply chain disruption risk and market impact for ${c.name} (${c.route}, ${c.vol}).`,
                  }) }}
                  className="mt-1 text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                >ASK AI</button>
              </div>
            )}
          </div>
        ))}

        <div className="px-3 py-1 text-2xs text-terminal-text-dim/50 border-t border-terminal-border">
          Prices: Platts/Argus/CBOT reference · Volumes: Dept Resources 2025-26 · As at Jun 2026
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
              <span className={`text-2xs font-bold ${SEVERITY_COLOR[n.severity]}`}>[{n.severity}]</span>
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
                instruction: 'Analyse the market impact of this headline for Australian investors and the ASX.',
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

function MarketSessionsTab({ now }) {
  const statuses = useMemo(() => EXCHANGES.map(ex => ({
    ...ex,
    status:    getStatus(ex),
    localT:    localTime(ex.tz),
    cd:        countdown(ex),
  })), [now])

  const openCount = statuses.filter(s => isOpenNow(s.status)).length

  // Determine active sessions
  const activeSessions = useMemo(() => SESSIONS.map(s => {
    const local = new Date(new Date().toLocaleString('en-US', { timeZone: s.tz }))
    const day   = local.getDay()
    const mins  = local.getHours() * 60 + local.getMinutes()
    const open  = s.open[0] * 60 + s.open[1]
    const close = s.close[0] * 60 + s.close[1]
    const isOpen = day !== 0 && day !== 6 && mins >= open && mins < close
    return { ...s, isOpen, localT: localTime(s.tz) }
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
  const { data, isLoading } = useQuery({
    queryKey: ['weather', lat, lon],
    queryFn:  () => fetchCurrentWeather(lat, lon),
    staleTime: 30 * 60_000,
    retry: 1,
    enabled: lat != null && lon != null,
  })
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
  if (!ex) return null

  const st = getStatus(ex)
  const lt = localTime(ex.tz)
  const cd = countdown(ex)

  // AEST offset for trading hours
  const openHHMM  = `${String(ex.open[0]).padStart(2,'0')}:${String(ex.open[1]).padStart(2,'0')}`
  const closeHHMM = `${String(ex.close[0]).padStart(2,'0')}:${String(ex.close[1]).padStart(2,'0')}`

  const relatedNews = useMemo(() => {
    if (!newsItems?.articles?.length) return []
    const q = ex.name.toLowerCase().split(' ')[0]
    const re = new RegExp(ex.city + '|' + ex.country + '|' + ex.id, 'i')
    return (newsItems?.articles ?? []).filter(n => re.test(n.headline + ' ' + (n.summary ?? ''))).slice(0, 4)
  }, [newsItems, ex.id])

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
        <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text text-sm">✕</button>
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
                instruction: `Analyse current conditions on the ${ex.name} (${ex.id}) and implications for Australian investors. Consider: current trading session, key listed stocks (${(ex.topStocks ?? []).slice(0,3).join(', ')}), currency (${ex.currency}), and main index (${ex.index}).`,
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
            ['Listed Companies', ex.listedCos ? ex.listedCos.toLocaleString() : '—'],
            ['Market Cap', ex.mktCapB ? `~US$${ex.mktCapB >= 1000 ? (ex.mktCapB/1000).toFixed(1) + 'T' : ex.mktCapB + 'B'}` : '—'],
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

const FEED_EXCHANGE_IDS = ['ASX', 'TSE', 'HKEX', 'LSE', 'NYSE', 'NASDAQ']

// Mock — no live shipping-rate feed wired up yet, same DEMO convention.
// 7D trend values are illustrative; sparkline just needs relative shape.
const SHIPPING_INDEX = [
  { name: 'BALTIC DRY (BDI)', value: 1847, chg: 2.1, trend: [1780, 1795, 1760, 1810, 1830, 1805, 1847] },
  { name: 'FREIGHTOS (FBX)',  value: 3420, chg: -0.8, trend: [3480, 3460, 3510, 3470, 3440, 3455, 3420] },
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
      <path d={path} fill="none" stroke={positive ? 'var(--color-gain, #3aaa63)' : 'var(--color-loss, #a83232)'} strokeWidth={1.25} />
    </svg>
  )
}

// Mock — no live commodities feed wired up yet; matches the DEMO-badge
// convention used across Markets/Rates until a real source is connected.
const COMMODITY_PULSE = [
  { name: 'GOLD',       unit: '/oz',  price: 4821,  chg: 0.34 },
  { name: 'WTI CRUDE',  unit: '/bbl', price: 71.85, chg: -0.62 },
  { name: 'IRON ORE',   unit: '/t',   price: 98.40, chg: 1.05 },
  { name: 'COPPER',     unit: '/lb',  price: 4.31,  chg: 0.28 },
  { name: 'WHEAT',      unit: '/bu',  price: 561,   chg: -0.44 },
]

const FX_CROSS_PAIRS = [
  { key: 'USD', label: 'AUD/USD', dp: 4 },
  { key: 'EUR', label: 'AUD/EUR', dp: 4 },
  { key: 'GBP', label: 'AUD/GBP', dp: 4 },
  { key: 'JPY', label: 'AUD/JPY', dp: 2 },
  { key: 'CNY', label: 'AUD/CNY', dp: 3 },
]

// Reuses COUNTRY_KEYWORDS (already driving GeoRiskTab's region tagging) so
// the gauge tracks the same live news feed instead of inventing a second,
// disconnected notion of "region".
const GEO_RISK_REGIONS = ['China', 'Middle East', 'Russia', 'United States']

// Weights the region's N most severe matching headlines only (not every
// match) — with an unbounded sum, a region name that happens to appear in a
// lot of unrelated headlines would run the gauge to 100 on volume alone
// rather than genuine severity.
const SEVERITY_WEIGHT = { CRITICAL: 22, HIGH: 12, MEDIUM: 5, LOW: 1 }
function regionRiskScore(newsItems, region) {
  const re = COUNTRY_KEYWORDS[region]
  if (!re || !newsItems?.length) return 12
  const weights = newsItems
    .filter(n => re.test(`${n.headline} ${n.summary ?? ''}`))
    .map(n => SEVERITY_WEIGHT[detectSeverity(`${n.headline} ${n.summary ?? ''}`)])
    .sort((a, b) => b - a)
    .slice(0, 5)
  return Math.min(100, 12 + weights.reduce((a, b) => a + b, 0))
}
function riskGaugeColor(score) {
  if (score >= 70) return 'bg-terminal-red'
  if (score >= 40) return 'bg-terminal-gold'
  return 'bg-terminal-green'
}

function FeedHeader({ children, badge }) {
  return (
    <div className="panel-header flex items-center justify-between flex-shrink-0">
      <span>{children}</span>
      {badge && <span className="text-[8px] text-terminal-gold/70 font-normal normal-case tracking-normal">{badge}</span>}
    </div>
  )
}

function IntelFeedPanel({ newsItems, audRates, onSelectExchange }) {
  const alerts = useMemo(() => {
    if (!newsItems?.length) return []
    return newsItems
      .map(n => ({ ...n, severity: detectSeverity(`${n.headline} ${n.summary ?? ''}`) }))
      .filter(n => n.severity === 'CRITICAL' || n.severity === 'HIGH')
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 4)
  }, [newsItems])

  const feedExchanges = useMemo(
    () => FEED_EXCHANGE_IDS.map(id => EXCHANGES.find(e => e.id === id)).filter(Boolean),
    []
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden hide-scrollbar">
      <div className="flex-shrink-0 border-b border-terminal-border">
        <FeedHeader>MARKET STATUS</FeedHeader>
        <div className="px-2 py-1">
          {feedExchanges.map(ex => {
            const st = getStatus(ex)
            const cd = countdown(ex)
            return (
              <button
                key={ex.id}
                onClick={() => onSelectExchange(ex.id)}
                className="w-full flex items-center justify-between py-1 px-1 -mx-1 rounded-[2px] hover:bg-terminal-accent/10 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT_CLS[st]}`} />
                  <span className="text-2xs text-terminal-text-bright font-semibold">{ex.abbr}</span>
                </span>
                <span className="text-right">
                  <div className={`text-2xs font-semibold ${STATUS_CLS[st]}`}>{STATUS_LABEL[st]}</div>
                  {cd && <div className="text-[9px] text-terminal-text-dim">{cd}</div>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-terminal-border">
        <FeedHeader>ACTIVE ALERTS</FeedHeader>
        <div className="px-2 py-1.5 flex flex-col gap-1.5">
          {alerts.length === 0 && (
            <div className="text-2xs text-terminal-text-dim/60 py-1">No active disruptions</div>
          )}
          {alerts.map((a, i) => (
            <div
              key={a.id ?? i}
              onClick={() => a.link && window.open(a.link, '_blank', 'noopener')}
              className={`px-2 py-1.5 border-l-2 text-2xs leading-snug cursor-pointer text-terminal-text-bright ${
                a.severity === 'CRITICAL' ? 'border-l-terminal-red bg-terminal-red/10' : 'border-l-orange-500 bg-orange-500/10'
              }`}
            >
              {a.headline}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-terminal-border">
        <FeedHeader badge="● DEMO">SHIPPING INDEX</FeedHeader>
        <div className="px-2 py-1">
          {SHIPPING_INDEX.map((s) => (
            <div key={s.name} className="flex items-center justify-between py-1 gap-2">
              <span className="text-2xs text-terminal-text-dim flex-shrink-0">{s.name}</span>
              <Sparkline points={s.trend} positive={s.chg >= 0} />
              <span className="flex items-center gap-1 flex-shrink-0">
                <span className="text-2xs text-terminal-text-bright tabular-nums">{s.value.toLocaleString()}</span>
                <span className={`text-2xs tabular-nums w-11 text-right ${s.chg >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {s.chg >= 0 ? '▲' : '▼'}{Math.abs(s.chg).toFixed(1)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-terminal-border">
        <FeedHeader badge="● DEMO">COMMODITY PULSE</FeedHeader>
        <div className="px-2 py-1">
          {COMMODITY_PULSE.map(c => (
            <div key={c.name} className="flex items-center justify-between py-1">
              <span className="text-2xs text-terminal-text-dim">{c.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-2xs text-terminal-text-bright tabular-nums">{c.price.toLocaleString()}{c.unit}</span>
                <span className={`text-2xs tabular-nums w-12 text-right ${c.chg >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {c.chg >= 0 ? '▲' : '▼'}{Math.abs(c.chg).toFixed(2)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-terminal-border">
        <FeedHeader>CURRENCY CROSS</FeedHeader>
        <div className="px-2 py-1">
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
      </div>

      <div className="flex-shrink-0">
        <FeedHeader>GEO RISK INDEX</FeedHeader>
        <div className="px-2 py-1.5 flex flex-col gap-2">
          {GEO_RISK_REGIONS.map(region => {
            const score = regionRiskScore(newsItems, region)
            return (
              <div key={region}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-2xs text-terminal-text-dim uppercase">{region}</span>
                  <span className="text-2xs text-terminal-text-bright tabular-nums">{score}</span>
                </div>
                <div className="w-full h-1 bg-terminal-surface2 rounded-full overflow-hidden">
                  <div className={`h-full ${riskGaugeColor(score)}`} style={{ width: `${score}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── RIGHT empty-state: world stats summary ────────────────────────────────

function StatBlock({ label, value, accent }) {
  return (
    <div className="border border-terminal-border px-2.5 py-2">
      <div className={`text-lg font-bold tabular-nums ${accent ?? 'text-terminal-text-bright'}`}>{value}</div>
      <div className="text-[9px] text-terminal-text-dim tracking-wide uppercase mt-0.5">{label}</div>
    </div>
  )
}

function WorldStatsSummary({ newsItems }) {
  const openCount = useMemo(() => EXCHANGES.filter(ex => isOpenNow(getStatus(ex))).length, [])
  const avgRisk = useMemo(() => {
    const scores = GEO_RISK_REGIONS.map(r => regionRiskScore(newsItems, r))
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }, [newsItems])

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
        <StatBlock label="Avg Geo Risk" value={avgRisk} accent={avgRisk >= 40 ? 'text-terminal-gold' : 'text-terminal-green'} />
      </div>
    </div>
  )
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export default function GlobalModule() {
  const [now, setNow] = useState(
    () => new Date().toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' AEST'
  )
  const [nowMs, setNowMs] = useState(0)
  const [activeTab, setActiveTab]     = useState('summary')
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [selectedExchange, setSelectedExchange] = useState(null)
  const [selectedArc, setSelectedArc] = useState(null)
  // Mobile only (<768px) — the feed/globe/detail columns stack instead of
  // sitting side by side, so a small screen needs an explicit switcher.
  const [mobilePanel, setMobilePanel] = useState('globe')
  // 'map' | 'classic' | 'globe3d'. Replaces the previous globe3D boolean,
  // which only had two states.
  //
  // Default is deliberately 'classic', NOT the new intelligence map: in
  // testing the map's basemap tiles (tiles.basemaps.cartocdn.com — a
  // different host from the style JSON, which does load) never painted, so
  // defaulting to it would have replaced a working globe with a black panel.
  // The map is one click away and fully functional for every data layer we
  // draw ourselves. Flip this to 'map' once tile loading is confirmed.
  const [viewMode, setViewMode] = useState('classic')
  const { watchlist } = useStore()

  const { rates } = useAudRates()
  const audUsd = rates?.USD ?? FALLBACK_AUD_USD

  // Currency mode (AUD vs USD) — persisted to localStorage
  const [currencyMode, setCurrencyMode] = useState(() => {
    try { return localStorage.getItem('maddex_currency_pref') ?? 'AUD' } catch { return 'AUD' }
  })
  const handleCurrencyToggle = useCallback(() => {
    setCurrencyMode(m => {
      const next = m === 'AUD' ? 'USD' : 'AUD'
      try { localStorage.setItem('maddex_currency_pref', next) } catch {}
      return next
    })
  }, [])

  // Startup: country data refresh + gap report
  useEffect(() => {
    console.log(`[MADDEX] Country database: ${COUNTRIES.length} entries loaded`)
    const alpha2Set = new Set(COUNTRIES.map(c => c.alpha2))
    initCountryDataRefresh(alpha2Set).catch(err => console.warn('[MADDEX] Country refresh error:', err))
  }, [])

  // Time tick (30s)
  useEffect(() => {
    const update = () => {
      setNow(new Date().toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' AEST')
      setNowMs(Date.now())
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [])

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
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })
  const flightData = useMemo(() => transformFlightData(flightRaw), [flightRaw])

  // USGS significant earthquakes (M4.0+, last 7 days) — SEISMIC globe layer
  const { data: earthquakes } = useQuery({
    queryKey: ['usgsQuakes'],
    queryFn:  fetchSignificantEarthquakes,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })

  // Combine for geopolitical tab
  const allNewsItems = useMemo(() => {
    const all = [...(geoNewsItems ?? []), ...(newsItems?.articles ?? [])]
    // Deduplicate by headline
    const seen = new Set()
    return all.filter(n => { if (seen.has(n.headline)) return false; seen.add(n.headline); return true })
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
    setMobilePanel('detail')
  }, [])

  // Globe exchange-marker click — resolve the exchange's country (via this
  // module's own 51-entry EXCHANGES array) and show the same CountryPanel,
  // which already surfaces the linked exchange's session countdown.
  const handleExchangeClick = useCallback((exchangeId) => {
    const ex = EXCHANGES.find(e => e.id === exchangeId)
    if (ex?.countryId) setSelectedCountry(ex.countryId)
    setMobilePanel('detail')
  }, [])

  const handleSelectExchange = useCallback((exchangeId) => {
    setSelectedCountry(null)
    setSelectedExchange(exchangeId)
    setActiveTab('exchange')
    setMobilePanel('detail')
  }, [])

  const TABS = [
    { id:'summary',     label:'SUMMARY'     },
    { id:'maritime',    label:'MARITIME'    },
    { id:'air',         label:'AIR'         },
    { id:'commodities', label:'COMMOD'      },
    { id:'geopolitical',label:'GEO RISK'    },
    { id:'sessions',    label:'SESSIONS'    },
    { id:'exchange',    label:'EXCHANGE',   hidden: !selectedExchange && activeTab !== 'exchange' },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader title="GLOBAL" subtitle="Trade Flows · Market Breadth · Country Risk" moduleId="global" />

      {/* Critical-event alert banner */}
      {criticalAlert && (
        <div className="flex items-center gap-3 px-3 py-1 bg-terminal-red/15 border-b border-terminal-red/50 flex-shrink-0 animate-pulse">
          <span className="text-terminal-red text-2xs font-bold tracking-widest flex-shrink-0">⚠ CRITICAL EVENT</span>
          <span className="text-2xs text-terminal-text truncate">{criticalAlert.headline}</span>
          <span className="text-2xs text-terminal-text-dim flex-shrink-0">{timeAgo(criticalAlert.pubDate)} · {criticalAlert.source}</span>
        </div>
      )}

      {/* Mobile-only panel switcher (<768px) — the three columns stack full-width
          instead of sitting side by side, so a small screen needs to pick one. */}
      <div className="flex md:hidden border-b border-terminal-border flex-shrink-0">
        {[
          { id:'feed',   label:'FEED'   },
          { id:'globe',  label:'GLOBE'  },
          { id:'detail', label:'DETAIL' },
        ].map(p => (
          <button key={p.id} onClick={() => setMobilePanel(p.id)}
            className={`flex-1 font-mono text-2xs font-bold tracking-widest py-2 uppercase transition-colors border-b-2 ${
              mobilePanel === p.id ? 'text-terminal-gold border-b-terminal-gold' : 'text-terminal-text-dim border-b-transparent'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>

        {/* ── Main content row: Feed | Globe | Right tab panel ── */}
        <div style={{ flex:1, display:'flex', minHeight:0 }}>

          {/* Left — live intelligence feed, 260px */}
          <div className={`${mobilePanel === 'feed' ? 'flex' : 'hidden'} md:flex w-full md:w-[260px] md:min-w-[260px] flex-shrink-0 flex-col overflow-hidden border-r border-terminal-border`}>
            <IntelFeedPanel newsItems={allNewsItems} audRates={rates} onSelectExchange={handleSelectExchange} />
          </div>

          {/* Globe */}
          <div className={`${mobilePanel === 'globe' ? 'block' : 'hidden'} md:block`} style={{ flex:1, position:'relative', overflow:'visible', minHeight:0 }}>
            {/* View switch. The intelligence map is the default; both globes
                are kept so the existing D3/three views remain reachable. */}
            <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }} className="flex items-center border border-terminal-border rounded-full overflow-hidden bg-terminal-bg/80 backdrop-blur-sm">
              {[['map', 'INTEL MAP'], ['classic', 'CLASSIC'], ['globe3d', 'IMMERSIVE 3D']].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`text-2xs px-2.5 py-1 font-bold transition-colors ${viewMode === mode ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
                >{label}</button>
              ))}
            </div>
            <Suspense fallback={<Viz3DLoader />}>
              {viewMode === 'map' ? (
                <DeckGLMap onExchangeSelect={handleExchangeClick} watchlist={watchlist} />
              ) : viewMode === 'globe3d' ? (
                <Globe3D onExchangeClick={handleExchangeClick} />
              ) : (
                <MaddexGlobe onCountryClick={handleCountryClick} onExchangeClick={handleExchangeClick} earthquakes={earthquakes} />
              )}
            </Suspense>
          </div>

          {/* Right tab panel — 320-360px */}
          <div className={`${mobilePanel === 'detail' ? 'flex' : 'hidden'} md:flex w-full md:min-w-[320px] md:max-w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-terminal-border`}>
          {/* Tab bar — equal-width columns spanning the full panel so every
              tab stays visible with no horizontal scroll needed. `fill` keeps
              that behaviour on the shared component. */}
          <TabBar
            tabs={TABS.filter(t => !t.hidden).map(t => ({ key: t.id, label: t.label }))}
            activeKey={activeTab}
            onChange={setActiveTab}
            size={9}
            fill
          />

          {/* Tab content — a selected country always takes over this area,
              regardless of which tab is active, per the globe-click rewire. */}
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
              <WorldStatsSummary newsItems={allNewsItems} />
            ) : activeTab === 'maritime' ? (
              <MaritimeTab newsItems={allNewsItems} />
            ) : activeTab === 'air' ? (
              <AirTradeRoutesTab
                selectedArc={selectedArc}
                onArcClick={setSelectedArc}
                flightData={flightData}
              />
            ) : activeTab === 'commodities' ? (
              <CommodityFlowsTab onAskAI={handleAskAI} />
            ) : activeTab === 'geopolitical' ? (
              <GeoRiskTab newsItems={allNewsItems} isLoading={geoNewsLoading} onAskAI={handleAskAI} updatedAt={geoNewsUpdatedAt} />
            ) : activeTab === 'sessions' ? (
              <MarketSessionsTab now={now} />
            ) : null}
          </div>
        </div>
        </div>{/* end main content row */}
      </div>{/* end outer flex-col */}
    </div>
  )
}
