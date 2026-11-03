# Audit — accounts, onboarding and tiers (task 11)

3 Nov 2026, against the standing rules. Ranked by impact (user trust and
legal exposure first). Status: findings only; nothing built yet.

## Findings

| # | Impact | Finding | Where | Fix |
|---|---|---|---|---|
| 1 | High — false claim | Portfolio's empty state promises "real-time P&L"; equity prices are DEMO (simulated) until a licensed ASX feed is connected. | `modules/portfolio/PortfolioModule.jsx:932` | "See P&L at demo prices (labelled DEMO) until a licensed ASX feed is connected", or name what is real. Test: no "real-time"/"live" claim beside equity figures. |
| 2 | High — mis-sold tier | The Apex card lists "Export all data" as an Apex feature. Export (and delete) is available to every user since the privacy work, and is a privacy right, not a paid feature. | `services/plans.js` `PLAN_CARDS.apex` | Remove from the Apex list; add "Export or delete your data, any plan" to the shared footer of the comparison. Test: no plan card lists export/delete as plan-gated. |
| 3 | High — claim depends on unconfirmed config | "Email alerts" (Prime) needs `RESEND_API_KEY` in production; not confirmed (claims register P3, `LEGAL_READINESS` open item 4). | `PLAN_CARDS.prime` | Ben confirms the key, or the line becomes `'soon'`. |
| 4 | High — limit shown, enforcement unconfirmed | "MaddenAI (10 / 50 queries/day)" is enforced server-side only once migration 009 is applied in production (not confirmed). Client-side counting can be bypassed. | `PLAN_CARDS`, `api/claude.js` | Ben confirms 009; until then the comparison should not promise server-enforced limits to other users (it is a limit, so over-delivery is not misleading to buyers — lower risk than 3). |
| 5 | Medium — "live" applied to mixed data | "Refresh all live data", "FETCHING LIVE DATA…", "REFRESH ALL LIVE DATA" refresh demo equities, delayed FX and live crypto alike. | `App.jsx:275,294,710`, `ModuleStates.jsx:21`, `SettingsPanel.jsx:2494`, `TopBar.jsx:306`, `shortcutService.js:75,79` | "Refresh all data" / "Loading data…". Test: the word "live" only beside a LIVE-class source. |
| 6 | Medium — "API access (beta, demo data)" | Listed for Apex; is there a working, documented endpoint? Not checked in this audit. | `PLAN_CARDS` | Verify; if none, mark `'soon'`. |
| 7 | Medium — tier comparison has no "what is demo" line | Core lists "Live ASX prices — soon", but Prime/Apex do not say equities are demo on every plan. | `PlanModals.jsx`, `PLAN_CARDS` | One shared line under the comparison: equities and indices are DEMO on every plan until a licensed feed. |
| 8 | Low — onboarding copy | "Crypto is live data — CoinGecko, updated every few minutes": true for the primary feed; the Binance fallback and STALE cache are not mentioned. | `services/onboardingState.js:75` | "…when CoinGecko answers; a STALE badge shows when it does not." |
| 9 | Low — upgrade flow | Upgrade opens "PAYMENTS ARE NOT LIVE YET" + waitlist (honest). The sign-in screen's "7-DAY FREE TRIAL · Full Apex access" is accurate; no checkout exists. Clean flow needs Stripe (Ben: account, keys). | `PlanModals.jsx` | Leave until payments; keep the waitlist copy. |

## Already in place (verified this session or earlier, with tests)

- Once-only tour with replay, resume of part-finished setup, acknowledgement first (`tests/ui` onboarding section, `tests/onboarding.test.mjs`).
- Terms and Privacy accepted at sign-up with version and time; asked once of older accounts (`tests/legal.test.mjs`).
- Export my data and Delete account for every user (`services/accountData.js`, `api/account-delete.js`; deleting the login needs `SUPABASE_SERVICE_KEY` in Vercel — open item for Ben).

## Needs Ben

- `RESEND_API_KEY` (item 3), migration 009 (item 4), `SUPABASE_SERVICE_KEY` (delete login), Stripe account (item 9).
