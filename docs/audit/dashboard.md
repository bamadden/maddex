# Audit: Dashboard

Phase 5, 5 Nov 2026. Files: `src/modules/dashboard/OverviewSurface.jsx`
(the default view), `DashboardModule.jsx` (Overview / CUSTOM switch),
`DashboardStatusBar.jsx`, the CUSTOM widget grid in `widgets/`, and
`components/settings/DataHealthPanel.jsx`.

Against the brief's list for the Dashboard: since-last-visit strip, market
state, RBA and macro regime with labelled countdown, holdings and watchlist
movers, upcoming events, Brief summary, data-health status, no dead space,
customisable order.

## Status

| Item | Status |
|---|---|
| 1 Movers | Done 5 Nov: both sorted by the size of the day's move; the watchlist ranks all its equities and says how many more and how many non-equities are not shown |
| 2 Data health | Done 5 Nov: a DATA HEALTH line under the Overview: the feeds its panels show (from the query cache: fresh, stale or not loaded) and the official-statistics check, DETAILS → Settings → Data Sources. Found on the way: Settings' LIVE FEEDS list reads older per-service caches that the unified data paths no longer write, so FX and crypto can show "not loaded" while on screen; licensed-off DeFi TVL is no longer listed. The Settings list should move to the query cache too (open) |
| 3 Brief summary | Next |
| 4 Time zones | Next |
| 5 Panel order | Next |
| 6 "Outlook" wording | For the Brief overhaul |
| 7 Coming-up badge | Next |

## Findings

| # | Impact | Finding | Evidence |
|---|---|---|---|
| 1 | High: not movers | HOLDINGS lists positions in entry order and WATCHLIST the first 14 in list order, so the day's biggest moves can sit below the fold, and a 15th watchlist name is dropped without saying so. | `Holdings`, `Watchlist` |
| 2 | High: no data health | Nothing on the Dashboard says whether the feeds behind it are fresh. Settings → Data Sources has a full health panel (feed ages, official-statistics check); the Dashboard has no summary or route to it. | `DataHealthPanel.jsx` |
| 3 | High: no Brief summary | The Overview has no Brief panel; today's brief is only in the CUSTOM grid's widget or the Brief module. | `OverviewSurface` |
| 4 | Medium: zones | COMING UP shows event times without a zone ("2:30pm"); the RBA line carries "AEDT" because the constant does. | `ComingUp` uses `sydneyClock(t).time` |
| 5 | Medium: fixed order | The six Overview panels are in a fixed order; only the CUSTOM grid can be arranged. | `OverviewSurface` |
| 6 | Medium: wording | The Brief widget heads MaddenAI's tone word "MADDENAI OUTLOOK": "outlook" reads as a forecast. | `MorningBriefWidget.jsx` |
| 7 | Low: badge | COMING UP badges a non-fallback calendar as LIVE. The live calendar is FMP, which is switched off, so the built-in schedule always shows, badged STALE "live calendar unavailable", though it is a maintained, dated schedule. | `ComingUp` |

What works: every panel names its data class, source and time; the RBA panel
has a labelled countdown ("TIME TO DECISION 33 days 4 hr …") and the macro
regime with its inputs and release dates; since-last-visit lists dated
changes, alerts and moves; empty states say what to do.

## Build order

1. Movers: holdings and watchlist sorted by the size of the day's move, with
   the count shown when the watchlist is cut.
2. Data health: a one-line status in the Overview (fresh / stale feeds, the
   official-statistics check) linking to Settings → Data Sources.
3. Brief summary: today's brief headline and time, or when the next one is
   due, linking to Brief.
4. Zones on every Coming-up time.
5. Panel order: move panels up and down, kept per device, with a reset.
6. ("Outlook") with the Brief overhaul.
7. Coming-up badge: the built-in schedule is a dated schedule, not stale.
