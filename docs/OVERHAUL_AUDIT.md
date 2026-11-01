# Maddex overhaul — Phase 0 audit (1 Nov 2026)

No code was changed for this audit. It is ranked by impact: **P0** misleads the reader or
breaks trust; **P1** makes the product feel unfinished to a returning investor; **P2** is
visual or interaction inconsistency; **P3** is polish. Each item names the screen, what was
seen, and where the cause is when the cause is known. Phase 1–4 work is marked with its phase.

## How it was measured

- **Browser:** headless Chrome against the dev server, with MaddenAI mocked. The run cost
  nothing, and no request reached anthropic.com.
- **Views:** all 19 sidebar modules at 1440×900 and 390×844 (mobile).
- **Users:**
  - a fresh user (empty browser), followed through the welcome screen and the setup wizard,
    then a reload;
  - a returning user (onboarding done, two holdings);
  - each plan: Core, Prime, Apex and trial;
  - a logged-out user, on a production build.
- **Per view, the crawl recorded:**
  - every font size, family and text colour rendered;
  - contrast of each text element against its background (WCAG AA is 4.5:1);
  - text under 10px;
  - controls without an accessible name;
  - clickable rows that a keyboard cannot reach;
  - tap targets under 24px;
  - horizontal overflow;
  - focus styles over 6 Tab presses;
  - DEMO, STALE and LIVE badges;
  - console errors.
- **Codebase counts:** inline styles, hard-coded colours and font-size utilities.

**Limits:**

- **Signed-in production paths were not exercised.** No real account was used. The dev build
  skips the sign-in gate, so the post-signup OnboardingFlow, Supabase profile writes and the
  expired-trial screen were read in code, not run.
- **AI panels show their empty states.** With AI mocked, panels fed by MaddenAI show what a
  reader sees when that content is missing. Those empty states are part of the findings.
- **The crawl worsened rate limiting.** CoinGecko rate-limited the crawl (HTTP 429). Some of
  the crypto fallback seen here was triggered by the crawl's own request volume, but the
  fallback path it exposed (P0-1) is real.

---

## P0: misleading or trust-breaking

**P0-1. Crypto prices in US$ are shown as A$.**
- **What happens:** when CoinGecko fails or rate-limits, `fetchCryptoMarketsUnified('aud')`
  falls back to `fetchBinanceMarkets` (`src/services/dataService.js`). That function returns
  Binance USDT prices with no conversion, and the caller labels them A$.
- **Seen:** in the same ticker tape, BTC appeared as **A$77,772** (really the US$ price) and
  **A$110,498**, and ETH as **A$2,269** and **A$3,224**.
- **Spread:** the same data feeds TopMovers, Crypto, Watchlist and the portfolio's crypto rows.
- **Fix:** convert the fallback through the live AUD/USD rate, or label it US$. Either way,
  badge it as the fallback source.

**P0-2. Portfolio says "LIVE PRICES 2/2" while its own positions table says equity prices are DEMO.**
- The KPI strip counts prices that arrived, not prices that are live.
- The upgrade copy for Portfolio (`FEATURE_COPY.portfolio`, "See live P&L…") makes the same
  claim about demo prices.

**P0-3. One concept carries four different numbers.** Market sentiment appears as:

| Where | What it shows |
|---|---|
| Markets header | "MADDENAI 46/100 · NEUTRAL" and "Fear (34/100)" |
| Dashboard header | "INTELLIGENCE 40/100" (50/100 on another load) |
| Dashboard MARKET SCORE panel | an empty gauge |
| News | "MARKET SENTIMENT · NEUTRAL 70%" |

A reader cannot tell which is the score, what each is computed from, or why they differ.

**P0-4. The "DARK POOL SIGNALS" heading on Markets is false.**
- The panel is today's volume against the 20-day average, for the ASX top 20, on DEMO bars.
- Maddex has no dark-pool data. The heading claims a data class the product does not have.

**P0-5. The clocks disagree on screen.**
- **Seen:** the top bar shows machine-local time with no zone (12:06 on this Brisbane machine),
  while the dashboard shows "13:06:32 AEDT".
- **Spread:** Portfolio's "UPDATED 12:07 pm" and the footer use the same unlabelled local time.
- **Fix:** every timestamp should say its zone, or all should be Sydney time.

**P0-6. Onboarding repeats. This is Phase 1.**
- **Cause 1: completion is stored only in localStorage.**
  - The tour (`maddex_onboarding_complete`), the welcome screen (`maddex_welcomed`) and the
    contextual tips are all stored per browser.
  - A new device, a private window or cleared site data shows everything again.
  - "Delete account" and the global sign-out path in Settings also clear every `maddex_*` key.
- **Cause 2: an unfinished setup restarts from step 1.** Skipping steps 1–3 and reloading
  restarted SETUP at step 1 of 5. Only finishing step 5, or EXIT SETUP, records completion.
- **Cause 3: the post-signup OnboardingFlow ignores whether its profile write succeeded.**
  - It keys off `profile.onboarding_complete`, writes it with `updateProfile`, and then calls
    `onComplete()` whatever the result.
  - If that write fails, the flow returns at every sign-in. Prod profile migrations are not
    all applied (memory: 004/007 missing).
- **Also missing:** there is no "Replay tour" anywhere.

**P0-7. Figures do not carry their class, source and date. This is Phase 2.**
- **Dashboard:** index levels and watchlist prices are marked only by a footer line in 8px
  ("DEMO · simulated index levels"), not per figure. No figure shows its source or time.
- **The badge vocabulary has drifted:** VERIFIED TODAY, VERIFIED 4D AGO, LIVE CHECK, LIVE
  DEMO, "DEMO Live data connects on API setup", ESTIMATE, CALCULATED, LIVE.
- **No STALE badge appeared on any of the 38 views.** `withFallback` can serve the
  last-cached value when a feed fails, and nothing on screen says when that has happened.

---

## P1: what a returning investor notices first

### Dashboard (Phase 2)

**P1-1. Roughly half the dashboard is empty at 1440×900.**

| Panel | Waste |
|---|---|
| Portfolio snapshot | A ~180px gap between the value and the P&L lines |
| Key indices | Stretched to ~900px, with values pinned to the far right edge |
| Watchlist | 6 rows in a panel ~360px tall |
| Lower quarter | Blank |

**P1-2. The dashboard buries what matters.**
- **RBA:** the RBA decision two days out appears only as an unlabelled countdown,
  `02.01.23.27`, with its time (14:30) in 9px grey below. The cash rate, market pricing and
  "which holdings connect" are absent.
- **Regime:** the macro regime is shown twice (header pill and gauge panel), with no inputs.
- **Holdings:** shown only as a total. There is no per-holding move, and nothing on the
  holdings that are moving.
- **Since last visit:** absent. There are no new decisions, releases, price moves past a
  threshold, or alerts triggered.

**P1-3. Fresh users land on Markets.** `useStore` defaults `activeModule` to `'markets'`. A
user's first screen after setup is the denser Markets grid, not the overview.

**P1-4. An empty sentiment gauge renders as broken.** When the shared sentiment item is
missing, MARKET SCORE draws an empty arc with a stray "•" and "–". It needs an empty state.

### Accessibility

**P1-5. The type scale has 24 sizes, and much of the text is too small to read comfortably.**
- **Range:** 24 distinct rendered sizes, from 6.5px to 48px, across the 19 desktop views.
- **Sizes in use:**

  | Size | Text elements |
  |---|---|
  | 10px (the body size) | 25,598 |
  | 9px | 1,831 |
  | 8px | 1,754 |
  | 7px | 230 |
  | 6.5–6.7px | 10 |

- **In the code:** 1,123 inline `fontSize` declarations with 33 distinct values, plus
  `text-[9px]` ×240, `text-[8px]` ×93 and `text-[7px]`. The tokens (`text-2xs` and up) are
  bypassed as often as they are used.

**P1-6. Contrast fails across every view.**
- **Scale:** each view has 150–400 text elements below AA (4.5:1), and 55–210 below 3:1.
- **Worst offenders:**
  - **Down-red `#A83232` on navy: about 2.5:1.** That is every negative change in the
    product.
  - **Muted labels `rgb(74,96,128)`: about 2.5:1.** That covers every column header and
    caption.
  - **Dim gold captions at 8–9px.**

**P1-7. Keyboard users cannot reach the rows that matter.**
- **Clickable rows have no tabindex or role.** They are `div`, `span` and `tr` elements:

  | View | Rows |
  |---|---|
  | Markets | 53 |
  | News | 52 |
  | Futures | 32 |
  | ETF | 21 |
  | Bonds | 18 |
  | Watchlist | 7 |
  | Macro | 6 |

- **No skip link:** after the top-bar buttons, focus falls to `<body>`.
- **What works:** buttons do show a 2px focus outline.

**P1-8. Two inputs have no accessible name:** the numeric input on Rates and the date input
on Replay.

**P1-9. Tap targets are small.**
- **Desktop:** 5–62 targets per view are under 24px. Watchlist is worst, at 62.
- **Mobile (390px):** Watchlist has 60, Markets 31, News 27 and Rates 27.

---

## P2: visual and interaction consistency (Phase 3)

### Visual

**P2-1. The colour tokens are bypassed.**
- **In the code:** 1,920 hex literals (214 distinct) and 759 `rgba()` literals, against a
  `terminal-*` token set that resolves through CSS variables.
- **On screen:** each view renders 15–41 distinct text colours. Gold alone appears in at
  least four shades.

**P2-2. The DEMO badge is noisy and inconsistent.**
- **Noise:** Markets shows "● DEMO Live data connects on API setup" four times on one screen.
- **Inconsistency:** the dashboard uses an 8px footer line, and Portfolio a pill. The badge
  differs in size, wording and position from module to module.

**P2-3. Dates appear in six formats:** "29 SEPT 2026", "2026-10-28", "28 Oct 2026",
"as at 2026-09-29", "Sep 2026" and "Tue, 3 Nov". Sometimes two appear in the same panel
(Rates, Macro).

**P2-4. Brand marks differ.**
- **Sign-in screen:** uses "▲ MADDEX".
- **Terminal:** uses the MX mark, twice (the top-bar wordmark and the sidebar logo, about
  60px apart).

**P2-5. Module headers have no rule.**
- **Subtitles vary in type:** some list sources ("AFR · SMH · ABC · Guardian · NYT"), some
  describe ("Your terminal at a glance"), some list contents ("FX Pairs · Yield Curves ·
  Metals").
- **Unexplained control:** a lone "M" button sits at the right of every header with no label.

**P2-6. States are handled differently in each module.**
- **Loading:** 17 plain "LOADING..." strings, plus "LOADING CHART…", "LOADING MODULE…" and
  others.
- **Shared components are rarely used:**

  | Component | Modules using it |
  |---|---|
  | `Skeleton` | 10 |
  | `ModuleStates` | 15 |
  | `EmptyState` | 2 |
  | `DataUnavailable` | 2 |

- **Errors:** error states vary in wording ("DATA UNAVAILABLE", "Failed to…", silent
  fallbacks).

**P2-7. Names are cut short despite free width.** Markets leaders truncate company names
("Westpac Banking …", "Newmont Corporat…") while the sparkline column leaves room.

**P2-8. The Macro cash-rate chart is uneven.** Its x-axis is spaced by decision date
(May 22, Aug 22, Nov 22, Mar 23, Nov 23, Aug 25…), so time is not to scale and the labels
are irregular.

**P2-9. Sentiment colours disagree.** Neutral is shown in gold on Markets, grey on News and
red-bordered on the dashboard "INTELLIGENCE" pill.

### Interaction

**P2-10. The setup wizard leaves the MaddenAI panel open.**
- Step 3 opens the panel and does not close it on the way past.
- Step 4 then sits over the open panel, so the alert card covers the news and sentiment it
  is describing.

**P2-11. Core users meet a dead end on gated modules.** The module shows as a blurred
glimpse behind a modal with no close or back control, so navigating away is the only exit.

**P2-12. Core sees portfolio data it isn't sold.** Portfolio is a Prime feature, yet the
dashboard shows Core users the portfolio value and P&L. Either the snapshot is included in
Core, or the gate is inconsistent; it needs a decision.

**P2-13. Refresh has two controls.** "↻ REFRESH ALL" in the top bar and "Refresh live data"
next to it.

**P2-14. News relevance is poor.**
- **Off-topic headlines:** the feed carries non-market stories ("The unexpected
  neighbourhood pest terrorising this pension…", "'I'm sweating … can I get some tissues on
  stage?'").
- **Wrong attributions:** MOVING ON NEWS attaches the ASX 200 to a headline about one
  AustralianSuper executive.

**P2-15. Junk tokens lead the ticker tape.** Its MOVERS segment leads with obscure tokens
(FIGR_HELOC, HYPE, ZEC) from the CoinGecko top list. That isn't what an ASX investor
expects first.

**P2-16. Every crypto view logs errors.**
- **Cause:** the browser calls CoinGecko directly. On rate limiting this logs CORS and 429
  errors on Markets, Crypto, Global, Watchlist, Calendar and Futures.
- **Related:** the dashboard logs a JSON parse failure whenever a MaddenAI reply is not
  JSON.

---

## P3: dead, placeholder and copy (Phase 3–4)

**P3-1. Placeholders and developer notes are shown to readers.**
- **Placeholders:**
  - "Newsletter archive coming soon." (Brief, previous editions).
  - Portfolio: "SINCE ADDED —" on every row, and "ANNUALISED n/a".
  - Portfolio KPI cells that use space for little: "DISPLAY CCY AUD", "POSITIONS 2".
- **Developer notes:**
  - "Live data connects on API setup" and "demo moves carry a scripted sector tilt"
    (Markets).
  - "No live rate-futures feed. Before a decision, the pricing shown is one dated, sourced
    reading…": accurate, but it is a paragraph where a badge would do.

**P3-2. Newsletter promotions appear inside the terminal.** "THE MADDEX INTELLIGENCE BRIEF ·
SUBSCRIBE" banners sit in News and Brief.

**P3-3. One measure is unlabelled.** Brief shows "AU INFLATION 4.3% · Sep 2026", which is the
monthly CPI indicator. Macro shows "Headline y/y 3.9%" for the quarter. Both are right, but
neither says which measure it is, so they look contradictory.

**P3-4. The copy needs rewriting. This is Phase 4.**

| Kind | Examples |
|---|---|
| Casual | "Your terminal at a glance", "GOOD AFTERNOON", "Do you hold any shares?", "Your analyst, built into every screen", "Five quick steps … About two minutes" |
| Corporate | "Financial intelligence for Australian investors", "FINANCIAL INTELLIGENCE", "INTELLIGENCE 40/100", "Global intelligence" |
| Developer | "Live data connects on API setup", "scripted sector tilt", "computed from daily closes" (fine as a tooltip, not as a header) |
| Vague | "Ask about ASX, RBA, AUD, markets…", "3 this week →", "Updated just now" (with no time) |

### Mobile (390px)

**P3-5. Mobile has clipping, but no page overflow.** No view scrolls horizontally. Within
views:
- **Markets:** the index strip cuts the fourth card mid-figure.
- **Every header:** the controls clip at the right edge.
- **Command bar:** the placeholder truncates ("Question — t").
- **Top bar:** "REFRESH ALL" is cut off.

**P3-6. On mobile the bottom bar shows 6 of 19 modules.** The rest are reached through the
command bar. That works, but nothing on screen says so.

---

## What already works and should be kept

- **Rates** is the strongest screen. It is dense and sourced: the RBA hero, market pricing
  with source and date, the decision preview, and the holdings link.
- The **logged-out sign-in** screen is clean, and identical on desktop and mobile.
- **No view overflows horizontally** at 390px.
- **Buttons show a visible focus ring.**
- The **welcome screen** copy on data honesty ("Equity prices run on demo data until a
  provider is connected — and every one of them says so") is the right voice. It should be
  the model for Phase 4.

## Proposed order of work

1. **Fix P0-1 to P0-5 before any redesign.** They are correctness, not polish. P0-1 (US$
   shown as A$) should go out on its own.
2. **Phase 1** fixes P0-6.
3. **Phase 2** covers P0-7 and P1-1 to P1-4.
4. **Phase 3** covers P1-5 to P1-9 and all of P2. It starts with tokens for type (proposed:
   five sizes, 10/11/12/14/20, with a 10px floor for anything a reader needs) and for colour,
   including a down-red that passes AA on navy.
5. **Phase 4** covers P3.

---

## Status — 1 Nov 2026

Each item is shown with its commit, as pushed to `main`. "Held" means the
item touches the RBA decision-day card, the Rates banner or the WHICH
HOLDINGS CONNECT? button, which stay unchanged until after the 3 Nov
decision.

**Measured outcome.** Re-crawl of all 19 modules at 1440px, before → after:

| Measure | Before | After |
|---|---|---|
| Text elements under 11px | 15,947 of 17,228 | 115 of 17,581 (52 are in the held Rates panels; most of the rest are glyph icons and scaled chart labels) |
| Text below AA contrast (4.5:1) | 3,684 | 498 |
| Text below 3:1 | 1,364 | 173 |
| Clickable rows a keyboard cannot reach | 195 | 0 |
| Controls without an accessible name | 2 | 0 |
| Horizontal overflow at 390px | none | none |

### P0: data honesty

| Item | Status |
|---|---|
| P0-1 US$ crypto shown as A$ | **Done** `fcd937a`. The fallback is converted at the dated Frankfurter AUD/USD rate, with the rate, its date and the fetch time shown. Without a rate, prices stay in US$ and are labelled US$. One shared snapshot feeds every view. |
| P0-2 "LIVE PRICES" on demo data | **Done** `5728733` |
| P0-3 four sentiment numbers | **Done** `d2aad79`. One computed score appears in 7 places, checked in the browser. MaddenAI's headline read is shown as words only. Headline tone and crypto Fear & Greed carry their own labels. |
| P0-4 "dark pool" heading | **Done** `29285ea` |
| P0-5 two clocks | **Done** `c3b04d4`. Rates' own "updated" stamp is **held**. |
| P0-6 onboarding repeats | **Done** `45bfd09` (item 9) |
| P0-7 class, source and date; STALE | **Done** `e254613`. One vocabulary (LIVE / DELAYED / DEMO / STALE), a data key, and STALE wired to both cached-data fallbacks. Coverage is per panel on the dashboard, Overview, Crypto, the tape and Markets; panels elsewhere still use their own provenance lines. The VERIFIED badges on official statistics are kept as a separate check. |

### P1

| Item | Status |
|---|---|
| P1-1 to P1-4 dashboard | **Done** `672b6fc`. The Overview is now the default view, and new users land on it. |
| P1-5 type scale | **Done** `a38f7c2`, `b1e3236`. One scale (11/12/13/14/16/20/28, plus 36/48 for display) with an 11px floor. |
| P1-6 contrast | **Done** `a38f7c2`. AA tokens for change colours and labels. The remaining 498 elements are mostly low-alpha decorative text and the held Rates panels. |
| P1-7 keyboard | **Done** `a38f7c2`. Skip link, all clickable rows reachable, detail modal is a labelled dialog. |
| P1-8 unlabelled inputs | **Done** `6b6b504` |
| P1-9 tap targets | **Done** `a38f7c2`. Every control gets a 44px hit area on touch screens. The area grows invisibly, so the crawl's "small element" count is unchanged by design. |

### P2

| Item | Status |
|---|---|
| P2-1 hard-coded colours | **Mostly done** `a38f7c2`. 1,331 references now use `PAL`; 604 literals remain (215 distinct), mostly one-off chart, map and flag colours. |
| P2-2 noisy DEMO badge | **Done** `e254613`, `b1e3236` |
| P2-3 six date formats | **Partly done.** `formatDate()` ("29 Sep 2026") covers the shared helpers, the Overview, badges and regime text (22 uses). 215 `toLocaleDateString` calls remain in modules. |
| P2-4 two logos | **Done** `a38f7c2` |
| P2-5 module header rule; unexplained "M" button | **Done** `8bd7389`. The button reads ASK AI; subtitles list contents. |
| P2-6 state handling | **Partly done.** `InlineLoading` replaces 22 loading strings. Empty and error states are not yet consolidated. |
| P2-7 truncated names in Markets leaders | **Done** `20665e8` |
| P2-8 Macro chart time axis | **Done** `a037626` |
| P2-9 sentiment colours | **Done** `d2aad79` (one score, one colour scale) |
| P2-10 wizard leaves MaddenAI open | **Done** `45bfd09` |
| P2-11 Core gate modal has no close control | **Done** `4d6313a` |
| P2-12 Core sees the portfolio snapshot | **Needs Ben's decision** (include it in Core, or gate it) |
| P2-13 two refresh controls | **Done** `65e671a` |
| P2-14 news relevance | **Done** `636fba1` (whole-word filter; movers badged DEMO). Since `6b31713` the feed carries only licensed-for-display publishers. |
| P2-15 obscure tokens lead the tape | **Done** `ec99b38` |
| P2-16 CoinGecko errors in the console | **Reduced.** One shared snapshot means far fewer calls, and the fallback is labelled. The calls still go direct from the browser. |

### P3

| Item | Status |
|---|---|
| P3-1, P3-2, P3-4 placeholders, newsletter, copy | **Done** `e4350bd` |
| P3-3 CPI measure unlabelled | **Done** `6b6b504` |
| P3-5 mobile clipping | **Done** `b1e3236`, `24781bc` |
| P3-6 mobile bottom bar shows 6 of 19 | **Done** `24781bc` (ALL lists every module) |

### Found during the work

- `useAudRates`' fixed 0.6520 AUD/USD fallback — **Done** `46a995b` (no rate shows "—").
- The shared sentiment prompt's score, and the Brief's AI "MaddenAI score" — **Done** `89583ed` (words only).
- Legal-risk hardening (advice boundary, scores, reports, disclosures, claims, data licences, privacy, AI records, marks) — `e117802` … `daedeb0`; see `docs/LEGAL_READINESS.md`.
