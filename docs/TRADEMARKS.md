# Third-party names and marks

Every third-party name Maddex shows, and why. Maddex uses third-party names
only to say **what something is or where data came from** (nominative,
descriptive use) — never to suggest endorsement, affiliation or partnership,
and never as part of Maddex's own branding or marketing claims ("X-style", "as
good as X"). Logos of third parties are not used: coins get abstract colour
circles, publishers get colour dots.

Last reviewed: 1 Nov 2026 (legal-risk hardening, item 9).

## Removed

| Name | Where it was | Why removed |
|---|---|---|
| Bloomberg | README ("Bloomberg-style financial terminal") | A comparison to a third-party product in marketing copy. |
| Bloomberg | News source colour key | No Bloomberg feed is used; the entry implied one. |
| Bloomberg | ETF benchmark "Bloomberg AusBond Composite" | Shown as "AusBond Composite 0+ Yr Index". |
| Bloomberg | Central bank governor sources ("boj.or.jp (Bloomberg, …)") | The primary source (the bank's own site) is named; the press corroboration is kept in code comments only. |
| Bloomberg | Commodity and index-close source lines | Now "from published market reports". |
| Bloomberg | Code comment ("Bloomberg-terminal-style avatar") | Not user-facing, removed for consistency. |

## Scheduled (after the RBA decision on Tue 3 Nov 2026)

These strings render in the RBA decision-day card and Rates banner, which are
held unchanged until after 3 Nov. Change on 4 Nov to "market pricing, as
reported by ABC News (28 Oct 2026)":

- `VERIFIED_CONSTANTS.rbaNextDecision.marketSource`: "Bloomberg data, as reported by ABC News"
- `VERIFIED_CONSTANTS.rbaNextDecision.source`: "Bloomberg via abc.net.au (28 Oct); rba.gov.au"
- `VERIFIED_CONSTANTS.rba.nextMeetingNote`: "…(Bloomberg via ABC News, 28 Oct)"

Internal code comments recording where a figure was corroborated (for example
"Bloomberg: under $90 intraday") are research notes for maintainers, not
product copy, and are kept so the provenance can be re-checked.

## In use, and why

| Name(s) | Use | Basis |
|---|---|---|
| CoinGecko, Binance, alternative.me ("Crypto Fear & Greed Index"), DefiLlama, mempool.space, PublicNode | Named as the source of the crypto data shown | Source attribution; some providers require it (see `docs/DATA_SOURCES.md`). The Fear & Greed figure is always labelled "Crypto Fear & Greed (alternative.me)" so it is not confused with other indices of a similar name. |
| European Central Bank (via Frankfurter), ExchangeRate-API | Source of FX reference rates | Source attribution |
| Reserve Bank of Australia, Australian Bureau of Statistics, US Federal Reserve / FRED, US BLS, IMF, World Bank, other central banks | Source of official statistics and decisions | Source attribution; government publishers |
| USGS, OpenSky Network, Open-Meteo, OpenStreetMap (Nominatim), CARTO, Esri, Natural Earth | Map, seismic, flight and weather data and map tiles | Source attribution; several require on-map credit (see `docs/DATA_SOURCES.md`) |
| ABC News, The Guardian, Sydney Morning Herald, AFR, CNBC, MarketWatch, BBC, The New York Times, Nikkei Asia, Mining.com, OilPrice.com, Cointelegraph, CoinDesk, Yahoo Finance, RBA (speeches and releases) | Name of the publisher on each headline, linking to the article | Attribution of a headline to its publisher. Only the headline, a short summary and a link are shown — see `docs/DATA_SOURCES.md` for each feed's terms. |
| S&P/ASX 200, All Ordinaries, S&P 500, Nasdaq Composite, Dow Jones Industrial Average, FTSE 100, Nikkei 225, Hang Seng, SSE Composite, DAX, Sensex, S&P/TSX, AusBond Composite, JKM, SGX | Names of the indices, benchmarks and contracts whose levels are shown | Descriptive: the name is how the thing is identified. Index levels shown are DEMO or dated, sourced readings — never presented as licensed index data. |
| ASX, NYSE, Nasdaq, LME, SGX and other exchange names; company names and tickers (BHP, CBA, Wesfarmers, …) | Identify the listing venue and the security | Descriptive |
| ETF issuers and fund names (Vanguard, BlackRock iShares, BetaShares, …) | Identify the fund | Descriptive |
| Anthropic | Named in the Privacy Policy as the AI provider | Required disclosure of a third party receiving data. The product's assistant is Maddex's own "MaddenAI"; "Claude" is not used as a brand in the product. |
| Supabase, Vercel, Resend, Google (sign-in) | Privacy Policy; the Google sign-in button | Required disclosure; the sign-in button follows the provider's own branding rules |
| ASIC, APRA, AUSTRAC, OAIC, AFCA | Regulators named in factual context and in the legal pages | Descriptive. Maddex never states or implies it is licensed, regulated or approved by any of them (tested in `tests/legal.test.mjs`). |

## Rules for new copy

1. Name a third party only to identify it or to credit a source.
2. No comparisons to third-party products in marketing ("-style", "like X", "X for…").
3. No third-party logos.
4. Add the name to this file.
