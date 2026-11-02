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
| World Bank API | Country data | datacatalog.worldbank.org/public-licenses; API terms | Conflicting — data CC BY 4.0, but API terms bar facilitating commercial use | Credit and note changes | Reasonable volume | **REVIEW** — ask, or ship the CC BY datasets as static files |
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
| Resend | Alert emails, newsletter | Commercial service; requires recipients' consent | ON — alerts are opt-in |
| Supabase, Vercel | Database/auth, hosting | Commercial services | ON |

## Before launch (also in `docs/LEGAL_READINESS.md`)

1. CARTO API key (by 30 Nov 2026), or the dark basemap may be watermarked.
2. CoinGecko: 10k calls/month on the Demo plan will not cover browser-side calls from many users — server-side cache or paid plan.
3. Decide on the OFF sources: licence (DefiLlama Pro, Open-Meteo paid, IMF permission, news syndication) or leave off.
4. Ask ABC, Binance, Stooq, World Bank, mempool.space and PublicNode about commercial use (REVIEW rows).
5. A licensed ASX equities feed before equity prices stop being DEMO.
