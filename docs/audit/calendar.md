# Audit: Calendar

Phase D, 16 Nov 2026. Files: `src/modules/calendar/*`, `calendarService.js`,
`calendarExtras.js`, reminders in `alertsService.js`, `corporateActions.js`.
Surveyed with a read-only agent; each finding checked in the code before
building. No AI request is made on load.

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: honesty | "CONSENSUS" shown with no named source (the feed's `estimate` passed straight through) | `CalendarModule.jsx:261`, `calendarService.js:162` | Done 16 Nov: "FORECASTS" only with the source that published them |
| 2 | High: honesty | "MARKET SENSITIVITY" dots: the event's importance copied onto AUD, banks and bonds | `CalendarModule.jsx:274-277` | Done: removed |
| 3 | High: legal | Prompts: "likely market impact … what should investors watch for", "earnings preview … bull case, and bear case", "what matters most this year", "what should an Australian investor understand" | `CalendarModule.jsx:284,351-352`, `CorporateActions.jsx:78` | Done: describe only |
| 4 | High: times | Morning reminder at 8am browser time; reminders expire at browser midnight; "today", groupings and day counts in browser time | `calendarExtras.js:117,174`, `CalendarModule.jsx:121-128,555,589,615-618,726` | Done: Sydney (8am Sydney, Sydney calendar days) |
| 5 | Medium: times | Corporate-actions and alerts "today" in browser time | `CorporateActions.jsx:18`, `corporateActions.js:61`, `alertsService.js:47` | Done |
| 6 | Medium: judgement / badges | Event impact: "IF HOTTER" red, "IF COOLER" green, "AI-ESTIMATE" label outside the vocabulary | `EventImpact.jsx:19,28-29` | Done: neutral, AI badge, "not a forecast of this release". The feature itself is put to Ben as a legal question (see LEGAL_READINESS) |
| 7 | Medium: badges | Demo move as "(demo)" text; live feed badge did not name FMP | `PredictiveCalendar.jsx:141`, `CalendarModule.jsx:643` | Done |
| 8 | Medium: failure | "No events" shown while loading | `CalendarModule.jsx:168,733` | Done: loading state |
| 9 | Low: a11y | Month arrows unnamed | `CalendarModule.jsx:80,84` | Done |
| 10 | Low | Importance stars have no method note | `CalendarModule.jsx:383` | Later (Phase F design pass) |
