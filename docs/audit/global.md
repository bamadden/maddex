# Audit: Global

Phase 5, 5 Nov 2026. Files: `src/modules/global/*` (GlobalModule.jsx ~2,900
lines, IntelPanel, MapDetailPanel, DeckGLMap, intelMapData),
`src/components/global/GeopoliticalImpact.jsx`,
`src/services/geopoliticalImpactService.js`. Surveyed with a read-only
agent; the top findings were checked in the code before building.

## Findings, by impact

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: legal, honesty | VIEW PORTFOLIO IMPACT showed an "estimated impact" in A$ for each holding: a hash-seeded random shock (3–6% for HIGH) applied to DEMO prices, a total, and forecasts (oil "10–15% move over the following 3 months", "+0.2–0.4% to AU CPI", RBA cut "probability"). | `geopoliticalImpactService.js` (`mulberry32`, `EXPOSURE_SHOCK`, `macroImpact`) | Done 5 Nov: links only (named for the route / sector link / no direct link), cost channels without numbers or forecasts, AI prompt asks to describe only |
| 2 | High: honesty | Bilateral trade values, balances and trends are generated from a hash of the two country names and shown in A$, under a faint "Illustrative". | `GlobalModule.jsx` `partnerTradeStats` | Next |
| 3 | High: honesty | Hand-typed current events contradict each other and carry no as-of date: Hormuz "largely closed since 28 Feb … Brent above US$100" vs status MONITORED and Brent 76.50 "May 2026". | `intelMapData.js:84`, `GlobalModule.jsx:421, 1568` | Done 5 Nov: route status, notes and entry dates live in `data/shippingRoutes.js`, read by the panel, the impact view and the map; Hormuz DISRUPTED everywhere; Brent, iron ore, JKM and Newcastle coal in Commodity Flows and on the map come from verifiedConstants with date and source; route notes and zone text carry no figures |
| 4 | High: honesty | The map status reads "LIVE DATA · n/m SOURCES ACTIVE", counting static tables (exchange sessions, trade routes) and AI prose as sources. | `DeckGLMap.jsx:1080–1083, 1385` | Next |
| 5 | High: legal | Hand-typed severity/risk scores (98, 88) carry the country-risk ScoreNote though they are not from that rubric; "Trade Risk Score /100" and "Avg Geo Risk" carry none. | `MapDetailPanel.jsx:203, 251`; `GlobalModule.jsx:821, 1169, 2374` | Next |
| 6 | High: legal | Trading-flavoured labels: "LNG price windfall", "defence stocks bid", "Australian exports at risk", "↑ Momentum · LNG, Coal up", "Monitor AU energy/commodity exposure", "Security escorts recommended". | `intelMapData.js:88, 147, 165, 109`; `GlobalModule.jsx:1597, 1260` | Next |
| 7 | High: legal, AI | The AI narrative can overwrite text fields that already hold figures ("Freight rates +340%"); Ask AI prompts ask for a "freight cost outlook" and "market impact". | `intelMapData.js:311`; `GlobalModule.jsx:1336, 1759` | Part done 5 Nov: AI map text holding a digit is dropped; the route Ask AI prompt is descriptive. The other prompts remain |
| 8 | Medium: honesty | No DataBadge anywhere in the module; hand-typed figures are undated or disagree (header "May 2026", body "As at Jun 2026"; Ukraine macro "Apr 2025"). | `GlobalModule.jsx` | Next |
| 9 | Medium: honesty | Licensed-off sources vanish silently (flights, weather) and OpenSky is still polled every 5 minutes, failing each time. | `GlobalModule.jsx:1400, 1919, 2566` | Next |
| 10 | Medium: zones | The map clock shows Brisbane time labelled "AEST"; in November Sydney is AEDT, an hour ahead. | `DeckGLMap.jsx:1297` | Next |
| 11 | Medium | Exchange volume and market cap hand-typed and undated, every exchange in "A$"; "Freightos Baltic Air Index · hardcoded Jun 2026" on screen; Hormuz "~35Mt crude oil/day" looks wrong (~20 mb/d is ~2.7Mt/day). | `intelMapData.js:17`; `MapDetailPanel.jsx:180`; `GlobalModule.jsx:425, 1551` | Part done 5 Nov: route cargo values, the "$25.4T" total and the Hormuz tonnage removed. Exchange figures and the air-freight index remain |
| 12 | Medium | News "severity" (CRITICAL/HIGH) is a keyword match shown as an assessment; chokepoint status also flips on keywords. | `GlobalModule.jsx:590–616, 1747` | Next |
| 13 | Low | "Open now" exchange count computed once; console noise; ✕ buttons unlabelled; filters without `aria-pressed`; ticker without pause; clickable `div`s; Esri code kept though licensed off. | various | Later |

What works: maps load lazily; OSM/CARTO attribution is drawn on the map;
Esri is hidden by the licence switch; CommodityIntel dates each figure and
shows "—" when missing; GeoRiskCards carry the rubric note and review date;
index levels are badged DEMO; the location-search prompt forbids figures
the model was not given.
