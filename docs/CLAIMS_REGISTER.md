# Claims register

Every factual claim Maddex makes about itself — in the terminal, onboarding,
upgrade and pricing copy, the legal pages and page metadata — with the evidence
that it is true and the test that keeps it true. A claim with no evidence is
removed or softened, and listed under **Removed or softened**.

Last full pass: 1 Nov 2026 (legal-risk hardening, item 5). Tests named here run
in `npm test` (unit) or `npm run test:ui` (browser, AI mocked).

**How to use this file.** Before adding copy that states a fact about the
product — "live", "sourced", "verified", a count, a capability — add a row here
with its evidence and a test. If you cannot fill the evidence column, do not
ship the claim.

## 1. Previously audited items (fixed first)

| # | Claim on screen (before → after) | Where | Evidence | Test | Status |
|---|---|---|---|---|---|
| A1 | US$ crypto prices shown as A$ → converted at the dated ECB AUD/USD rate, or labelled US$ | Crypto, tape, watchlist, command bar | `dataService.fetchCryptoMarketsUnified` meta `{currency, provider, fx}`; `utils/cryptoSource` | `tests/cryptoCurrency.test.mjs` | Fixed `fcd937a` |
| A2 | "LIVE PRICES" on demo equity data → DEMO | Portfolio | `PortfolioModule` uses `USING_MOCK_DATA` | `tests/honesty.test.mjs` "Portfolio does not count demo prices as live" | Fixed `5728733` |
| A3 | "live P&L" in upgrade copy → removed | Plans | `services/plans.js FEATURE_COPY.portfolio` | `tests/honesty.test.mjs` | Fixed `5728733` |
| A4 | "DARK POOL SIGNALS" → "Volume vs 20-day average", DEMO | Markets | `UnusualActivityTracker` | `tests/honesty.test.mjs` "no screen claims dark-pool data" | Fixed `29285ea` |
| A5 | Four conflicting sentiment numbers → one computed score; the AI gives words only | Top bar, Markets, dashboard, Overview, News, Brief | `hooks/useMarketSentiment` | `tests/honesty.test.mjs`; UI "same score in N places" | Fixed `d2aad79`, `89583ed` |
| A6 | Missing STALE badges → STALE when a feed fails and a cached copy is shown | Crypto, tape, dashboard, FX | `utils/dataClass.classOfResult`, `classOfLiveSource`, `classOfDailySource` | `tests/dataClass.test.mjs`; UI "STALE appears when a feed fails" | Fixed `e254613` |
| A7 | A fixed AUD/USD of 0.6520 converted US$ figures → "—" without a rate | Watchlist, Portfolio, dashboard, Global | `hooks/useAudRates` | `tests/honesty.test.mjs` "a US$ figure without an AUD/USD rate" | Fixed `46a995b` |
| A8 | An AI-written 0–100 "MaddenAI score" on the Brief → outlook in words | Brief, dashboard widget, share text/image | `morningBriefService` prompt | `tests/honesty.test.mjs` "no MaddenAI prompt asks for a score" | Fixed `89583ed` |

## 2. Data claims

| # | Claim | Where | Evidence | Test | Status |
|---|---|---|---|---|---|
| D1 | Crypto prices are LIVE (CoinGecko; Binance fallback converted and labelled) | Crypto, tape, Overview, plans "Live crypto prices (CoinGecko)" | `dataService` providers; badge from `classOfResult` | `tests/cryptoCurrency.test.mjs` | True |
| D2 | FX is the ECB's daily reference rate — **DELAYED, not live** | Tape "FX · DELAYED · ECB DAILY", status bar "FX DAILY", FX widget, Rates AUD/USD and FX grid, Dashboard Market State (all DELAYED with the ECB rate date), plans "FX reference rates (ECB, daily)" | `api.fetchFxRates` → Frankfurter `/latest`; widget source open.er-api.com (daily) | `tests/claims.test.mjs` "FX is labelled daily, never live" | Corrected 1 Nov (was "Live FX rates", "FX LIVE") |
| D3 | Equity and index prices are DEMO until a licensed feed is connected | Every equity/index surface, status bar "EQUITIES DEMO", tape "INDICES · DEMO" | `services/mockData`, `USING_MOCK_DATA` | `tests/honesty.test.mjs`; UI tape | True |
| D4 | Official statistics (RBA, ABS) are VERIFIED, with the publication date | Macro, Rates, Brief | `data/verifiedConstants.js`; `npm run check-stats` reconciles against agency APIs | `npm run check-stats` (11 series match, in the commit gate) | True |
| D5 | The market sentiment score is computed in code from listed inputs, not by AI | Every sentiment card; method in ScoreNote | `services/maddenAiScoring.calculateMarketSentimentScore`; `data/methodology.js` | `tests/honesty.test.mjs` "the score is computed in code"; `tests/scores.test.mjs` | True |
| D6 | "72 stocks" in the sentiment and breadth inputs | Sentiment method, Market Internals | `ASX_UNIVERSE.length === 72` | `tests/claims.test.mjs` "counts on screen match the data" | True |
| D7 | "21 Australian ETFs" | ETF module subtitle, release notes | `AU_ETFS.length === 21` | `tests/claims.test.mjs` | True |
| D8 | News count "{n} sources" | News subtitle | computed from `NEWS_SOURCES.length` | (computed, cannot drift) | True |
| D9 | Recession and geopolitical scores are rubrics over dated, published inputs, not forecasts | Macro, Global | `data/recessionRisk.js`, `data/geopoliticalRisk.js` | `tests/scores.test.mjs` | True |

## 3. AI claims

| # | Claim | Where | Evidence | Test | Status |
|---|---|---|---|---|---|
| I1 | MaddenAI gives general information only and never recommends buying, selling or holding | System prompt, onboarding, every reply | `services/systemPrompt.js` (THE ADVICE LINE); `services/adviceGuard.js` checks every reply | `tests/adviceBoundary.test.mjs` (46 attacks) | True (enforced in code) |
| I2 | ~~"Every figure it quotes is one the terminal handed it" / "it never sources a number itself"~~ → "instructed to quote only figures the terminal gives it" | Welcome, setup tour, Settings | Prompt rule only; **not enforced in code** | `tests/claims.test.mjs` "no absolute AI-figure claim" | Softened 1 Nov |
| I3 | AI does not originate scores | Brief, sentiment | prompts ask for words only | `tests/honesty.test.mjs` | True |
| I4 | AI content is labelled as AI and carries the AI-assisted note when exported | Brief, research notes, newsletter | `services/disclosures.AI_ASSISTED`, `reportFooter` | `tests/reports.test.mjs` | True |

## 4. Product and plan claims

| # | Claim | Where | Evidence | Test | Status |
|---|---|---|---|---|---|
| P1 | Prices and limits (Core free; Prime A$29; Apex A$79; AI 10/50/unlimited a day; watchlist 5; alerts 10) | Pricing, upgrade prompts | `services/plans.js` (single source) | `tests/claims.test.mjs` "plan copy matches the limits" | True in code. **Server enforcement of AI limits needs migration 009 in production — status unconfirmed** |
| P2 | "7-day free trial — full Apex access" | Sign-up | migration 003: `trial_ends_at = now() + 7 days`; trial tier = Apex | — | True if migration 003 is applied (it is, per the 27 Oct probe) |
| P3 | Email alerts (Prime) | Plans, alerts | `api/alert-email.js` via Resend | — | **Needs Ben: true only if `RESEND_API_KEY` is set in production** |
| P4 | ~~"API access — Pull Maddex data into your own spreadsheets"~~ → "API access (beta, demo data)" | Plans, upgrade prompt | `api/terminal-api.js` serves the mock data layer and accepts any well-formed key (no tier check yet) | `tests/claims.test.mjs` | Softened 1 Nov |
| P5 | ~~"Priority support"~~, ~~"Early access to new features"~~ | Plans | No support process or early-access mechanism exists | `tests/claims.test.mjs` | Removed 1 Nov |
| P6 | "Live ASX prices" — marked SOON, not included | Plans | no feed connected | `tests/honesty.test.mjs` | True |
| P7 | Export everything: one ZIP with portfolio, transactions, watchlist, alerts, research notes as PDFs and settings | Plans | `services/exportAllService.js` | — | True |
| P8 | Watchlist sharing shows tickers, prices and moves, never alerts, notes or targets | Plans | `SharedWatchlistPage`, share service | — | True |
| P9 | Portfolio sharing shows percentages only — no dollar amounts, no holdings | Plans | `SharedPortfolioPage` (percentages only) | — | True |

## 5. Graph and sourcing claims

| # | Claim | Where | Evidence | Test | Status |
|---|---|---|---|---|---|
| G1 | "Every edge sourced" / "EVERY EDGE IS SOURCED" | Relationships | `data/graph/schema.js` rejects an edge without source and confidence; approved edges need a recorded human review | `tests/graphVerify.test.mjs`, `tests/graphReview.test.mjs` | True |
| G2 | "Connected exposure, not forecast · not a recommendation" | Ripple views | ripple is graph traversal, no prediction | `tests/scores.test.mjs` | True |
| G3 | "Profile · every fact sourced or marked" | Company profile | each profile fact carries a source or an UNSOURCED mark | none automated | True by construction; **no test — spot-check before launch** |

## 6. Legal and status claims

| # | Claim | Where | Evidence | Test | Status |
|---|---|---|---|---|---|
| L1 | Maddex does not hold an AFSL and gives general information only | Disclaimer, footer, acknowledgement, exports | `services/disclosures` | `tests/legal.test.mjs` scans src for any licence/ASIC-approval claim | True |
| L2 | Terms and Privacy are drafts pending legal review | /terms, /privacy, sign-up | `data/legalVersions.LEGAL_STATUS` | UI "/terms is marked DRAFT" | True |

## Removed or softened (1 Nov 2026)

- "Live FX rates", "FX LIVE", FX widget LIVE badge → ECB daily reference rates, DELAYED.
- 3 Nov 2026: two places still said it. Rates "AUD/USD · LIVE" (with the panel's render time as if it were the data time) and Dashboard Market State "LIVE · FX · Frankfurter" → DELAYED, dated by the ECB's rate date. Every FX pair's "▲0.00%" was an invented zero (the ECB publishes no change) → "—". `tests/fxLabels.test.mjs`.
- "Crypto, FX, commodities and global indices from live feeds" (welcome) → crypto live, FX daily, equities and indices DEMO.
- "Every figure it quotes is one the terminal handed it" / "it does not produce numbers of its own" / "it never sources a number itself" → "instructed to quote only figures the terminal gives it"; AI can make mistakes.
- "Every figure is labelled with one of four classes" (data key) → panels are labelled; unbadged panels state their source in their caption.
- "Priority support", "Early access to new features" → removed (nothing behind them).
- "API access — pull Maddex data into your own spreadsheets" → "API access (beta, demo data)".
- "…country risk on one live map" → "on one map".
