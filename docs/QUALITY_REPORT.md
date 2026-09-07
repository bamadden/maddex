# Maddex Terminal — Quality Report

**Date:** 7 September 2026 · **Build:** `744fb9e` + this commit
**Build:** 2.5s · 97 chunks · 7.1 MB dist · 1.84 MB JS gzip · **268 KB first paint**
**Lint:** 32 problems (20 errors, 12 warnings) — unchanged through the whole pass

---

## Module ratings

Rated on what a professional sees in the first ten seconds. Anything below 9
was fixed during this pass rather than reported; the "before" column is what it
scored when the pass started.

| Module | Visual | Depth | Professional | Score | Before |
|---|---|---|---|---|---|
| Rates & FX | 10 | 10 | 10 | **10.0** | 8.7 |
| Macro | 10 | 10 | 10 | **10.0** | 8.3 |
| Crypto | 10 | 10 | 9 | **9.7** | 9.7 |
| Markets | 9 | 10 | 10 | **9.7** | 9.3 |
| Watchlist | 10 | 9 | 10 | **9.7** | 8.7 |
| News | 9 | 10 | 10 | **9.7** | 9.7 |
| Dashboard | 10 | 9 | 10 | **9.7** | 7.7 |
| Portfolio | 9 | 10 | 10 | **9.7** | 9.3 |
| Morning Brief | 10 | 9 | 10 | **9.7** | 9.7 |
| Global (Intel Map) | 10 | 9 | 9 | **9.3** | 9.0 |
| Screener | 9 | 9 | 10 | **9.3** | 9.3 |
| Calendar | 9 | 9 | 10 | **9.3** | 9.3 |
| Settings | 9 | 10 | 9 | **9.3** | 9.3 |
| MaddenAI | 10 | 9 | 9 | **9.3** | 8.0 |
| Scanner | 9 | 9 | 10 | **9.3** | 8.0 |
| Replay | 9 | 9 | 9 | **9.0** | 9.0 |

**What moved most, and why**

- **Dashboard 7.7 → 9.7.** It had a dead band above the command bar, widgets
  whose rows floated in the vertical middle of their cells, and hero content
  detached from the summary describing it. All three were one root cause:
  `alignContent: start` on the grid, and the layout underneath it had never
  been tested at a stretched height.
- **Macro 8.3 → 10.0.** Its hero chart had a clipped y-axis — every tick read
  as a bare `%` with the number cut off, and the first x-label read "ay 22".
  A negative `left` margin, copy-pasted across eight charts in four modules.
- **Rates 8.7 → 10.0.** The RBA rendered identically to the Riksbank in a grid
  of ten. In an Australian terminal, that is the one figure that prices the
  reader's mortgage.
- **Scanner 8.0 → 9.3.** Every row was labelled "Signal", in a module called
  MARKET SCANNER, and its one action was invisible until hover.
- **MaddenAI 8.0 → 9.3.** It could not state the RBA cash rate the terminal was
  displaying beside it, because nothing ever passed it the verified constants.

---

## Data sources

**Live**
CoinGecko (crypto prices, market cap, dominance) · alternative.me (Fear & Greed)
· DefiLlama (TVL, stablecoins) · mempool.space (on-chain) · Frankfurter and
exchangerate-api (FX) · RBA (cash rate series) · USGS (seismic) · World Bank and
IMF (country data) · Open-Meteo (weather) · RSS from ABC, SMH, Guardian, CNBC,
MarketWatch, BBC, Nikkei, Economist and others (18 sources)

**Human-verified constants** — `src/data/verifiedConstants.js`
Policy rates for 10 central banks, AU CPI / unemployment / GDP / trade / retail
/ housing, ASX 200 P/E and yield. Every figure carries a publication date and a
last-verified date; anything over 7 days old renders a staleness badge. These
are now also passed to MaddenAI per turn, dated, as the single exception to its
"never state a figure you were not given" rule.

**Demonstration data — labelled DEMO everywhere it appears**
Equity and index prices, and everything derived from them: Markets, Watchlist,
Portfolio, Screener, Scanner, sector heatmap. Needs a provider key
(`VITE_POLYGON_KEY` unset).

---

## Known issues

1. **Payments are not wired.** Three `alert()` placeholders stand where Stripe
   should be. Hard launch blocker.
2. **Equity prices are demonstration data.** The flagship module of an ASX
   terminal is not live. Hard launch blocker.
3. **Legal pages are not lawyer-reviewed, and carry no ABN/ACN** — none is
   recorded anywhere in the codebase, and inventing one is worse than omitting
   it.
4. **Three auth paths untested** — account creation, plan display, and
   sign-out/sign-in need a real account and password.
5. **`maddex.com.au` serves nothing.** The domain must point at the deployment.
6. **20 lint errors.** 11 `set-state-in-effect`, 7 `only-export-components`,
   1 `no-useless-escape`, 1 `purity`. None is a known bug; the
   `set-state-in-effect` group are cascading-render risks concentrated in
   `SectorHeatmap.jsx`.
7. **Email alert delivery** is advertised as "coming soon"; alerts are in-app
   only.

---

## What this pass did not do

**Did not rewrite 409 `.toFixed()` call sites.** Almost all produce exactly the
string `fmt` would produce. Rewriting 409 working call sites to change nothing a
user sees is how you introduce a formatting bug in the one that was not like the
others. The formatting problem in this codebase was relative time — ten
implementations that disagreed — and that is fixed.

**Did not force `ease-out` onto looping animations.** A symmetric curve is what
stops a pulse stuttering at the seam where it restarts. All seven `ease-in-out`
uses are infinite loops.

**Did not normalise crypto brand colours.** `#F7931A` is Bitcoin, not a UI
state.

**Did not replace the sector heatmap's emoji.** They are a complete, internally
consistent set doing content work, not chrome.
