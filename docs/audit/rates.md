# Audit: Rates

Phase B, 15 Nov 2026. Files: `src/modules/fx/*` except the held RBA files
(RbaHeroCard, RbaDecisionCard, RbaDecisionPreview, RbaHikeImpact) and the
Rates banner, which are not touched; the data they read in
`src/data/placeholders.js`, `policySpread.js`, `rbaDecisions.js`,
`rbaCashRatePath.js` and `src/services/centralBankSchedule.js`. Surveyed with
a read-only agent; findings checked in the code before building.

## Findings, by impact

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: wrong figures | UK, JP and DE curves in Rates are typed July copies ("UK DMO · Jul 2026"), 84–142bp off the sourced November curves; the bond-spreads table (AU vs JP +362bp; sourced ≈ +220bp) and its "vs prev mo" tooltips use them | `FXModule.jsx:61-87, 806-811` | Done 15 Nov |
| 2 | High: forecast | `CB_EXPECTATION` (rba hold, fed hike, boj hike…) is an undated, unsourced "market-implied stance"; the EXPECTED column presents it as the terminal's view | `placeholders.js:44-47`, `UpcomingDecisions.jsx:106-170` | Done 15 Nov |
| 3 | High: prompt | "What is the RBA likely to do at the next meeting"; the daily policy-bias prompt asks for "the direction of travel" | `FXModule.jsx:461`, `aiDaily.js:316` | Done 15 Nov |
| 4 | High: three copies | RBA decisions are held three times (placeholders `RBA_RATE_HISTORY`, `verifiedConstants.rba.decisions`, `rbaDecisions.js`); the timeline misses the late-2025 holds | `CentralBankTracker.jsx:67`, `placeholders.js:187-204`, `verifiedConstants.js:91-107` | Done 16 Nov: history built from RBA_DECISIONS and the target table, holds included; a test ties all three together (verifiedConstants.rba.decisions, which the held card reads, unchanged) |
| 5 | Medium: spread | The AU–US spread is computed twice (announced rates in one panel, rates in force in the other); "as at effective date" shows today, not the date it took effect; no badge | `FXModule.jsx:560-597`, `PolicySpreadMonitor.jsx:61` | Done 16 Nov: one in-force computation; "as at effective date <today> · this level since <date>"; badge; Sydney day |
| 6 | Medium: wording | "A wider AU premium is … supportive for the AUD", "tends to weigh on the currency", "policy is restrictive", "AU carry premium vs Japan", "Steepening" for a level | `PolicySpreadMonitor.jsx:117`, `CentralBankTracker.jsx:200`, `FXModule.jsx:394, 806, 808` | Done 16 Nov |
| 7 | Medium: badges | One RBA badge stands for all ten banks; the TWI (31 Aug) carries the ABS badge and date | `CentralBankCards.jsx:249`, `CentralBankTracker.jsx:120`, `AudTwiCard.jsx:62` | Done 16 Nov: each bank names its source and date; TWI re-read (63.3, 13 Nov; the old figure was July's) with its own RBA badge, STALE past 30 days |
| 8 | Medium: time zones | Meeting countdowns roll at browser-local midnight; foreign decision dates shown as bank-local beside Sydney dates; SNB "09:30 CET"; prompts date "AEST" all year | `centralBankSchedule.js:55`, `UpcomingDecisions.jsx:133`, `askAI.js:28` | Done 16 Nov: each decision in Sydney time from the bank's own time and zone, the reader's zone beside it, countdowns in Sydney days; prompts name AEDT/AEST |
| 9 | Low | "NORMAL CURVE" when shape unknown; `cashRate.toFixed(2)%` may print `undefined%`; footnote about "~" out of date; HIKE green in some panels and red in others; history dates sorted as MM/DD strings | `FXModule.jsx:218, 691`, `UpcomingDecisions.jsx:139, 167`, `PolicyPathChart.jsx:26` | Later |

Held, not audited: the RBA decision card, the Rates banner and the four held
RBA files.
