# Audit: Watchlist

Phase D, 16 Nov 2026. Files: `src/modules/watchlist/*`. Surveyed with a
read-only agent; each finding checked in the code before building.

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: legal | A user-set reference level read "upside / downside target, x% from here" | `WatchlistRowParts.jsx:104` | Done 16 Nov: "x% above / below the last price" |
| 2 | Medium: times | "Since added" date in browser-local format | `WatchlistModule.jsx:1668` | Done: formatDate |
| 3 | Medium: honesty | A missing % counted as up in the hover card | `WatchlistExtras.jsx:20` | Done: null is neither |
| 4 | Low: honesty | Missing prices added as 0 to "1 unit each" | `WatchlistModule.jsx:733` | Done: left out and counted |
| 5 | Low: times | CSV filename used the UTC date | `WatchlistModule.jsx:831` | Done: Sydney date |
| 6 | Low: a11y | Icon-only close button with no name | `WatchlistModule.jsx:233` | Done |
| — | — | Account writes only after confirmation (WatchlistSyncBar); badges in the header; no text below 11px | — | Already in place |
