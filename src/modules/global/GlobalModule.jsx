import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { fetchGeoNews, fetchNews } from '../../services/api'
import { useAudRates } from '../../hooks/useAudRates'

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
}

// alpha-2 codes for flag emoji computation
const COUNTRY_A2 = {
  4:'AF',8:'AL',12:'DZ',20:'AD',24:'AO',28:'AG',31:'AZ',32:'AR',36:'AU',40:'AT',44:'BS',48:'BH',
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
  702:'SG',798:'TV',807:'MK',882:'WS',
}

const flagEmoji = (a2) => a2
  ? [...a2.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
  : '🌐'

// ─── Country Detail Data — June 2026 release values ──────────────────────────

const COUNTRY_DETAIL = {
  // ── Core G20 + APAC ──
  36:  { currency:'AUD', tz:'Australia/Sydney',   exchange:'ASX',         index:'ASX 200',      flag:'🇦🇺',
         macro:{ gdp:1.5, gdpLbl:'Q4 2025, ABS', cpi:3.6, cpiLbl:'Q1 2026, ABS', rate:4.35, rateLbl:'May 2026, RBA' },
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
         macro:{ gdp:1.2, gdpLbl:'Q1 2026, Eurostat', cpi:2.2, cpiLbl:'May 2026, Destatis', rate:2.50, rateLbl:'Jun 2026, ECB' },
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
         macro:{ gdp:1.2, gdpLbl:'Q1 2026, Eurostat', cpi:2.2, cpiLbl:'May 2026, INSEE', rate:2.50, rateLbl:'Jun 2026, ECB' },
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

// ─── Exchanges ────────────────────────────────────────────────────────────────

const EXCHANGES = [
  { id:'ASX',    name:'ASX',             city:'Sydney',        tz:'Australia/Sydney',    open:[10,0],  close:[16,0],  countryId:36,  currency:'AUD', region:'APAC'     },
  { id:'TSE',    name:'Tokyo SE',        city:'Tokyo',         tz:'Asia/Tokyo',           open:[9,0],   close:[15,30], countryId:392, currency:'JPY', region:'APAC'     },
  { id:'HKEX',  name:'HKEX',            city:'Hong Kong',     tz:'Asia/Hong_Kong',       open:[9,30],  close:[16,0],  countryId:344, currency:'HKD', region:'APAC'     },
  { id:'SSE',   name:'Shanghai SE',     city:'Shanghai',      tz:'Asia/Shanghai',        open:[9,30],  close:[15,0],  countryId:156, currency:'CNY', region:'APAC'     },
  { id:'NSE',   name:'NSE India',       city:'Mumbai',        tz:'Asia/Kolkata',         open:[9,15],  close:[15,30], countryId:356, currency:'INR', region:'APAC'     },
  { id:'SGX',   name:'SGX',             city:'Singapore',     tz:'Asia/Singapore',       open:[9,0],   close:[17,0],  countryId:702, currency:'SGD', region:'APAC'     },
  { id:'KRX',   name:'Korea Exchange',  city:'Seoul',         tz:'Asia/Seoul',           open:[9,0],   close:[15,30], countryId:410, currency:'KRW', region:'APAC'     },
  { id:'Bursa', name:'Bursa Malaysia',  city:'Kuala Lumpur',  tz:'Asia/Kuala_Lumpur',    open:[9,0],   close:[17,0],  countryId:458, currency:'MYR', region:'APAC'     },
  { id:'IDX',   name:'Indonesia SE',   city:'Jakarta',        tz:'Asia/Jakarta',         open:[9,0],   close:[15,50], countryId:360, currency:'IDR', region:'APAC'     },
  { id:'SET',   name:'Stock Exchange of Thailand',city:'Bangkok',tz:'Asia/Bangkok',     open:[10,0],  close:[16,30], countryId:764, currency:'THB', region:'APAC'     },
  { id:'NZX',   name:'NZX',             city:'Wellington',    tz:'Pacific/Auckland',     open:[10,0],  close:[16,45], countryId:554, currency:'NZD', region:'APAC'     },
  { id:'LSE',   name:'London SE',       city:'London',        tz:'Europe/London',        open:[8,0],   close:[16,30], countryId:826, currency:'GBP', region:'EUROPE'   },
  { id:'XETRA', name:'Xetra',           city:'Frankfurt',     tz:'Europe/Berlin',        open:[9,0],   close:[17,30], countryId:276, currency:'EUR', region:'EUROPE'   },
  { id:'EURONXT',name:'Euronext Paris', city:'Paris',         tz:'Europe/Paris',         open:[9,0],   close:[17,30], countryId:250, currency:'EUR', region:'EUROPE'   },
  { id:'BORSA', name:'Borsa Istanbul',  city:'Istanbul',      tz:'Europe/Istanbul',      open:[10,0],  close:[18,0],  countryId:792, currency:'TRY', region:'EUROPE'   },
  { id:'NYSE',  name:'NYSE',            city:'New York',      tz:'America/New_York',     open:[9,30],  close:[16,0],  countryId:840, currency:'USD', region:'AMERICAS' },
  { id:'NASDAQ',name:'NASDAQ',          city:'New York',      tz:'America/New_York',     open:[9,30],  close:[16,0],  countryId:840, currency:'USD', region:'AMERICAS' },
  { id:'TSX',   name:'TSX',             city:'Toronto',       tz:'America/Toronto',      open:[9,30],  close:[16,0],  countryId:124, currency:'CAD', region:'AMERICAS' },
  { id:'B3',    name:'B3 Brazil',       city:'São Paulo',     tz:'America/Sao_Paulo',    open:[10,0],  close:[17,55], countryId:76,  currency:'BRL', region:'AMERICAS' },
  { id:'JSE',   name:'JSE',             city:'Johannesburg',  tz:'Africa/Johannesburg',  open:[9,0],   close:[17,0],  countryId:710, currency:'ZAR', region:'AFRICA'   },
  { id:'Tadawul',name:'Tadawul',        city:'Riyadh',        tz:'Asia/Riyadh',          open:[10,0],  close:[15,0],  countryId:682, currency:'SAR', region:'MIDDLE EAST'},
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
  { id:'fe-au-cn', from:[133,-25], to:[121,35],  label:'Iron Ore',  color:'#c8a84b', width:3, vol:'155Mt/yr', val:'~A$19B', risk:'LOW',    desc:'Pilbara → Qingdao (62% Fe fines)', src:'Dept Resources 2025-26' },
  { id:'co-au-cn', from:[133,-25], to:[118,31],  label:'Coal',      color:'#6b7280', width:2, vol:'68Mt/yr',  val:'~A$13B', risk:'LOW',    desc:'QLD thermal & coking coal → China', src:'Dept Resources 2025-26' },
  { id:'lng-au-jp',from:[133,-25], to:[138,35],  label:'LNG',       color:'#3b82f6', width:3, vol:'24Mt/yr',  val:'~A$20B', risk:'LOW',    desc:'Woodside/Chevron LNG → Osaka/Nagoya', src:'Dept Resources 2025-26' },
  { id:'co-au-jp', from:[133,-25], to:[138,36],  label:'Coal',      color:'#6b7280', width:2, vol:'52Mt/yr',  val:'~A$9B',  risk:'LOW',    desc:'QLD & NSW coal → Japan power stations', src:'Dept Resources 2025-26' },
  { id:'lng-au-kr',from:[133,-25], to:[128,36],  label:'LNG',       color:'#3b82f6', width:2, vol:'10Mt/yr',  val:'~A$9B',  risk:'LOW',    desc:'APLNG → Incheon terminal', src:'Dept Resources 2025-26' },
  { id:'fe-au-kr', from:[133,-25], to:[130,35],  label:'Iron Ore',  color:'#c8a84b', width:2, vol:'45Mt/yr',  val:'~A$5B',  risk:'LOW',    desc:'Pilbara → POSCO Pohang', src:'Dept Resources 2025-26' },
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
  { id:'syd-sin', label:'Sydney → Singapore', from:[151.2,-33.9], to:[103.8,1.3],  color:'#c8a84b', type:'gold',
    dailyFlights:28, carriers:['Qantas','Singapore Airlines','Scoot'], cargoSplit:'35% cargo',
    auNote:'Primary gateway for AU exports to SE Asia. Top commodities: fresh produce, medical supplies, manufactured goods.' },
  { id:'syd-hkg', label:'Sydney → Hong Kong',  from:[151.2,-33.9], to:[114.2,22.3], color:'#c8a84b', type:'gold',
    dailyFlights:14, carriers:['Cathay Pacific','Qantas'], cargoSplit:'40% cargo',
    auNote:'Key AU–China freight corridor. Electronics, consumer goods inbound; food/resources outbound.' },
  { id:'syd-dxb', label:'Sydney → Dubai',       from:[151.2,-33.9], to:[55.4,25.3],  color:'#c8a84b', type:'gold',
    dailyFlights:21, carriers:['Emirates','Qantas'], cargoSplit:'30% cargo',
    auNote:'Transhipped hub for Europe/Middle East freight. Emirates operates largest AU capacity.' },
  { id:'mel-lax', label:'Melbourne → Los Angeles', from:[144.9,-37.8], to:[-118.4,33.9], color:'#c8a84b', type:'gold',
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
    return mins >= open && mins < close ? 'OPEN' : mins < open ? 'PRE' : 'CLOSED'
  } catch { return 'CLOSED' }
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

function getCountryColor(id, openCountryIds) {
  const n = parseInt(id)
  if (n === 36)                    return '#c8a84b'  // Australia → gold
  if (CONFLICT_COUNTRIES.has(n))   return '#4a0808'  // conflict → visible dark red
  if (STRESS_COUNTRIES.has(n))     return '#4a2500'  // stressed → visible dark amber
  if (PARTNER_COUNTRIES.has(n))    return '#0f3820'  // AU partner → visible dark green
  if (openCountryIds?.has(n))      return '#0e3060'  // market open → visible blue
  if (COUNTRY_TO_EXCHANGE[n])      return '#0a1e3a'  // has exchange, closed → dim blue
  return '#060f20'                                    // no exchange → near black
}

function getHoverColor(id) {
  const n = parseInt(id)
  if (n === 36)                    return '#e0bf70'
  if (CONFLICT_COUNTRIES.has(n))   return '#6a1010'
  if (STRESS_COUNTRIES.has(n))     return '#6a3800'
  if (PARTNER_COUNTRIES.has(n))    return '#1a5530'
  if (COUNTRY_TO_EXCHANGE[n])      return '#1a4a80'
  return '#122040'
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
const SEVERITY_TO_COLOR  = { CRITICAL: '#ff1744', HIGH: '#ff6d00', MEDIUM: '#f59e0b', LOW: '#4a6580' }
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

// ─── Globe helpers ────────────────────────────────────────────────────────────

// Returns true when [lon, lat] is on the visible hemisphere given rotation [λ, φ, γ].
// Uses spherical dot-product. Necessary because projection([lon,lat]) always returns
// screen coordinates even for back-hemisphere points — clipAngle only clips path output.
function isVisible(lon, lat, rotation) {
  const φ0 = -rotation[1] * (Math.PI / 180)
  const λ0 = -rotation[0] * (Math.PI / 180)
  const φ  =  lat         * (Math.PI / 180)
  const λ  =  lon         * (Math.PI / 180)
  return (Math.sin(φ) * Math.sin(φ0) + Math.cos(φ) * Math.cos(φ0) * Math.cos(λ - λ0)) > 0
}

function CompassRose({ rotation, onReset }) {
  // Center of visible hemisphere: lon = -rotation[0], lat = -rotation[1]
  const cLon = -rotation[0]
  const cLat = -rotation[1]

  // Bearing from geographic north to the view centre = cLon (degrees clockwise from N).
  // The needle rotates by this angle so it always points toward the current view centre.
  const needleAngle = cLon

  const normLon = ((cLon % 360) + 360) % 360
  const lonLabel = `${(normLon > 180 ? normLon - 360 : normLon).toFixed(0)}°${cLon >= 0 ? 'E' : 'W'}`
  const latLabel = `${Math.abs(cLat).toFixed(0)}°${cLat >= 0 ? 'N' : 'S'}`

  return (
    <div className="absolute bottom-10 left-2 z-20 flex flex-col items-center gap-1 pointer-events-auto">
      <div className="bg-terminal-panel/85 border border-terminal-border/70 p-1.5 backdrop-blur-sm">
        <svg width="54" height="54" viewBox="-27 -27 54 54">
          {/* Background ring */}
          <circle r={24} fill="rgba(4,13,26,0.6)" stroke="#0d2244" strokeWidth={0.8} />
          {/* Cardinal tick marks (fixed) */}
          <line x1={0} y1={-23} x2={0} y2={-20} stroke="#1a3a6b" strokeWidth={1} />
          <line x1={0} y1={23}  x2={0} y2={20}  stroke="#1a3a6b" strokeWidth={1} />
          <line x1={23} y1={0}  x2={20} y2={0}  stroke="#1a3a6b" strokeWidth={1} />
          <line x1={-23} y1={0} x2={-20} y2={0} stroke="#1a3a6b" strokeWidth={1} />
          {/* Fixed N/S/E/W labels */}
          <text x={0} y={-14} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#c8a84b" fontWeight="700">N</text>
          <text x={0}  y={15} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#4a6580">S</text>
          <text x={15} y={0}  textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#4a6580">E</text>
          <text x={-15}y={0}  textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#4a6580">W</text>
          {/* Rotating needle — tracks bearing to view centre from geographic north */}
          <g transform={`rotate(${needleAngle})`}>
            <polygon points="0,-20 2.5,-7 0,-3 -2.5,-7" fill="#c8a84b" />
            <polygon points="0,20  2.5,7  0,3  -2.5,7"  fill="#1a3a6b" />
          </g>
          <circle r={2.2} fill="#040d1a" stroke="#c8a84b" strokeWidth={0.8} />
        </svg>
        <div className="text-center mt-0.5 leading-none" style={{ fontSize: 8 }}>
          <span className="text-terminal-text-dim">{lonLabel} · {latLabel}</span>
        </div>
      </div>
      <button
        onClick={onReset}
        className="text-2xs text-terminal-gold border border-terminal-border/60 px-2 py-0.5 bg-terminal-panel/85 hover:bg-terminal-gold/10 backdrop-blur-sm whitespace-nowrap"
      >
        ↺ AU CENTRE
      </button>
    </div>
  )
}

// ─── 3D Globe ─────────────────────────────────────────────────────────────────

function WorldMap({ openCountryIds, activeLayers, onCountryClick, selectedId, geoNewsItems, selectedArc, onArcClick }) {
  const containerRef = useRef(null)
  const svgRef       = useRef(null)

  const [topology, setTopology]     = useState(null)
  const [svgSize, setSvgSize]       = useState({ width: 800, height: 420 })
  const [hovered, setHovered]       = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [rotation, setRotation]     = useState([-134, 26, 0])
  const [search, setSearch]         = useState('')
  const searchRef = useRef(null)

  // Refs to avoid stale closures in RAF / event handlers
  const rotRef         = useRef([-134, 26, 0])
  const isDraggingRef  = useRef(false)
  const dragRef        = useRef({ x: 0, y: 0, startRot: [0, 0, 0] })

  // Load topology once
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(setTopology)
      .catch(e => console.warn('[GlobalMap] atlas load failed:', e.message))
  }, [])

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSvgSize({ width, height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const { width, height } = svgSize
  const radius = Math.min(width, height) / 2 - 4

  // 3D orthographic projection (recomputes on rotation + size change)
  const projection = useMemo(() =>
    d3.geoOrthographic()
      .scale(radius)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .rotate(rotation)
  , [rotation, radius, width, height])

  const pathGen   = useMemo(() => d3.geoPath().projection(projection), [projection])
  const graticule = useMemo(() => d3.geoGraticule().step([20, 20])(), [])
  const countries = useMemo(() => topology
    ? topojson.feature(topology, topology.objects.countries).features
    : [], [topology])
  const borders = useMemo(() => topology
    ? topojson.mesh(topology, topology.objects.countries, (a, b) => a !== b)
    : null, [topology])

  // Globe is static by default — drag to rotate manually

  // Window-level drag handlers
  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingRef.current) return
      const { x, y, startRot } = dragRef.current
      const λ = startRot[0] + (e.clientX - x) * 0.45
      const φ = Math.max(-80, Math.min(80, startRot[1] - (e.clientY - y) * 0.45))
      rotRef.current = [λ, φ, 0]
      setRotation([λ, φ, 0])
    }
    const onUp = () => { isDraggingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Commodity flow paths
  const flowPaths = useMemo(() => {
    if (!activeLayers.commodities) return []
    return COMMODITY_FLOWS.map(flow => {
      const feature = { type:'Feature', geometry:{ type:'LineString', coordinates:[flow.from, flow.to] } }
      try { return { ...flow, d: pathGen(feature) } } catch { return null }
    }).filter(Boolean)
  }, [pathGen, activeLayers.commodities])

  // Air trade route arc paths
  const arcPaths = useMemo(() => {
    if (!activeLayers.air) return []
    return AIR_TRADE_ROUTES.map(route => {
      const feature = { type:'Feature', geometry:{ type:'LineString', coordinates:[route.from, route.to] } }
      try { return { ...route, d: pathGen(feature) } } catch { return null }
    }).filter(Boolean).filter(r => r.d)
  }, [pathGen, activeLayers.air])

  // Dynamic conflict-zone severity — escalate color/radius from live news
  // matching each zone's keywords; falls back to the static baseline when
  // there's no fresh signal, so a zone never silently looks calmer than it is.
  const dynamicConflictZones = useMemo(() => {
    return CONFLICT_ZONES.map(cz => {
      const re = ZONE_KEYWORDS[cz.name]
      if (!re || !geoNewsItems?.length) return cz
      const related = geoNewsItems.filter(n => re.test(`${n.headline} ${n.summary ?? ''}`))
      if (!related.length) return cz
      const worstSeverity = related
        .map(n => detectSeverity(`${n.headline} ${n.summary ?? ''}`))
        .sort((a, b) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[a] - { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[b]))[0]
      return {
        ...cz,
        color:  SEVERITY_TO_COLOR[worstSeverity]  ?? cz.color,
        radius: Math.max(cz.radius, SEVERITY_TO_RADIUS[worstSeverity] ?? cz.radius),
        liveSeverity: worstSeverity,
      }
    })
  }, [geoNewsItems])

  // Search: rotate globe to center searched country
  const searchId = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase().trim()
    for (const f of countries) {
      const name = COUNTRY_NAMES[parseInt(f.id)] ?? ''
      if (name.toLowerCase().startsWith(q)) return f.id
    }
    return null
  }, [search, countries])

  useEffect(() => {
    if (!searchId || !countries.length) return
    const feature = countries.find(f => f.id === searchId)
    if (!feature) return
    const [lon, lat] = d3.geoCentroid(feature)
    const newRot = [-lon, -lat, 0]
    rotRef.current = newRot
    setRotation(newRot)
  }, [searchId, countries])

  // Get country name for hover
  const getCountryName = useCallback((id) => {
    const name = COUNTRY_NAMES[parseInt(id)]
    if (!name) console.log(`[Globe] Unknown country ID: ${id} — add to COUNTRY_NAMES`)
    return name ?? 'Unknown Territory'
  }, [])

  // Get exchange status for hover
  const getExchangeInfo = useCallback((id) => {
    const n = parseInt(id)
    const exchId = COUNTRY_TO_EXCHANGE[n]
    if (!exchId) return null
    const ex = EXCHANGES.find(e => e.id === exchId)
    if (!ex) return null
    const st = getStatus(ex)
    return { exchId, status: st, localT: localTime(ex.tz), currency: ex.currency }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-terminal-bg">
      {/* Search box */}
      <div className="absolute top-2 left-2 z-30 flex items-center gap-1">
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search country..."
          className="bg-terminal-panel border border-terminal-border text-terminal-text text-2xs px-2 py-1 w-36 focus:border-terminal-gold focus:outline-none placeholder-terminal-text-dim"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="text-terminal-text-dim hover:text-terminal-gold text-2xs px-1">✕</button>
        )}
      </div>

      {!topology && (
        <div className="absolute inset-0 flex items-center justify-center text-2xs text-terminal-text-dim animate-pulse z-10">
          LOADING WORLD ATLAS...
        </div>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="block cursor-grab active:cursor-grabbing select-none"
        onMouseLeave={() => setHovered(null)}
        onMouseDown={e => {
          if (e.button !== 0) return
          isDraggingRef.current = true
          dragRef.current = { x: e.clientX, y: e.clientY, startRot: [...rotRef.current] }
          e.preventDefault()
        }}
      >
        {/* Atmosphere glow */}
        <defs>
          <radialGradient id="globe-atm" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="#1e5fa8" stopOpacity="0" />
            <stop offset="100%" stopColor="#1e5fa8" stopOpacity="0.38" />
          </radialGradient>
          <radialGradient id="ocean-sheen" cx="38%" cy="34%" r="55%">
            <stop offset="0%"   stopColor="#0e2044" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#040d1a" stopOpacity="1" />
          </radialGradient>
          <style>{`
            .flow-line { animation: flowAnim 3s linear infinite; }
            @keyframes flowAnim { from { stroke-dashoffset: 14; } to { stroke-dashoffset: 0; } }
          `}</style>
        </defs>

        {/* Atmosphere halo */}
        <circle cx={width / 2} cy={height / 2} r={radius + 9}
          fill="url(#globe-atm)" pointerEvents="none" />

        {/* Ocean sphere — transparent so globe feels open; edge defined by atmosphere halo + outline */}
        <path d={pathGen({ type: 'Sphere' })} fill="rgba(6,15,35,0.45)" />

        {/* Graticule */}
        <path d={pathGen(graticule)} fill="none" stroke="#08172a" strokeWidth={0.5} pointerEvents="none" />

        {/* Countries */}
        {countries.map(feature => {
          const isHov  = hovered === feature.id
          const isSel  = selectedId === feature.id
          const isSrch = searchId === feature.id
          return (
            <path
              key={feature.id}
              d={pathGen(feature)}
              fill={isHov || isSel ? getHoverColor(feature.id) : getCountryColor(feature.id, openCountryIds)}
              stroke={isSel || isSrch ? '#c8a84b' : '#040d1a'}
              strokeWidth={isSel || isSrch ? 1.5 : 0.4}
              className="cursor-pointer"
              onMouseEnter={e => {
                setHovered(feature.id)
                setTooltipPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
              }}
              onMouseMove={e => setTooltipPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })}
              onClick={() => onCountryClick(feature.id)}
            />
          )
        })}

        {/* Country borders */}
        {borders && (
          <path d={pathGen(borders)} fill="none" stroke="#040d1a" strokeWidth={0.4} pointerEvents="none" />
        )}

        {/* Globe sphere outline */}
        <path d={pathGen({ type: 'Sphere' })} fill="none" stroke="#0d2244" strokeWidth={1} pointerEvents="none" />

        {/* Shipping lanes */}
        {activeLayers.maritime && SHIPPING_LANES.map(lane => {
          const feat = { type:'Feature', geometry:{ type:'LineString', coordinates: lane.pts } }
          try {
            const d = pathGen(feat)
            return <path key={lane.id} d={d} fill="none" stroke="#1e4a8a" strokeWidth={1}
              strokeDasharray="4 4" opacity={0.35} pointerEvents="none" />
          } catch { return null }
        })}

        {/* Commodity flows */}
        {activeLayers.commodities && flowPaths.map(flow => flow.d && (
          <g key={flow.id} pointerEvents="none">
            <path d={flow.d} fill="none" stroke={flow.color} strokeWidth={flow.width + 2} opacity={0.07} />
            <path d={flow.d} fill="none" stroke={flow.color} strokeWidth={flow.width}
              strokeDasharray="8 4" opacity={0.75} className="flow-line" style={{ strokeDashoffset: 14 }} />
          </g>
        ))}

        {/* Conflict zone pulses — color/radius escalate dynamically from live news */}
        {activeLayers.geopolitical && dynamicConflictZones.map(cz => {
          if (!isVisible(cz.lon, cz.lat, rotation)) return null
          const pos = projection([cz.lon, cz.lat])
          if (!pos) return null
          const [cx, cy] = pos
          const r = cz.radius
          return (
            <g key={cz.name} pointerEvents="none">
              <circle cx={cx} cy={cy} r={r} fill={cz.color} opacity={0.15} />
              <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke={cz.color} strokeWidth={1}>
                <animate attributeName="r" values={`${r*0.3};${r*1.5};${r*0.3}`} dur="2.5s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.8;0;0.8" dur="2.5s" repeatCount="indefinite"/>
              </circle>
            </g>
          )
        })}

        {/* Major ports */}
        {activeLayers.maritime && MAJOR_PORTS.map(port => {
          if (!isVisible(port.lon, port.lat, rotation)) return null
          const pos = projection([port.lon, port.lat])
          if (!pos) return null
          const [px, py] = pos
          return (
            <g key={port.name}>
              <rect x={px - 3} y={py - 3} width={6} height={6} fill="#0a2a4a" stroke="#1e5fa8" strokeWidth={1} />
              <circle cx={px} cy={py} r={1.5} fill="#3b82f6" />
            </g>
          )
        })}

        {/* Major airports */}
        {/* Air trade route arcs */}
        {arcPaths.map(route => (
          <g key={route.id} style={{ cursor:'pointer' }} onClick={() => onArcClick?.(route)}>
            {/* glow backing */}
            <path d={route.d} fill="none" stroke={route.color} strokeWidth={4} opacity={0.12} pointerEvents="stroke" />
            {/* base line */}
            <path d={route.d} fill="none" stroke={route.color} strokeWidth={1.2} opacity={0.45} pointerEvents="none" />
            {/* animated dash */}
            <path d={route.d} fill="none" stroke={route.color} strokeWidth={1.8}
              strokeDasharray="8 6" opacity={selectedArc?.id === route.id ? 1 : 0.75}
              className="flow-line" style={{ strokeDashoffset: 14 }} pointerEvents="none" />
          </g>
        ))}

        {/* Air trade route endpoint dots */}
        {activeLayers.air && AIR_TRADE_ROUTES.flatMap(route => [
          { key: route.id+'-from', lon: route.from[0], lat: route.from[1], color: route.color },
          { key: route.id+'-to',   lon: route.to[0],   lat: route.to[1],   color: route.color },
        ]).filter(pt => isVisible(pt.lon, pt.lat, rotation)).map(pt => {
          const pos = projection([pt.lon, pt.lat])
          if (!pos) return null
          const [px, py] = pos
          return <circle key={pt.key} cx={px} cy={py} r={2} fill={pt.color} opacity={0.8} />
        })}

        {/* Chokepoints */}
        {activeLayers.maritime && CHOKEPOINTS.map(cp => {
          if (!isVisible(cp.lon, cp.lat, rotation)) return null
          const pos = projection([cp.lon, cp.lat])
          if (!pos) return null
          const [cx, cy] = pos
          const isDisrupted = cp.status === 'DISRUPTED'
          const isMonitored = cp.status === 'MONITORED'
          const color = isDisrupted ? '#ff6d00' : isMonitored ? '#c8a84b' : '#00c853'
          return (
            <g key={cp.name}>
              {(isDisrupted || isMonitored) && (
                <circle cx={cx} cy={cy} r={8} fill="none" stroke={color} strokeWidth={0.8} opacity={0.4}>
                  <animate attributeName="r" values="5;12;5" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite"/>
                </circle>
              )}
              <circle cx={cx} cy={cy} r={4} fill={color} stroke="#040d1a" strokeWidth={1} />
              <circle cx={cx} cy={cy} r={2} fill="#040d1a" />
            </g>
          )
        })}

        {/* Open market glows (exchanges as dots) */}
        {activeLayers.markets && (() => {
          const nowLocal = new Date()
          return EXCHANGES.map(ex => {
            const detail = COUNTRY_DETAIL[ex.countryId]
            if (!detail?.tz) return null
            const st = getStatus(ex)
            if (st !== 'OPEN') return null
            // Exchange city rough coordinates (use country centroid from COUNTRY_DETAIL)
            const ISO_COORDS = {
              36:[133,-25], 840:[-100,40], 826:[-2,54], 276:[10,51],
              250:[2,46],   392:[138,37], 156:[105,35], 356:[79,22],
              410:[128,37], 76:[-53,-15], 124:[-96,60], 702:[104,1],
              344:[114,22], 458:[110,3],  360:[120,-5], 764:[102,15],
              710:[25,-29], 682:[45,25],  784:[54,24],  792:[35,39],
              554:[172,-42],
            }
            const coords = ISO_COORDS[ex.countryId]
            if (!coords) return null
            if (!isVisible(coords[0], coords[1], rotation)) return null
            const pos = projection(coords)
            if (!pos) return null
            const [px, py] = pos
            return (
              <g key={ex.id} pointerEvents="none">
                <circle cx={px} cy={py} r={5} fill="#00c853" opacity={0.2}>
                  <animate attributeName="r" values="4;7;4" dur="3s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite"/>
                </circle>
                <circle cx={px} cy={py} r={2} fill="#00c853" opacity={0.8} />
              </g>
            )
          })
        })()}

        {/* Hover tooltip */}
        {hovered && (() => {
          const name   = getCountryName(hovered)
          const exInfo = getExchangeInfo(hovered)
          const n      = parseInt(hovered)
          const detail = COUNTRY_DETAIL[n]
          const lt     = detail?.tz ? localTime(detail.tz) : null
          const ttx    = Math.min(tooltipPos.x + 12, width - 184)
          const tty    = Math.max(tooltipPos.y - 55, 4)
          return (
            <foreignObject x={ttx} y={tty} width={178} height={110}>
              <div className="bg-terminal-panel border border-terminal-gold/60 px-2 py-1.5 text-2xs pointer-events-none shadow-lg">
                <div className="text-terminal-text-bright font-bold flex items-center gap-1">
                  {COUNTRY_A2[n] && <span>{flagEmoji(COUNTRY_A2[n])}</span>}
                  <span>{name}</span>
                </div>
                {exInfo && (
                  <div className={`mt-0.5 font-semibold ${exInfo.status === 'OPEN' ? 'text-terminal-green' : 'text-terminal-text-dim'}`}>
                    {exInfo.exchId} · {exInfo.status}
                  </div>
                )}
                {lt && <div className="text-terminal-text-dim mt-0.5">{lt} · {detail?.currency}</div>}
                {CONFLICT_COUNTRIES.has(n) && <div className="text-terminal-red mt-0.5">⚠ CONFLICT ZONE</div>}
                {STRESS_COUNTRIES.has(n)   && <div className="text-orange-400 mt-0.5">⚠ UNDER SANCTIONS</div>}
                {PARTNER_COUNTRIES.has(n) && !CONFLICT_COUNTRIES.has(n) && !STRESS_COUNTRIES.has(n) &&
                  <div className="text-terminal-green mt-0.5">★ AU TRADE PARTNER</div>}
                <div className="text-terminal-text-dim mt-1 opacity-60">Click to open panel</div>
              </div>
            </foreignObject>
          )
        })()}
      </svg>

      {/* Globe hint */}
      <div className="absolute top-2 right-2 text-2xs text-terminal-text-dim pointer-events-none opacity-50">
        drag to rotate · click country
      </div>

      {/* Compass rose */}
      <CompassRose rotation={rotation} onReset={() => {
        rotRef.current = [-134, 26, 0]
        setRotation([-134, 26, 0])
      }} />

      {/* Legend — shifted right to clear compass */}
      <div className="absolute bottom-1 left-20 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-terminal-text-dim pointer-events-none">
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{background:'#c8a84b'}}/>AU</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{background:'#0f3820'}}/>PARTNER</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{background:'#0e3060'}}/>MKT OPEN</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{background:'#4a0808'}}/>CONFLICT</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{background:'#4a2500'}}/>SANCTIONED</span>
        {activeLayers.air && <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{background:'#c8a84b'}}/>AU ROUTE</span>}
        {activeLayers.air && <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{background:'#3b82f6'}}/>INTL CORRIDOR</span>}
        {activeLayers.air && <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block" style={{background:'#14b8a6'}}/>CARGO ROUTE</span>}
      </div>
    </div>
  )
}

// ─── Country Side Panel ───────────────────────────────────────────────────────

function CountryPanel({ id, newsItems, audRates, onClose, onAskAI }) {
  const n  = parseInt(id)
  const name = COUNTRY_NAMES[n] ?? 'Unknown Territory'
  const detail = COUNTRY_DETAIL[n]
  const extra  = COUNTRY_EXTRA[n]
  const exchId = COUNTRY_TO_EXCHANGE[n]
  const ex = exchId ? EXCHANGES.find(e => e.id === exchId) : null
  const st = ex ? getStatus(ex) : null
  const lt = detail?.tz ? localTime(detail.tz) : null
  const riskRating = getRiskRating(n)

  const relatedNews = useMemo(() => {
    if (!newsItems || !name) return []
    const lname = name.toLowerCase()
    // Also match common aliases
    const aliases = [lname]
    if (n === 156) aliases.push('beijing', 'china', 'chinese')
    if (n === 840) aliases.push('washington', 'american', 'trump', 'biden', 'white house')
    if (n === 643) aliases.push('kremlin', 'moscow', 'russian', 'putin')
    if (n === 826) aliases.push('london', 'british', 'uk', 'britain')
    if (n === 276) aliases.push('berlin', 'german')
    const re = new RegExp(aliases.join('|'), 'i')
    return newsItems.filter(n => re.test(n.headline + ' ' + (n.summary ?? ''))).slice(0, 5)
  }, [newsItems, name, n])

  const isConflict = CONFLICT_COUNTRIES.has(n)
  const isStress   = STRESS_COUNTRIES.has(n)
  const isPartner  = PARTNER_COUNTRIES.has(n)

  return (
    <div className="flex flex-col h-full overflow-hidden panel-fade">
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{detail?.flag ?? flagEmoji(COUNTRY_A2[n])}</span>
          <div>
            <div className="text-xs font-bold text-terminal-gold">{name}</div>
            <div className="text-2xs text-terminal-text-dim">{detail?.currency ?? '—'} · {lt ?? '—'}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text text-sm">✕</button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Status badges + ASK AI */}
        <div className="px-3 py-2 border-b border-terminal-border/50">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {isConflict && <span className="text-2xs px-1.5 py-0.5 bg-terminal-red/20 text-terminal-red border border-terminal-red/30">⚠ CONFLICT ZONE</span>}
            {isStress && !isConflict && <span className="text-2xs px-1.5 py-0.5 bg-orange-900/20 text-orange-400 border border-orange-400/30">⚠ SANCTIONED</span>}
            {isPartner && <span className="text-2xs px-1.5 py-0.5 bg-terminal-green/10 text-terminal-green border border-terminal-green/30">★ AU TRADE PARTNER</span>}
            <span className={`text-2xs px-1.5 py-0.5 border border-current/30 ${RISK_COLOR[riskRating] ?? 'text-terminal-text-dim'}`}>
              RISK: {riskRating}
            </span>
          </div>
          <div className="flex items-center justify-between">
            {extra?.capital && (
              <div className="text-2xs text-terminal-text-dim">
                <span className="text-terminal-text">{extra.capital}</span>
                {extra.pop && <span className="text-terminal-text-dim ml-2">· Pop. {extra.pop}</span>}
              </div>
            )}
            <button
              onClick={() => onAskAI(`Provide a professional analysis of ${name} for Australian investors. Include: economic outlook, key risks, trade relationship with Australia, ASX stocks with exposure, and AUD implications.`)}
              className="text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors flex-shrink-0"
            >ASK AI</button>
          </div>
        </div>

        {/* Exchange */}
        {ex && (
          <div className="px-3 py-2 border-b border-terminal-border/50">
            <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1">Exchange</div>
            <div className="flex justify-between text-2xs">
              <span className="text-terminal-text-bright font-semibold">{detail?.exchange ?? ex.id}</span>
              <span className="text-terminal-text-dim">{detail?.index}</span>
            </div>
            <div className="flex justify-between text-2xs mt-0.5">
              <span className="text-terminal-text-dim">Local time</span>
              <span className="text-terminal-text-bright">{lt}</span>
            </div>
            {countdown(ex) && (
              <div className="flex justify-between text-2xs mt-0.5">
                <span className="text-terminal-text-dim">Session</span>
                <span className="text-terminal-gold">{countdown(ex)}</span>
              </div>
            )}
          </div>
        )}

        {/* Macro stats */}
        {detail?.macro && (
          <div className="px-3 py-2 border-b border-terminal-border/50">
            <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1.5">Macro Statistics</div>
            <div className="space-y-1">
              <div className="flex justify-between text-2xs">
                <span className="text-terminal-text-dim">GDP Growth</span>
                <div className="text-right">
                  <span className={`font-bold ${detail.macro.gdp >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                    {detail.macro.gdp >= 0 ? '+' : ''}{detail.macro.gdp}%
                  </span>
                  <span className="text-terminal-text-dim/60 ml-1 text-2xs">{detail.macro.gdpLbl}</span>
                </div>
              </div>
              <div className="flex justify-between text-2xs">
                <span className="text-terminal-text-dim">Inflation (CPI)</span>
                <div className="text-right">
                  <span className={`font-bold ${detail.macro.cpi > 4 ? 'text-terminal-red' : detail.macro.cpi > 2.5 ? 'text-terminal-gold' : 'text-terminal-green'}`}>
                    {detail.macro.cpi}%
                  </span>
                  <span className="text-terminal-text-dim/60 ml-1 text-2xs">{detail.macro.cpiLbl}</span>
                </div>
              </div>
              <div className="flex justify-between text-2xs">
                <span className="text-terminal-text-dim">Interest Rate</span>
                <div className="text-right">
                  <span className="text-terminal-blue-bright font-bold">{detail.macro.rate}%</span>
                  <span className="text-terminal-text-dim/60 ml-1 text-2xs">{detail.macro.rateLbl}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Economy brief */}
        {extra?.economy && (
          <div className="px-3 py-2 border-b border-terminal-border/50">
            <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1">Economy</div>
            <div className="text-2xs text-terminal-text leading-relaxed">{extra.economy}</div>
          </div>
        )}

        {/* AU Trade Relationship */}
        {extra?.auTrade && (
          <div className="px-3 py-2 border-b border-terminal-border/50">
            <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1">AU Trade Relationship</div>
            <div className="text-2xs text-terminal-text leading-relaxed">{extra.auTrade}</div>
          </div>
        )}

        {/* Trading partners */}
        {detail?.partners && (
          <div className="px-3 py-2 border-b border-terminal-border/50">
            <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1">Top Trading Partners</div>
            <div className="flex flex-wrap gap-1">
              {detail.partners.map(p => (
                <span key={p} className="text-2xs px-1 py-0.5 border border-terminal-border text-terminal-text">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Recent news */}
        <div className="px-3 py-2">
          <div className="text-2xs text-terminal-text-dim uppercase tracking-wide mb-1.5">Recent News</div>
          {relatedNews.length === 0 ? (
            <div className="text-2xs text-terminal-text-dim/50 italic">No recent news matching {name}</div>
          ) : relatedNews.map((item, i) => (
            <div key={i} className="mb-2 pb-2 border-b border-terminal-border/30 last:border-0">
              <div className="text-2xs text-terminal-text leading-snug">{item.headline}</div>
              <div className="text-2xs text-terminal-text-dim/60 mt-0.5">{item.source} · {item.time}</div>
              <button
                onClick={() => onAskAI(`Analyse the market impact of: "${item.headline}"`)}
                className="mt-0.5 text-2xs text-terminal-gold/60 hover:text-terminal-gold"
              >ASK AI →</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Maritime & Shipping ─────────────────────────────────────────────────

function MaritimeTab({ newsItems }) {
  const [expanded, setExpanded] = useState(null)

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
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail: { prompt: `Analyse the market impact of ${cp.name} (${cp.status}) on Australian investors. Cargo value: ${cp.cargoValue}. ${cp.note}. Key ASX stocks affected: ${cp.asxStocks?.join(', ')}. Include supply chain risks, AU commodity exposure, and freight cost outlook.` } }))}
                  className="text-2xs border border-terminal-gold/40 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                >ASK AI</button>
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

function AirTradeRoutesTab({ selectedArc, onArcClick }) {
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
          <span className="flex items-center gap-1"><span className="w-2 h-1.5 inline-block" style={{background:'#c8a84b'}}/>AU Origin/Dest</span>
          <span className="flex items-center gap-1"><span className="w-2 h-1.5 inline-block" style={{background:'#3b82f6'}}/>Intl Corridor</span>
          <span className="flex items-center gap-1"><span className="w-2 h-1.5 inline-block" style={{background:'#14b8a6'}}/>Cargo Heavy</span>
        </div>

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
                  onClick={e => { e.stopPropagation(); onAskAI(`Analyse supply chain disruption risk and market impact for ${c.name} (${c.route}, ${c.vol})`) }}
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

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">
      LOADING RISK FEED...
    </div>
  )

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
              onClick={e => { e.stopPropagation(); onAskAI(`Analyse the market impact of: "${n.headline}"`) }}
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

  const openCount = statuses.filter(s => s.status === 'OPEN').length

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
  const nextOpen = statuses.find(s => s.status === 'PRE')
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
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    ex.status === 'OPEN' ? 'bg-terminal-green animate-pulse' :
                    ex.status === 'PRE'  ? 'bg-terminal-gold' : 'bg-terminal-border'
                  }`} />
                  <div>
                    <div className={`text-xs font-bold leading-tight ${ex.id === 'ASX' ? 'text-terminal-gold' : 'text-terminal-text-bright'}`}>
                      {ex.id}
                    </div>
                    <div className="text-2xs text-terminal-text-dim leading-tight">{ex.city}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xs font-semibold ${
                    ex.status === 'OPEN' ? 'text-terminal-green' :
                    ex.status === 'PRE'  ? 'text-terminal-gold' : 'text-terminal-text-dim'
                  }`}>{ex.status}</div>
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

// ─── Layer Toggle Bar ─────────────────────────────────────────────────────────

const LAYER_CONFIG = [
  { id:'markets',     label:'MARKETS',     color:'text-terminal-blue-bright' },
  { id:'maritime',    label:'MARITIME',    color:'text-terminal-text-bright' },
  { id:'air',         label:'ROUTES',      color:'text-terminal-gold' },
  { id:'commodities', label:'COMMODITIES', color:'text-terminal-gold' },
  { id:'geopolitical',label:'GEO RISK',    color:'text-terminal-red' },
]

function LayerToggleBar({ layers, onToggle }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-terminal-border bg-terminal-header flex-shrink-0">
      <span className="text-2xs text-terminal-text-dim mr-1">LAYERS:</span>
      {LAYER_CONFIG.map(l => (
        <button key={l.id} onClick={() => onToggle(l.id)}
          className={`text-2xs px-2 py-0.5 border transition-colors ${
            layers[l.id]
              ? `border-current ${l.color} bg-current/10`
              : 'border-terminal-border text-terminal-text-dim hover:text-terminal-text'
          }`}
          style={layers[l.id] ? {} : {}}>
          {layers[l.id] ? '● ' : '○ '}{l.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export default function GlobalModule() {
  const [now, setNow] = useState(
    () => new Date().toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' AEST'
  )
  const [nowMs, setNowMs] = useState(0)
  const [tick, setTick] = useState(0)
  const [activeTab, setActiveTab]     = useState('maritime')
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [selectedArc, setSelectedArc] = useState(null)
  const [layers, setLayers] = useState({
    markets: true, maritime: true, air: false, commodities: false, geopolitical: true,
  })

  const { rates } = useAudRates()

  // Time tick (30s)
  useEffect(() => {
    const update = () => {
      setNow(new Date().toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' AEST')
      setNowMs(Date.now())
      setTick(t => t + 1)
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [])

  // Open market country IDs
  const openCountryIds = useMemo(() => {
    const ids = new Set()
    for (const ex of EXCHANGES) {
      if (getStatus(ex) === 'OPEN' && ex.countryId) ids.add(ex.countryId)
    }
    return ids
  }, [tick])

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

  // Combine for geopolitical tab
  const allNewsItems = useMemo(() => {
    const all = [...(geoNewsItems ?? []), ...(newsItems ?? [])]
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

  const toggleLayer = useCallback((id) => {
    setLayers(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const handleCountryClick = useCallback((id) => {
    setSelectedCountry(prev => prev === id ? null : id)
    if (id !== selectedCountry) setActiveTab('country')
  }, [selectedCountry])

  const handleAskAI = useCallback((prompt) => {
    // Dispatch to AI panel via custom event
    window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail: { prompt } }))
  }, [])

  const TABS = [
    { id:'maritime',    label:'MARITIME'   },
    { id:'air',         label:'ROUTES'     },
    { id:'commodities', label:'COMMS'      },
    { id:'geopolitical',label:'GEO RISK'   },
    { id:'sessions',    label:'SESSIONS'   },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Critical-event alert banner */}
      {criticalAlert && (
        <div className="flex items-center gap-3 px-3 py-1 bg-terminal-red/15 border-b border-terminal-red/50 flex-shrink-0 animate-pulse">
          <span className="text-terminal-red text-2xs font-bold tracking-widest flex-shrink-0">⚠ CRITICAL EVENT</span>
          <span className="text-2xs text-terminal-text truncate">{criticalAlert.headline}</span>
          <span className="text-2xs text-terminal-text-dim flex-shrink-0">{timeAgo(criticalAlert.pubDate)} · {criticalAlert.source}</span>
        </div>
      )}

      {/* Layer toggles */}
      <LayerToggleBar layers={layers} onToggle={toggleLayer} />

      {/* Main content: Map + Right Panel */}
      <div className="flex-1 grid grid-cols-[1fr_280px] min-h-0 overflow-hidden">

        {/* World Map */}
        <div className="border-r border-terminal-border overflow-hidden flex flex-col">
          <div className="panel-header flex items-center gap-2 flex-shrink-0 py-1">
            <span className="text-terminal-gold">GLOBAL INTELLIGENCE · 3D GLOBE</span>
            <span className="text-2xs text-terminal-text-dim font-normal normal-case">· drag to rotate · compass ↙ · click country</span>
            <span className="ml-auto text-2xs text-terminal-text-dim font-normal normal-case">{now}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <WorldMap
              openCountryIds={openCountryIds}
              activeLayers={layers}
              onCountryClick={handleCountryClick}
              selectedId={selectedCountry}
              geoNewsItems={geoNewsItems}
              selectedArc={selectedArc}
              onArcClick={(arc) => {
                setSelectedArc(arc)
                if (arc) setActiveTab('air')
              }}
            />
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-terminal-border flex-shrink-0">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 px-1 py-1.5 text-2xs font-bold transition-colors border-r border-terminal-border last:border-0 ${
                  activeTab === t.id
                    ? 'bg-terminal-accent text-terminal-gold'
                    : 'text-terminal-text-dim hover:text-terminal-text'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'country' && selectedCountry ? (
              <CountryPanel
                id={selectedCountry}
                newsItems={allNewsItems}
                audRates={rates}
                onClose={() => { setSelectedCountry(null); setActiveTab('maritime') }}
                onAskAI={handleAskAI}
              />
            ) : activeTab === 'maritime' ? (
              <MaritimeTab newsItems={allNewsItems} />
            ) : activeTab === 'air' ? (
              <AirTradeRoutesTab
                selectedArc={selectedArc}
                onArcClick={setSelectedArc}
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
      </div>
    </div>
  )
}
