# Audit: Portfolio

Phase D, 16 Nov 2026. Files: `src/modules/portfolio/*`,
`src/components/portfolio*/*`, `src/services/portfolio*.js`,
`transactionService.js`. Surveyed with a read-only agent; each finding
checked in the code before building.

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: legal | "BUILD WITH AI": MaddenAI chose stocks and weights "that suit the stated criteria" and the result could be imported as holdings | `portfolioBuilderService.js:33,49` | Done 16 Nov: removed (a recommendation however worded) |
| 2 | High: legal | Prompts asked "What should I consider?", "what the investor might consider", "What should I know before then?", "what to watch next" | `StressTest.jsx:203`, `WhatIf.jsx:144`, `PortfolioModule.jsx:768`, `PortfolioBanners.jsx:56,65` | Done: describe only |
| 3 | High: honesty | Missing day % shown and summed as 0 | `PortfolioModule.jsx:673` | Done: null, left out of the day total; a real 0.00% now shows |
| 4 | High: honesty | Dividend estimate fell back to a mock yield, then 0, unlabelled | `performanceModel.js:22` | Done: the holding's own yield or none |
| 5 | High: judgement | Beta, volatility, Sharpe and drawdown coloured red/amber/green; "market average of ~1.0" with no source | `PerformanceTab.jsx:768-791` | Done: one neutral colour, no unsourced average |
| 6 | Medium: judgement | What-If arrows green/red as "better/worse"; yield and franking green; tilts "OVERWEIGHT / UNDERWEIGHT" in green/red | `WhatIf.jsx:79`, `PortfolioAnalytics.jsx:76,79,347` | Done: neutral; "above / below the index" |
| 7 | Medium: honesty | An invented "diversification score" and a rate "pressure" forecast in the no-AI panel | `PortfolioModule.jsx:237` | Done: composition computed from the holdings |
| 8 | Medium: times | "Today" in UTC or browser time in six places; drawdown dates browser-local | `Transactions.jsx:25`, `PerformanceTab.jsx:819,794`, `portfolioCsv.js:116,260`, `transactionService.js:90`, `PortfolioSnapshot.jsx:211` | Done: `sydneyISO()` and formatDate |
| 9 | Medium: failure | Raw error text in the add form | `PortfolioModule.jsx:343` | Done: a plain sentence |
| 10 | Low: a11y | Icon-only buttons with no name | `WhatIf.jsx:221`, `PortfolioSnapshot.jsx:223` | Done |
| 11 | Medium: badges | Performance, Stress, What-If, Analytics and Transactions tabs use ad-hoc labels rather than the shared badges | various | Next |
| 12 | Low: a11y | Holdings rows clickable without keyboard support | `PortfolioModule.jsx:1172` | Next |
| — | — | Account writes only after confirmation (PortfolioSyncBar) | — | Done 16 Nov (Phase C) |
