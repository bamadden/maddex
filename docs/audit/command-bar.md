# Audit: command bar and global search

Phase 5, 5 Nov 2026. Files: `src/components/layout/CommandBar.jsx` (1,787
lines, the bar and its dropdown), `src/components/layout/commandSearch.js`
(pure search helpers), global keys in `src/App.jsx`, defaults in
`src/services/shortcutService.js`.

Method: read the code, then ran 60 typical queries through the search
helpers (results below). Ranked by impact: what breaks or misleads first,
then what fails to find, then polish.

## Status

| Item | Status |
|---|---|
| 1–3, 2a Keys and focus | Done 5 Nov |
| 4–7, 4a, 10 Search | Done 5 Nov: every module findable (tested against App's list), one-typo module names, a SETTINGS group (Settings, Export my data, Delete account, Display, Shortcuts, Plan & billing, Data sources…), topics (rba, cpi, gold, earnings…) list their module without navigating, index aliases (xjo, asx200, spx, sp500, vix, nikkei, dow), "settings"/"maddenai" open their panels; 70-query regression set in `tests/commandBar.test.mjs`. Not done: "oil", "iron ore", "lithium" (no module holds them; they go to MaddenAI) |
| 8 Wording | Next |
| 9 Accessibility | Next |
| 11 ETF catalogue | Later |

## Findings

| # | Impact | Finding | Evidence |
|---|---|---|---|
| 1 | High: breaks the browser | The bar binds F1–F8 to modules (listed in help and on the nav) on every keydown, with no `preventDefault`, with modifiers held and while typing in any field. F5 reloads the page as it switches to Macro; F1 also opens the browser's help; F3 and F7 also trigger Find-next and caret browsing. | `CommandBar.jsx` global keydown effect |
| 2 | High: steals focus | The bar's Escape handler focuses the bar on every Escape, while App.jsx's Escape closes what is open and blurs the bar. When Escape closes a dialog, App returns early and the bar keeps the focus it grabbed. | same effect; `App.jsx` |
| 2a | High: swallows typing | A first-visit tip (Markets and others) moves focus to its own button when it appears, including mid-word in the command bar after F1 or a command: the rest of the typing is lost. Found by the browser suite. | `ContextualTip.jsx` |
| 3 | Medium: overrides the browser | Ctrl/⌘+F opens the bar instead of the browser's Find, which people use to search a page (an accessibility need). Ctrl/⌘+K is handled twice. | `App.jsx` keydown |
| 4 | High: search misses whole areas | Four modules are absent from the module list and its aliases: Dashboard, Brief, Scanner, Replay (Screener has no aliases). Module names get no typo tolerance: "portfolo", "watchlst", "calender" find nothing. | probe below |
| 5 | High: search misses settings and actions | "settings", "export my data", "shortcuts", "dark mode", "help" as words: nothing (only "help"/"?" opens the help card). | probe |
| 6 | Medium: topics | "rba", "cpi", "cash rate", "gold" find nothing, though Macro and Rates hold them. "oil", "iron ore", "lithium" have no module to go to. These fall through to "Ask MaddenAI". | probe |
| 7 | Medium: index aliases | "xjo", "asx200", "sp500", "spx", "vix" miss; "asx 200", "s&p" and "nasdaq" work. | probe |
| 8 | Medium: wording | Idle suggestions say "Check scanner for signals" (signal language) and "US session live" (a claim of live, and wrong across US daylight-saving changes). | `commandSearch.js` timeSuggestions |
| 9 | Medium: accessibility | Options carry `role="option"`, but the input is not a combobox: no `role="combobox"`, `aria-expanded`, `aria-controls` or `aria-activedescendant`, and the list has no `role="listbox"`, so a screen reader is not told a list opened or which row is selected. | `CommandBar.jsx` |
| 10 | Low: no regression set | No unit test runs search queries; the browser suite covers a handful. The brief asks for 50 test queries. | `tests/` |
| 4a | High: dead ends | "settings" and "maddenai" typed as commands navigate to module ids that do not exist, which render Markets. | `SPOKEN_MODULES` in `CommandBar.jsx`; `App.jsx` MODULE_MAP |
| 11 | Low: catalogue | ETFs ("vas", "ivv") and delisted names ("afterpay") find nothing. ETFs have their own module, so the catalogue could fold its list in as it does the sector taxonomy. | probe |

What works: exact and prefix tickers, company names and aliases (commbank,
woolies), typo tolerance for long names ("comonwealth bank"), sectors
("banks", "miners"), bonds ("10y", "au 10y"), calculators ("mortgage",
"cgt"), Tab between groups, ↑/↓ through history, Enter on a sector moves into
the list.

## Build order

1. Keys (1–3): keep F1–F8 but stop the browser default, ignore them with a
   modifier held or while typing in another field; Escape belongs to
   App.jsx alone; leave Ctrl/⌘+F to the browser; one Ctrl/⌘+K handler.
2. Search (4–7, 10): module list and aliases complete and in
   `commandSearch.js` (pure, testable), typo-tolerant module names, a
   settings/actions category (open Settings at a section, shortcuts, help),
   topic words routed to the module that holds them, index aliases, and a
   test of at least 50 queries.
3. Wording (8).
4. Accessibility (9): combobox and listbox semantics.
5. Later: ETF catalogue (11).

## Probe (before)

```
bhp ✓  commbank ✓  comonwealth bank ✓  westpac ✓  telstra ✓  woolies ✓
xero ✓  cochlear ✓  pro medicus ✓  apple ✓  nvidia ✓  bitcoin ✓  eth ✓
aud/usd ✓  aussie dollar ✓  asx 200 ✓  s&p ✓  nasdaq ✓  10y ✓  au 10y ✓
mortgage ✓  cgt ✓  banks ✓ (sector)  qantas ✓  fortescue ✓  woodside ✓
✗ afterpay  zip  gold  iron ore  oil  asx200  xjo  sp500  vix  rba  cpi
  cash rate  portfolo  watchlst  calender  settings  export my data
  dark mode  shortcuts  lithium  vas  ivv
```
