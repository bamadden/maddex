# Audit: Brief

Phase D, 16 Nov 2026. Files: `src/modules/brief/*`, `morningBriefService.js`,
`weeklyReviewService.js`. Surveyed with a read-only agent; each finding
checked in the code before building. No AI request is made on load.

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: legal | Daily prompt: "senior financial analyst", "a fact … or a judgement", "WHAT TO WATCH TODAY … things to monitor", "what offshore moves mean for a Sydney open" | `morningBriefService.js:19-50` | Done 16 Nov: describe only; SCHEDULED TODAY lists supplied events with Sydney times; event importance copied from the schedule, never rated by the model |
| 2 | High: legal | Weekly prompt: "Analytical, not descriptive", "what it means for the RBA path", "what to watch for" | `weeklyReviewService.js:270-291` | Done: describe only |
| 3 | High: legal | MaddenAI system prompt: "what would have to be true for it to do well or badly, what to watch next", bull and bear cases, "key levels" | `systemPrompt.js:28,42,66,68,73,116` | Done: what is reported, scheduled and disclosed; no scenarios |
| 4 | High: honesty | Missing Bitcoin 24h change and portfolio day moves sent to the model as 0 | `morningBriefService.js:176,298` | Done: left out |
| 5 | High: scores | "MADDENAI OUTLOOK" with no method note | `MorningBriefModule.jsx:181`, `BriefExtras.jsx:54`, `briefImage.js:59` | Done: "TONE READ · not a call" with ScoreNote |
| 6 | Medium: times | Prompt date in browser time, "Time: 7:00 AM" whatever the time, "AEDT" hard-coded; RBA countdown to browser midnight; "7am Sydney time" (the boundary is 7am Brisbane, 8am AEDT in summer) | `morningBriefService.js:309-321`, `MorningBriefModule.jsx:66,87,363` | Done: Sydney date and clock with zone; one label everywhere (`briefHourLabel`) |
| 7 | Medium: badges / failure | Hand-made "DEMO PRICES" span; "Loading prices…" forever on failure | `BriefExtras.jsx:24,37` | Done: shared badges, a failure line |
| 8 | Low: failure | Raw error text | `MorningBriefModule.jsx:327`, `WeeklyReview.jsx:71` | Done |
| 9 | Low: risk | Unused auto-generate functions "called at app start" | `morningBriefService.js:358`, `weeklyReviewService.js:331` | Done: removed |
| 10 | — | "Generated" time shows Sydney with zone and the reader's own | `MorningBriefModule.jsx:524` | Done |
