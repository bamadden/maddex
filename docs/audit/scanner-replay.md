# Audit: Scanner and Replay

Phase D, 16 Nov 2026. Files: `src/modules/scanner/*`, `scannerService.js`,
`src/modules/replay/*`, `replayService.js`, `replayScenarios.js`. Surveyed with
a read-only agent; each finding checked in the code. No AI request is made on
load in either.

## Scanner

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: honesty / legal | Rate-sensitive tab gave reasons for simulated moves ("wider margins priced on hike expectations", "bond-like income losing appeal") | `scannerService.js:380-384` | Done 16 Nov: "higher / lower on the day" only |
| 2 | High: honesty | ANALYSE prompts sent demo prices as fact (one of six said "demo") | `MarketScannerModule.jsx:311,370,485` | Done: every prompt says the prices are simulated |
| 3 | Medium: legal | Trend verdicts (STRONG UPTREND, TURNING UP), "stretched", STRONG / WEAK grades, BREAKOUT green and OVERBOUGHT red | `scannerService.js:30,255`, `MarketScannerModule.jsx:27-29,120` | Done: the windows in words; LARGE / MEDIUM / SMALL size; non-up/down colours |
| 4 | Medium: legal | Pattern card "Confirms" (green) / "Invalidates" (red), and the prompt asked for them: a trading setup | `MarketScannerModule.jsx:564-569`, `scannerService.js:355` | Done: removed from prompt and card |
| 5 | Medium: times | "AEST" hard-coded; pattern cache keyed to the UTC day | `MarketScannerModule.jsx:70`, `scannerService.js:318` | Done |
| 6 | Medium: failure | Raw error text from pattern detection | `MarketScannerModule.jsx:523` | Done |
| 7 | Low | Settings gear unnamed; "every 2 minutes" though the interval is configurable | `:641, :323` | Done |
| 8 | Medium: honesty | "Detected" time is the scan time; momentum ScoreNote has no date | `:342, :427` | Next |

## Replay

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: honesty | Cash rate fell back to 0.75% for any date before Oct 2019 | `replayService.js:42` | Done: from the RBA target table (since 2008); "—" before |
| 2 | High: honesty | Random daily moves shown for BHP, CBA and others on real dates, green/red, no badge | `replayService.js:115`, `MarketReplayModule.jsx:228-233` | Done: removed |
| 3 | High: honesty | "On this day" events unsourced and contradicting the scenarios (iron-ore peak 15 Jul vs 12 May; RBA cut on its effective day) | `replayService.js:52-63` | Done: built from the RBA decision record and target table, each with its source |
| 4 | Medium: honesty | Free-browse random-walk "ASX 200" level labelled only "illustrative" | `MarketReplayModule.jsx:184` | Done: "simulated index path" with the DEMO badge |
| 5 | Medium: judgement | Green on non-price facts (rate rises, hikes count, iron-ore level, profit) | `replayScenarios.js:217-219,298-300` | Done: neutral |
| 6 | Low: legal | Prompt asked "what an Australian investor can learn" | `ScenarioPlayer.jsx:221` | Done: describe what happened |
| 7 | Medium: times / a11y | "Today" is the UTC date; seek bar mouse-only; close button unnamed | `MarketReplayModule.jsx:17,171`, `ScenarioPlayer.jsx:145` | Done |
