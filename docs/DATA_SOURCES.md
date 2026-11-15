# Data sources and licences

Every external source the terminal fetches from, what it supplies, its terms,
whether those terms allow what Maddex does (display in a paid subscription
product), the attribution it requires, its free-tier limits, and our status.

**How this was compiled.** Terms pages were read on 1 Nov 2026 (automated
fetch; quotes are verbatim from the pages unless noted). Four could not be
read and are marked NOT FOUND. This is an engineering record, not legal
advice: the lawyer should confirm every row marked anything other than OK
(`docs/LEGAL_READINESS.md`, questions 17–18).

**Status key.** **ON** — terms permit our use (with the attribution shown).
**OFF** — terms prohibit our use or need a paid plan or written permission;
switched off in code (`src/data/sourceLicence.js` for data feeds,
`NEWS_SOURCES_OFF` in `src/services/api.js` for news). **REVIEW** — on, but the
terms are unclear or could not be read; ask the provider. **INTERNAL** — used
only by a maintainer script, never shown to readers.

Equity and index prices are DEMO data (`src/services/mockData.js`) and stay
badged DEMO until a licensed ASX feed is connected.

## Market and economic data

| Source | Supplies | Terms | Commercial use / display | Attribution required | Free-tier limits | Status |
|---|---|---|---|---|---|---|
| CoinGecko Demo API | Crypto prices, market caps, global stats | coingecko.com/en/api_terms | Yes — Demo licence is "Commercial"; may charge for products that incorporate it; may not resell API access | "Powered by CoinGecko", legible, ≥ size 10 | 100 calls/min; **10,000 calls/month** | **ON** — credit on the Crypto table and the tape. ⚠ Calls come from readers' browsers; 10k/month will not cover many users: move behind a cached server proxy or a paid plan before launch |
| Binance public API | Fallback crypto prices (12 majors, converted to A$) | binance.com terms (NOT FOUND — page renders with JavaScript); Binance Vision dataset terms exclude commercial licensing | Unclear | Unclear | Not stated | **REVIEW** — fallback only; ask Binance or drop the fallback |
| alternative.me | Crypto Fear & Greed Index | alternative.me/crypto/fear-and-greed-index | Yes — "Commercial use is allowed as long as the attribution is given right next to the display of the data" | "Data from alternative.me", next to the data | 60 req/min | **ON** — credit beside the gauge and the metric card |
| DefiLlama | DeFi TVL, chains, stablecoins | defillama.com/terms | No — personal, non-commercial; no republishing without permission | — | — | **OFF** (`defillama`). A Pro API exists |
| Frankfurter → ECB | FX reference rates (daily) | frankfurter.dev/license; ecb.europa.eu disclaimer | Yes — ECB: free use; "the ECB must be cited as the source"; if sold, tell buyers it is free from the ECB | Cite the ECB | No caps; abuse-limited | **ON** — tape "SOURCE: ECB"; free-data notice in Macro and the Disclaimer |
| open.er-api.com (ExchangeRate-API) | FX rates on the dashboard FX widget | exchangerate-api.com/docs/free | Yes for display; no redistribution of the data | "Rates By Exchange Rate API" link | 429 when limited; refreshes daily | **ON** — link on the widget. Never offer these rates for export or via our API |
| ExchangeRate-API v6 (keyed) | Gold and silver in A$ | exchangerate-api.com/terms | Yes (paid/free account) | As above | Per plan | **ON** — now server-side (`api/metals.js`) |
| Stooq | Index/commodity quotes and history | Terms NOT FOUND (stooq.com/terms 404) | Unclear | Unclear | Reportedly low daily limit | **REVIEW** — only used when not on DEMO data |
| FRED (St. Louis Fed) | US CPI, unemployment, GDP, Fed target (reconciliation) | fred.stlouisfed.org/legal | No for commercial display without written consent; no caching | "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis." | — | **OFF in browsers** (`fred`); **INTERNAL** in `npm run check-stats` (maintainers' reconciliation of hand-entered figures) — confirm with the lawyer that internal use is fine |
| US BLS API | US CPI, unemployment (reconciliation) | bls.gov/developers/termsOfService.htm | Yes; no end-use controls | "BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov." + date retrieved | v1: 25 queries/day | **INTERNAL** (`check-stats` only) |
| RBA statistical tables | Cash rate, decisions, yields, F-tables | rba.gov.au/copyright | Yes for commercial use; must not hide that RBA data is free; third-party-sourced tables need that party's consent | "Source: Reserve Bank of Australia" | — | **ON** — credit in Macro; free-data notice in Macro and the Disclaimer |
| ABS Data API | CPI, unemployment, GDP | abs.gov.au copyright | Yes — CC BY 4.0 | Attribute to the ABS (exact wording on "Attributing ABS material" — not read) | No key; beta | **ON** — "Source: Australian Bureau of Statistics (CC BY 4.0)" in Macro. Confirm the exact attribution wording |
| IMF DataMapper | Country macro data (Global, Macro) | imf.org/en/About/copyright-and-terms | No — commercial reuse needs permission | "Source: International Monetary Fund, …" | No automated bulk download | **OFF** (`imf`). Ask copyright@imf.org |
| World Bank API | Country data | datacatalog.worldbank.org/public-licenses; API terms | Conflicting — data CC BY 4.0, but API terms bar facilitating commercial use | Credit and note changes | Reasonable volume | **OFF** (`worldbank`, 15 Nov 2026) — no longer fetched; ask, or ship the CC BY datasets as static files |
| USGS earthquake feeds | Seismic events on the map | usgs.gov copyrights-and-credits | Yes — public domain | Requested: "Credit: U.S. Geological Survey" | — | **ON** — credit on the seismic panel |
| OpenSky Network | Aircraft positions | opensky-network.org/about/terms-of-use | No — commercial or live-product use needs a written licence | — | — | **OFF** (`opensky`) |
| Open-Meteo | Weather at exchange cities | open-meteo.com/en/terms | No — free API non-commercial; subscription apps are commercial | "Weather data by Open-Meteo.com" next to the data | <10k/day | **OFF** (`openmeteo`). Paid plan available |
| Nominatim (OSM) | Geocoding | operations.osmfoundation.org/policies/nominatim | Permitted within the usage policy | © OpenStreetMap contributors | **1 req/s**, identifying User-Agent/Referer, no autocomplete, caching expected | **ON** — OSM credit on the map; `geocodeService` throttles to 1 req/s, caches per session and geocodes only on submit (no autocomplete) |
| mempool.space | Bitcoin fees, mempool, block height | mempool ToS (GitHub) | Unclear — no clause on commercial API use | None | Undisclosed (429) | **REVIEW** |
| PublicNode Ethereum RPC | Gas prices | publicnode.com/terms | Unclear (probably fine) | None | None stated | **REVIEW** |
| CARTO basemaps | Dark map tiles (Global map) | carto.com/legal/basemap-terms (updated 29 Sep 2026) | Yes on the free commercial tier **with an API key** (1M tiles/month); keyless requests may be watermarked; transition date 30 Nov 2026 for some commercial users | "© OpenStreetMap contributors, © CARTO", prominent | 1M tile requests/month (commercial) | **ON, ACTION BY 30 NOV** — credit now shown on the map; **Ben: create a CARTO account and API key** (we cannot create accounts) and add it to the style URL |
| Esri World Imagery / Hillshade / Shaded Relief | Satellite and terrain map styles | Esri Master License Agreement; TOU summary | No — needs an ArcGIS subscription; no redistribution | "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community" | — | **OFF** (`esri`) — styles removed from the picker |
| Natural Earth (via GitHub, jsDelivr world-atlas) | Country shapes | naturalearthdata.com terms | Public domain | Not required | — | **ON** |
| REST Countries | Country facts | restcountries.com/terms | No — free plan non-commercial | Credit + link | — | **OFF** (calls already removed) |
| Financial Modeling Prep | Economic calendar; equity and index quotes and history (the only live equity code path) | financialmodelingprep.com terms | No — no commercial use; display in apps needs an agreement | — | — | **OFF, fails closed** (`fmp`). Every FMP request goes through `fmpFetch()` in `src/services/api.js`, which checks the switch first; the calendar checks it too. With the switch off no request is made whatever key is set, and equities stay DEMO. Until 3 Nov 2026 any of `VITE_FMP_API_KEY`, `VITE_POLYGON_KEY` or `VITE_TD_API_KEY` turned on FMP requests (a Polygon key also badged them "Polygon"); the live bundle checked on 3 Nov 2026 has none of these keys (the key compiles to `demo`, equities to DEMO), so production made no FMP requests. Tested in `tests/dataSources.test.mjs` with each key |
| Twelve Data | Index constituents (planned) | twelvedata.com/terms | No — free tier: no commercial use or external display | — | — | **OFF** (`twelvedata`; no calls in code). `VITE_TD_API_KEY` no longer changes anything (it used to switch on FMP requests) |

## Central-bank policy rates (Global country panel)

Hand-entered, each read on **15 Nov 2026** from the bank's own website (press
release, decision page or official PDF; third-party sites were used only to
find the page). Held in `POLICY_RATES` in `src/data/verifiedConstants.js`
(`POLICY_RATES_CHECKED`); the panel shows the rate, the decision date and a
link to the page below, and marks it "may be out of date" 60 days after the
check. The ten largest banks (RBA, Fed, ECB, BoE, BoJ, BoC, RBNZ, PBoC, SNB,
Riksbank) are in their own blocks in the same file. Central-bank statements
are public announcements; no feed is called, so no API terms apply.

| Country | Rate | Value | Decision | Official page read |
|---|---|---|---|---|
| India | RBI repo rate | 5.50% | 2026-10-07 | https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=63742 |
| South Korea | BoK Base Rate | 3.00% | 2026-10-22 (held) | https://www.bok.or.kr/eng/main/main.do |
| Singapore | MAS | none: MAS sets no policy interest rate; it manages the S$ trade-weighted exchange rate (S$NEER) | 2026-10-14 | https://www.mas.gov.sg/monetary-policy/singapores-monetary-policy-framework |
| Brazil | BCB Selic target | 13.75% | 2026-11-04 (held) | https://www.bcb.gov.br/api/servico/sitebcb/copom/comunicados_detalhes?nro_reuniao=282 |
| Mexico | Banxico overnight interbank rate target | 6.25% | 2026-11-05, effective 2026-11-06 | https://www.banxico.org.mx/publicaciones-y-prensa/anuncios-de-las-decisiones-de-politica-monetaria/%7B43236252-D06E-5231-27E8-058810A86A52%7D.pdf |
| Argentina | BCRA | none: BCRA has had no monetary policy rate since June 2025; it targets monetary aggregates | 2025-06-30 | https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/informe-politica-monetaria-2026-T2.pdf |
| Saudi Arabia | SAMA repo rate | 4.50% | 2026-09-16 | https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-1169.aspx |
| UAE | CBUAE Base Rate | 3.90% | 2026-09-16, effective 2026-09-17 | https://centralbank.ae/media/dv3bo3ed/cbuae-raises-the-base-rate-by-25-basis-points-en.pdf |
| Egypt | CBE overnight deposit rate | 20.00% | 2026-10-29, effective 2026-11-01 | https://www.cbe.org.eg/en/news-publications/news/2026/10/29/13/08/mpc-press-release-29-october-2026 |
| Nigeria | CBN Monetary Policy Rate | 23.00% | 2026-09-22 | https://www.cbn.gov.ng/MonetaryPolicy/decisions.html |
| South Africa | SARB policy rate | 7.25% | 2026-09-23, effective 2026-09-25 | https://www.resbank.co.za/content/dam/sarb/publications/statements/monetary-policy-statements/2026/september/september-statement.pdf |
| Türkiye | TCMB one-week repo rate | 36.00% | 2026-10-22 | https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Main+Menu/Announcements/Press+Releases/2026/ANO2026-45 |
| Norway | Norges Bank policy rate | 4.50% | 2026-09-23 | https://www.norges-bank.no/en/news-events/news/Press-releases/2026/2026-09-24-rate/ |
| Russia | CBR key rate | 14.00% | 2026-10-23 (held) | https://www.cbr.ru/eng/press/keypr/ |
| Hong Kong | HKMA Base Rate | 4.25% | 2026-09-17 | https://www.hkma.gov.hk/eng/news-and-media/press-releases/2026/09/20260917-3/ |
| Taiwan | CBC discount rate | 2.00% | 2026-09-17 (held) | https://www.cbc.gov.tw/en/cp-448-192883-c5fa1-2.html |
| Vietnam | SBV refinancing rate | 4.50% | 2023-06-16 | https://www.sbv.gov.vn/en/l%C3%A3i-su%E1%BA%A5t1 |
| Thailand | BoT policy rate | 1.00% | 2026-10-28 (held) | https://www.bot.or.th/en/news-and-media/news/mpc/news-20261028-5FWvBPSf.html |
| Malaysia | BNM Overnight Policy Rate | 2.75% | 2026-11-05 (held) | https://www.bnm.gov.my/-/monetary-policy-statement-05112026 |
| Philippines | BSP target RRP rate | 5.50% | 2026-10-22, effective 2026-10-23 | https://www.bsp.gov.ph/statistics/keystat/sefi.pdf |
| Indonesia | BI BI-Rate | 5.75% | 2026-10-21 (held) | https://www.bi.go.id/en/publikasi/ruang-media/news-release/Pages/sp_2823326.aspx |
| Pakistan | SBP policy rate | 12.00% | 2026-10-26, effective 2026-10-27 | https://www.sbp.org.pk/assets/documents/press-release/PR-26-Oct-2026.pdf |
| Ukraine | NBU key policy rate | 16.50% | 2026-10-29, effective 2026-10-30 | https://bank.gov.ua/en/news/all/natsionalniy-bank-ukrayini-pidvischiv-oblikovu-stavku-do-165 |
| Chile | BCCh monetary policy rate | **not shown** | — | bcentral.cl blocked automated reading (Incapsula) on 15 Nov; not verified, so removed |
| Colombia | BanRep policy rate | **not shown** | — | banrep.gov.co behind a bot check on 15 Nov; not verified, so removed |

The rates these replaced were typed in May 2026 (Ukraine April 2025); 14 of the
21 that still exist had changed, among them Türkiye 42.50→36.00, Russia
21.00→14.00, Egypt 27.25→20.00 and Mexico 9.00→6.25. Singapore's "3.04 MAS"
was not a policy rate. `countryDatabase.js` carried a second set of typed
rates for about 40 countries, used when a country had no row here; it was
removed, and a euro member without a row shows the verified ECB rate.

## GDP growth and CPI by country (Global country panel)

Hand-entered, each read on **15 Nov 2026** from the national statistics
agency's own release, table or API (third-party sites only to find the page).
Held in `COUNTRY_STATS` in `src/data/verifiedConstants.js`
(`COUNTRY_STATS_CHECKED`, freshness guard: statistic, 60 days). GDP is shown
year on year where the agency publishes it; the measure is named on every
line. Australia and the US are reconciled with their agencies by
`npm run check-stats`. Euro members without their own row show the euro-area
figure, labelled. Agency releases are public statistics; no feed is called.

| Country | Figure | Value | Measure | Period | Released | Agency and page read |
|---|---|---|---|---|---|---|
| Australia | GDP growth | 2.1% | y/y, chain volume | Jun 2026 quarter | 2026-09-03 | ABS: https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release |
| Australia | CPI | 4.3% | CPI, 12 months (monthly) | Sep 2026 | 2026-10-28 | ABS: https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release |
| United States | GDP growth | 3.4% | q/q annualised | Q3 2026 | 2026-10-29 | BEA: https://www.bea.gov/data/gdp/gross-domestic-product |
| United States | CPI | 3.7% | CPI-U, 12 months | Sep 2026 | 2026-10-14 | BLS: https://www.bls.gov/cpi/ |
| China | GDP growth | 4.5% | y/y, constant prices | Q3 2026 | 2026-10-21 | NBS: https://www.stats.gov.cn/english/PressRelease/202610/t20261021_1965671.html |
| China | CPI | 0.7% | CPI, y/y | Oct 2026 | 2026-11-10 | NBS: https://www.stats.gov.cn/english/PressRelease/202611/t20261111_1965808.html |
| Japan | GDP growth | 0.9% | y/y, real, original series (2nd preliminary) | Q2 2026 | 2026-09-08 | Cabinet Office: https://www.esri.cao.go.jp/jp/sna/data/data_list/sokuhou/files/2026/qe262_2/tables/ritu-jg2622.csv |
| Japan | CPI | 2.1% | CPI all items, y/y | Sep 2026 | 2026-10-23 | Statistics Bureau: https://www.stat.go.jp/data/cpi/sokuhou/tsuki/index-z.html |
| United Kingdom | GDP growth | 1.9% | y/y (first quarterly estimate) | Q3 2026 | 2026-11-12 | ONS: https://www.ons.gov.uk/economy/grossdomesticproductgdp/bulletins/gdpfirstquarterlyestimateuk/latest |
| United Kingdom | CPI | 3.5% | CPI, 12 months | Sep 2026 | 2026-10-21 | ONS: https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/consumerpriceinflation/latest |
| India | GDP growth | 7.8% | y/y, real (constant 2022-23 prices) | Apr–Jun 2026 (Q1 FY2026-27) | 2026-08-31 | MoSPI: https://www.mospi.gov.in/uploads/latestreleasesfiles/1788174301107-Press%20Note%20on%20GDP%20Estimates%20for%20Q1%202026-27.pdf |
| India | CPI | 6.09% | CPI (Combined), y/y, provisional | Oct 2026 | 2026-11-12 | MoSPI: https://www.mospi.gov.in/uploads/latestReleases/latest_release_1794478693814_7c90e80f-9e64-4aa4-b44a-1dc727b0fed9_Press_Release_of_CPI_for_October_2026_.pdf |
| Canada | GDP growth | 0.8% | q/q, real, seasonally adjusted | Q2 2026 | 2026-08-28 | Statistics Canada: https://www150.statcan.gc.ca/n1/daily-quotidien/260828/dq260828a-eng.htm |
| Canada | CPI | 3.1% | CPI all-items, y/y | Sep 2026 | 2026-10-19 | Statistics Canada: https://www150.statcan.gc.ca/n1/daily-quotidien/261019/dq261019a-eng.htm |
| New Zealand | GDP growth | 2.6% | y/y, chain volume (production) | Jun 2026 quarter | 2026-09-17 | Stats NZ: https://www.stats.govt.nz/information-releases/gross-domestic-product-june-2026-quarter/ |
| New Zealand | CPI | 3.7% | CPI, 12 months (quarterly) | Sep 2026 quarter | 2026-10-22 | Stats NZ: https://www.stats.govt.nz/information-releases/consumers-price-index-september-2026-quarter/ |
| South Korea | GDP growth | 3.4% | y/y, real (advance estimate) | Q3 2026 | 2026-10-27 | Bank of Korea: https://www.bok.or.kr/eng/bbs/E0000634/view.do?nttId=11065943&menuNo=400423&relate=Y&depth=400423&programType=newsDataEng |
| South Korea | CPI | 2.8% | CPI all items, y/y | Oct 2026 | 2026-11-03 | Ministry of Data and Statistics: https://mods.go.kr/board.es?mid=a20101000000&bid=11751&act=view&list_no=447803 |
| Singapore | GDP growth | 5.4% | y/y, real (advance estimate) | Q3 2026 | 2026-10-14 | MTI: https://www.mti.gov.sg/newsroom/singapore-s-gdp-grew-by-5-4-per-cent-in-the-third-quarter-of-2026 |
| Singapore | CPI | 2.2% | CPI all items, y/y | Sep 2026 | 2026-10-23 | SingStat: https://tablebuilder.singstat.gov.sg/api/table/tabledata/M213781?search=All%20Items |
| Brazil | GDP growth | 2% | y/y, real | Q2 2026 | 2026-09-01 | IBGE: https://apisidra.ibge.gov.br/values/t/5932/n1/all/v/6561,6564/p/last%202/c11255/90707 |
| Brazil | CPI | 4.63% | IPCA, 12 months | Oct 2026 | 2026-11-12 | IBGE: https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/63,2265/p/last%202 |
| Mexico | GDP growth | 3.2% | y/y, real (timely estimate) | Q3 2026 | 2026-10-30 | INEGI: https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/pibo/pib_eo2026_10.docx |
| Mexico | CPI | 3.75% | INPC, annual | Oct 2026 | 2026-11-09 | INEGI: https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/inpc/inpc_2q2026_11.docx |
| Euro area | GDP growth | 1.3% | y/y, seasonally adjusted (flash) | Q3 2026 | 2026-11-13 | Eurostat: https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-13112026-ap |
| Euro area | CPI | 4% | HICP, annual (flash) | Oct 2026 | 2026-11-04 | Eurostat: https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-04112026-ap |
| Germany | GDP growth | 1.3% | y/y, price adjusted (first release) | Q3 2026 | 2026-10-30 | Destatis: https://www.destatis.de/EN/Press/2026/10/PE26_381_811.html |
| Germany | CPI | 2.8% | CPI, y/y (final) | Oct 2026 | 2026-11-11 | Destatis: https://www.destatis.de/EN/Press/2026/11/PE26_392_611.html |
| Indonesia | GDP growth, CPI | **not shown** | — | — | — | bps.go.id refused every automated request on 15 Nov; not verified, so not shown |

Every other country shows no GDP or CPI, with a note that more will be added
once verified. The country database's typed figures, ratings, outlook text
and rankings were removed the same day, and the World Bank country fetch is
switched off (`worldbank` in `src/data/sourceLicence.js`; its API terms are
under review).

## Release and meeting calendars (Dashboard, Calendar, Rates)

Read on **15 Nov 2026** from each publisher's own calendar. Held in
`src/services/calendarService.js` (`ECON_SCHEDULE_CHECKED`) and
`src/services/centralBankSchedule.js` (`MEETINGS_CHECKED`); freshness guard:
schedule, 30 days.

| Publisher | What | Calendar page read |
|---|---|---|
| ABS | CPI, Labour Force, National Accounts, Wage Price Index | https://www.abs.gov.au/release-calendar/future-releases/202611 (and /202612, /202701) |
| BLS | CPI, Employment Situation (08:30 ET) | https://www.bls.gov/schedule/news_release/cpi.htm, https://www.bls.gov/schedule/news_release/empsit.htm |
| BEA | GDP estimates (08:30) | https://www.bea.gov/news/schedule, https://www.bea.gov/news/schedule/next-year |
| RBA | Board decisions (2.30 pm) | https://www.rba.gov.au/schedules-events/board-meeting-schedules.html |
| Federal Reserve | FOMC decisions | https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm |
| ECB | Monetary policy meetings | https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html |
| Bank of England | MPC announcements | https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates |
| Bank of Japan | Monetary policy meetings | https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm |
| Bank of Canada | Rate announcements (09:45 ET) | https://www.bankofcanada.ca/2026/07/bank-canada-publishes-2027-schedule-policy-interest-rate-announcements-other-major-publications/ |
| SNB | Monetary policy assessments (09:30 CET) | https://www.snb.ch/en/services-events/digital-services/event-schedule |
| Riksbank | Policy rate decisions (09:30) | https://www.riksbank.se/en-gb/press-and-published/calendar/ |
| RBNZ | **not verified** | rbnz.govt.nz refused automated requests; dates held are flagged |
| PBoC | **not published** | No forward LPR calendar; the held date follows the monthly LPR rule and is flagged |

Corrections found: October AU CPI is released Wed 25 Nov (not 26); the SNB
assessment is 10 Dec (17 Dec was held); the Riksbank raised to 2.00% on
4 Nov (1.75% was held).

## Shipping chokepoint status (Global, Maritime tab)

Maddex's editorial label per chokepoint, reviewed **15 Nov 2026** from dated
reports listed on each row in `src/data/shippingRoutes.js` (`sources`):
UKMTO and JMIC advisories as reported by Gulf News and Lloyd's List
Intelligence, the Suez Canal Authority via Arab Finance, ReCAAP ISC,
gCaptain (Panama Canal Authority; Reuters), the WSJ via The Moscow Times,
and Alphaliner via Ship & Bunker. Labels: DISRUPTED (closure, attacks,
suspension or large-scale diversion reported), MONITORED (open with active
advisories or restrictions), OPEN (normal operation reported). Headlines no
longer change a status; globe lane statuses derive from this table.

## News feeds (headline, short summary, link to the publisher)

| Publisher | Terms | Commercial display? | Attribution | Status |
|---|---|---|---|---|
| RBA (speeches, media releases) | rba.gov.au/copyright | Yes | Source: RBA | **ON** |
| BBC News | bbc.com/news/10628494 | Use "as part of a website" encouraged; full ToU not read | "BBC News" (no logos) | **ON** — feed named "BBC News"; confirm commercial use against the full ToU |
| Yahoo Finance | legal.yahoo.com terms | Display permitted "without modification"; may be revoked | Attribution and link to the full article | **ON** — publisher named and linked |
| ABC News | Terms NOT FOUND (help.abc.net.au 403) | Unclear | — | **REVIEW** — on; ask the ABC |
| The Guardian | theguardian.com/help/feeds | No — personal, non-commercial | — | **OFF** |
| Sydney Morning Herald | smh.com.au/rssheadlines | No — personal, news readers only; syndication available | — | **OFF** |
| Australian Financial Review | Nine terms | No | — | **OFF** |
| CNBC | Versant terms | No | — | **OFF** |
| MarketWatch | Dow Jones terms | No — RSS barred from commercial products without consent | — | **OFF** |
| The New York Times | NYT terms of service | No | — | **OFF** |
| Nikkei Asia | info.asia.nikkei.com/rss | No — "Republication … expressly prohibited" | — | **OFF** |
| Mining.com | Terms NOT FOUND; paid republishing licence exists | — | — | **OFF** |
| OilPrice.com | oilprice.com terms | No | — | **OFF** |
| Cointelegraph | cointelegraph.com terms | No | — | **OFF** |
| CoinDesk | coindesk.com/terms | No | — | **OFF** |
| Investing.com | investing.com RSS page (full T&Cs 403) | No | — | **OFF** |
| The Economist | Economist Group terms | No | — | **OFF** |

The shared daily sentiment read (`/api/ai-daily`) now reads only ABC News and
BBC News headlines.

## Services

| Service | Use | Terms | Status |
|---|---|---|---|
| Anthropic API | MaddenAI | Commercial Terms §A.1 permit powering products for customers | ON |
| Resend | Alert emails, newsletter | Commercial service; requires recipients' consent | OFF in the app since 3 Nov 2026 (`EMAIL_DELIVERY_AVAILABLE` false: no sender confirmed in production). The newsletter script sends only an approved edition. |
| Supabase, Vercel | Database/auth, hosting | Commercial services | ON |

## Before launch (also in `docs/LEGAL_READINESS.md`)

1. CARTO API key (by 30 Nov 2026), or the dark basemap may be watermarked.
2. CoinGecko: 10k calls/month on the Demo plan will not cover browser-side calls from many users — server-side cache or paid plan.
3. Decide on the OFF sources: licence (DefiLlama Pro, Open-Meteo paid, IMF permission, news syndication) or leave off.
4. Ask ABC, Binance, Stooq, World Bank, mempool.space and PublicNode about commercial use (REVIEW rows).
5. A licensed ASX equities feed before equity prices stop being DEMO.
