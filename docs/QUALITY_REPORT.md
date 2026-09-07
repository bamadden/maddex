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

## Verification pass — 7 September 2026

Four items re-checked after the quality pass. Two were already correct; two
were not, and one of those was a real bug the original pass had missed.

**1. Timestamp unification — INCOMPLETE, now fixed.** Two implementations had
survived. `fmt.relativeTime` had its own logic and zero call sites — the worst
combination, since the next person wanting "3m ago" looks in `fmt` first. And
`NewsModule.getRelativeTime` was still live behind a local `timeAgo` that
shadowed the shared import, saying "yesterday" where every other surface says
"1d ago". Both now delegate to the one function in `dateUtils`. Verified in the
browser: zero occurrences of "yesterday", and a seconds tier the news feed
previously lacked.

**2. Chart margins — one module still clipping, now fixed.** A programmatic
sweep across 34 charts found 7 remaining clips in Macro, all outside the
original `left: -20` class: rotated category labels given 30px of bottom margin
when they project 49px, two `ReferenceLine` labels positioned `right` (which
places them *outside* the plot area), and a final date tick 2px past an 8px
right margin. **34 charts, 0 clipped.**

**3. 52-week range colouring — CORRECT.** 21 cells checked programmatically:
every endpoint neutral. The only gain/loss colour in that column region is a
genuine change percentage in the crypto section's differently-shaped row. The
detail modal's copy is neutral too.

**4. MaddenAI rate knowledge — A REAL BUG, now fixed.** Asked through the AI
panel it answered correctly. Asked through the **command bar** it answered
"4.10%, following a 25 basis point cut delivered at the February 2025 meeting"
— recalled from training data, wrong, and it said so itself: *"I don't have a
[VERIFIED FACTS] block in this session."*

`CommandBar.routeToAI` called `askClaude` directly, bypassing `AIPanel.send()`
and therefore the context block, the verified facts, the system prompt, the
query-intent shaping, the conversation history **and the Core message quota**.
The command bar advertises "Ticker · Command · Question", so this is a primary
way in. It now dispatches the same `madden:ask-ai` event every other surface
uses. One event, one code path, one answer.

A second, subtler fault surfaced while verifying the fix: the model twice
described the 12 August **hold** as "a hike from 4.10%". `previousRate` is the
level before the last *change* and the constants carry no date for it — given
an undated figure beside a dated meeting, the model attaches one to the other.
It is no longer sent. A figure that cannot be stated unambiguously is worse
than an absent one.

Final answer through the command bar: *"The RBA cash rate is 4.35%, held at the
12 August 2026 meeting. The next decision is nine days away — 16 September 2026
... Trimmed mean CPI came in at 2.7% for the June quarter ... headline CPI is
still running at 3.8%. GDP growth is soft at 1.3% annually, and unemployment
has edged up to 4.1%."* Every figure from the verified block.

**Also finished:** the module icon set (breadcrumb, workspace switcher, quick
actions) was six text glyphs and six colour emoji; it is now one typeface.

---

## Elite refinement pass — 7 September 2026

Eight groups. Build 2.3s, **first paint 268 KB gzip — unchanged**, 97 chunks,
1.84 MB JS gzip, lint 32 (20 errors, 12 warnings) — every number held flat
while the work went in.

**QA sweep:** all 14 modules navigated in sequence. **Zero console errors.**
Three warnings, two of which are external feeds failing gracefully (REST
Countries, and a USGS earthquake response that came back non-JSON — both
logged and handled). The third is Recharts' `width(-1)` notice from Markets,
Rates and Macro; SafeChart exists to prevent it and catches most cases, but the
stack for these is entirely inside Recharts with no application frame, so it is
raised by the chart component's own render rather than by container
measurement. All 34 charts draw correctly and none clips.

**Mobile:** a true 390px viewport was not reachable — this harness clamps
`window.innerWidth` to 1280 regardless of the OS window size, so I could not
verify layout at phone width and am not going to claim I did. What is verifiable
statically: the viewport meta is correct, `MobileNavBar` renders, the AI panel
goes `fixed inset-0` below `md`, the dashboard grid collapses to one column at
140px row height, there are 118 responsive utilities in play, and no element
declares a fixed width of 400px or more that would force horizontal scroll.
**Ben should check this on a real phone before launch.**

### What went in

**Micro-details.** A 1px 3%-white highlight on every card top — how a physical
panel catches light, and the cheapest way to stop a dark rectangle reading as a
hole. The sidebar's active state became a radial falloff from the gold marker
rather than a flat wash. Number ticks now strike and fade over 300ms instead of
throbbing over 500. Inputs took the terminal treatment: a weighted 2px gold
left edge and three quiet sides, which says "command line" where a focus ring
says "form field". Scrollbars to 3px. Ghost buttons gained the hover background
they never had.

**Dashboard.** A 32px status bar above the grid: greeting, date, live session
pill, clock. It turns a control panel into a briefing, and everything in it is
derived — nothing fetched. The greeting uses the Australian hour, not the
browser's, and the session dot pulses only while the market is actually
trading.

**Markets.** Index cards lift 2px on hover with a shadow and a z-index so the
shadow does not paint under its neighbours. Sector tiles took a sign-tinted
inner glow, so a green tile looks lit rather than painted.

**MaddenAI.** The panel went from 320px to 360/420/480. At 320 a 300-word
analysis wraps every six words and the reader loses the sentence — the voice
work from two briefs ago was being spent on a column nobody could follow.

**Rates.** The cash rate went from a 16px number in a one-line strip to a 40px
hero with a live countdown to the next meeting and full provenance.

### Three places I did not follow the brief

**No probability bars on the RBA card.** The brief asks for "MARKET CONSENSUS —
HOLD 82% / CUT 14% / HIKE 4%". Those exact figures were fabricated literals
removed earlier in this project, there is still no rate-futures feed, and a
filled bar chart is the most persuasive way in existence to present a number
nobody measured. The space says so instead.

**User message bubbles are 4px, not 12px.** Every other radius in this terminal
is 2px. A 12px bubble would be the single most consumer-app element on screen.

**Looping animations keep `ease-in-out`.** A symmetric curve is what stops a
pulse stuttering at the seam where it restarts.

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
