# Audit: Markets

Phase 5, 5 Nov 2026. Files: `src/modules/markets/*` (20 files). Surveyed
with a read-only agent; the top findings were checked in the code before
building. (Equity prices are DEMO until a licensed feed is chosen.)

## Findings, by impact

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: honesty | The sentiment score takes 35% of its weight from simulated ASX moves, is headed "COMPUTED FROM MARKET DATA", and its only DEMO badge (beside the breadth gauge) is hidden below `md`. | `MarketSentimentBanner.jsx:346, 513`; `maddenAiScoring.js:68` | Next |
| 2 | High: legal | AI prompts ask for "sector outlook, and implications for investors", "key stocks to watch, and the outlook for the next few weeks", "what should I watch?". | `SectorHeatmap.jsx:817`; `SectorDeepDive.jsx:743`; `TopMovers.jsx:225` | Done 5 Nov: all six Markets prompts (also CorrelationExplorer, UpcomingListings) describe only; a test reads every prompt and runs it through adviceIntent |
| 3 | High: legal | "money moving from weaker to stronger" states flows as fact from price changes. | `SectorHeatmap.jsx:1121` | Next |
| 4 | High: honesty | Hand-typed "approximate" ASX 200 weights shown as a WEIGHT column, no source or date. | `SectorHeatmap.jsx:440, 1612` | Next |
| 5 | High: honesty | Missing prices passed to the stock modal as 0 ($0.00, 0.00%); missing sector moves as 0% in the 3D view and composite colour; missing ASX changes averaged as 0% into the score ("ASX flat"). | `SectorHeatmap.jsx:897, 1250, 1341, 1530`; `maddenAiScoring.js:73, 196` | Next |
| 6 | Medium: honesty | "Updated" times are render times, not fetch times; TopMovers' has no zone; LIVE badges without a time; fresh index data shows no class. | `TopMovers.jsx:317`; `SectorHeatmap.jsx:791, 1082`; `IndicesTable.jsx:360` | Next |
| 7 | Medium | Volatility banner "check news before acting"; daily FX labelled "live"; "Staples typically outperform…"; plain-text DEMO and "INDICATIVE" outside the badge vocabulary; "VIX EQUIVALENT" is realised, not implied, volatility. | `VolatilityBanner.jsx:48`; `sectorDrivers.js:46, 232`; `MarketInternals.jsx` | Next |
| 8 | Medium: a11y | No keyboard access in the module's own components (no `tabIndex`, `onKeyDown` or `aria-label`); unlabelled icon buttons and calendar day cells; sector alerts through `window.prompt`. | `TopMovers.jsx:216`; `SectorHeatmap.jsx:999, 1163`; `EarningsCalendar.jsx:151, 165` | Next |
| 9 | Low | "20/200 LOADED" uses the index size as the denominator; unsourced earnings dates look like sourced ones; sentiment history times without a zone; `MarketBreadth.jsx` unused; console noise; hard-coded GBP fallback rate. | various | Later |

"Volume conviction" (the open item from Phase 2) is no longer in the sector
heatmap; the remaining copy is the crypto momentum factor (crypto.md #6).

What works: the volume card is DEMO-badged with Sydney time and no claims
about who traded; sector rotation summary is built from the numbers;
MarketRelationships refuses pairs without real data; the earnings calendar
declines an invented beat rate; the correlation and sentiment scores carry
ScoreNotes; sector strength shows "—" when missing.
