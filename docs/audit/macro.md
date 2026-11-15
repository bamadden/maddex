# Audit: Macro

Phase B, 15 Nov 2026. Files: `src/modules/macro/*`,
`src/components/macro/IndicatorForecaster.jsx`, the series in
`src/data/placeholders.js`, `recessionRisk.js`, `marketRegime.js`. Surveyed
with a read-only agent; findings checked in the code before building.

## Findings, by impact

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: wrong figures | Typed survey series were wrong (Westpac Jan 83.5 held, 92.9 published; NAB Mar +4 held, −29 published); trade balance a release behind (Aug A$495m, revised to A$184m; Sep A$2,826m out 5 Nov) | `placeholders.js`, `verifiedConstants.au` | Done 15 Nov: re-read from Westpac, NAB and the ABS |
| 2 | High: wrong / licensed | Iron ore history labelled "SGX / Platts", typed, undated, with a "$90 support" line; China Watch typed (GDP 4.8% Q1, CPI 0.1% Apr) against the NBS (4.5% Q3, 0.7% Oct), with typed sparklines and "impacts AUD outlook" | `MacroModule.jsx`, `placeholders.js` | Done 15 Nov: removed; China from COUNTRY_STATS, iron ore one dated reading |
| 3 | High: wrong text | Fallback regime: "RBA and Fed are both tightening above neutral" (Fed held 28 Oct), "PMI below 50 in China and Europe", typed SLOWING / RISING / RESTRICTIVE tiles | `MacroModule.jsx` | Done 15 Nov: facts from the constants |
| 4 | High: prompts | RBA prompt asks what the RBA is "likely" to do, from a typed 2026 history missing the 3 Nov hike; deep-dive and dashboard prompts written "for an investor"; China prompt asks for an "outlook" | `MacroModule.jsx:570`, `MacroDeepDive.jsx:90`, `IndicatorForecaster.jsx:104` | Next |
| 5 | Medium: defaults | Missing values shown as typed defaults (`?? 2.4`, `?? 0`) | `MacroModule.jsx` | Done 15 Nov |
| 6 | Medium: labels | CPI rows read "as at Oct 2026" for September monthly CPI; 6401.0 (quarterly) linked for monthly; "RBA's preferred measure" on the monthly trimmed mean; US CPI against the Fed's 2% (a PCE goal) | `placeholders.js:87`, `IndicatorForecaster.jsx:46`, `recessionRisk.js:274` | Next |
| 7 | Medium: advice framing | "PORTFOLIO IMPLICATIONS … for Materials investors"; "defensives and bonds usually lead"; "Watch for immediate repricing"; `beat` flags shown as green/red | `MacroModule.jsx:1636, 1174`, `marketRegime.js:88`, `placeholders.js:86` | Next |
| 8 | Medium: scores | Regime quadrant has no ScoreNote; three vocabularies (RECESSION / CONTRACTIONARY / CONTRACTION) and two CPI cut-offs | `RegimeQuadrant.jsx`, `MacroDeepDive.jsx` | Later |
| 9 | Medium: time zones | FOMC "2:00pm EST"; countdowns and "Today" in browser-local time; DeepDive uses Australia/Brisbane | `MacroModule.jsx:456, 495`, `MacroDeepDive.jsx:60` | Later |
| 10 | Low | Typed NAIRU "~4.25%", TREND_GDP 2.25 three times, RBA board list undated, typed next-release hints | various | Later |
