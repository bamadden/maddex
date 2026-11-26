# Benchmark: Maddex and the institutional terminals

Written 16 Nov 2026 for Workstream 2, from public pages only (vendor product
and help pages, press releases). Each claim links to where it was read. Some
claims could not be confirmed from a public page; those are marked "not
confirmed" and are not relied on.

Product names appear here only to describe and compare. They are not used in
Maddex product copy (docs/TRADEMARKS.md).

## What the others do well

| Area | What is publicly documented | Source |
|---|---|---|
| Keyboard-first navigation | **Bloomberg Terminal:** a command line of mnemonic functions plus `<GO>` (e.g. `MAIN <GO>`), with contextual HELP. | https://guides.library.duke.edu/bloomberg/help (a university guide; Bloomberg's own page returned 403) |
| | **LSEG Workspace:** a search bar and a Launcher (Ctrl+Shift+Space), with natural-language search such as an entity plus an app name. | https://www.lseg.com/content/dam/lseg/learning-centre/documents/workspace-quick-start-guide.pdf |
| | **Koyfin:** a "/" command bar, taking a ticker then a function code (`AAPL` then `G`). | https://koyfin.com/help/command-bar-search |
| Saved layouts and dashboards | **Bloomberg:** Launchpad (`BLP <GO>`) "for personalizing your views". | Duke guide above |
| | **LSEG:** "Save Layout As", with optional autosave. | LSEG quick-start guide above |
| | **Koyfin:** custom dashboards and user-set hotkeys. | https://koyfin.com/help/hotkeys-and-custom-shortcuts |
| | **TradingView:** saved chart layouts, limited by plan (1 on Basic, 10 on Plus). | https://www.tradingview.com/pricing/ (16 Nov 2026) |
| Data provenance | **TradingView:** a "D" beside a symbol marks it as not real-time. | https://in.tradingview.com/support/solutions/43000698958-alerts-based-on-real-time-and-non-real-time-symbols |
| | **Koyfin:** names its sources (CapitalIQ, Morningstar, FRED) and which markets are end-of-day. | https://www.koyfin.com/help/data-overview/ |
| AI with sources | **LSEG Workspace AI Search:** "transparent citations that allow users to trace every data point back to its source". | https://www.lseg.com/en/data-analytics/products/workspace/updates/act-with-the-same-confidence-at-a-new-speed-introducing-lseg-workspace-ai-search |
| | **FactSet:** "clear source linking for auditability". | https://go.factset.com/news/factset-announces-artificial-intelligence-blueprint-and-factset-explorer-its-product-preview-program |
| | **Bloomberg:** AI news summaries (Jan 2025) and an ASKB beta (Feb 2026). | Bloomberg press pages, seen only in search snippets: not confirmed |
| Australian data access (retail) | **TradingView:** ASX prices free at 20 minutes' delay; real-time A$28.00 a month. | https://www.tradingview.com/data-coverage/ (16 Nov 2026) |
| | **CommSec:** "live Aussie company data and quotes" for customers. | https://commsec.com.au/why-join-commsec/making-the-switch-to-commsec.html |

Prices: Bloomberg, LSEG and FactSet publish none ("contact sales"). Koyfin
lists plans from free to $299 a month, currency not stated. TradingView lists
A$0 to A$319.92 a month, billed annually. Both were read 16 Nov 2026 on the
pages above. Any figure quoted for Bloomberg comes from a third party, not
Bloomberg, and is not used here.

## Not confirmed from a public page

- Bloomberg's data-provenance labels and Australian coverage.
- FactSet's navigation and layouts (its product page returned 404).
- Whether Koyfin, TradingView or CommSec show a source and timestamp on each
  figure.
- Any of them covering RBA or ABS releases, or franking, as Maddex does.

## What Maddex does differently, for Australian investors

- **Every figure has a class, source and date, enforced.** The data registry
  (docs/DATA_PLATFORM.md) fails the build when a figure has no source, is past
  its maximum age, or comes from a source not licensed for display. Each module
  header shows its data health. The documented competitors label delay or name
  their sources; a per-figure check of this kind was not found in any of them.
- **Australian first.** The RBA cash rate with its decision record, ABS CPI
  (monthly and quarterly, trimmed mean), the RBA's F6 housing rates behind the
  mortgage maths, franking credits, the CGT discount and the A$ beside US$ are
  built in. They are not add-ons.
- **Descriptive only.** MaddenAI and every panel describe what was published
  and what is scheduled. There are no forecasts, ratings or "what to watch".
  The Relationships ripple is labelled "connected exposure, not forecast".
- **Honest gaps.** Where no licensed feed exists (iron ore, most commodities,
  live ASX prices), the screen says "not shown" rather than show a number.
  Simulated prices are badged DEMO.
- **Retail price point.** The institutional terminals are "contact sales"
  products. Maddex is a subscription for one person (services/plans.js).

## Where Maddex is behind

Updated 26 Nov 2026 (WS2 re-audit, `docs/audit/ws2-2026-11-26.md`).

- **Keyboard depth.** The command bar has modules, settings, assets,
  calculators, commands and a glossary. It has no function codes per
  security (as `AAPL` then `G` in Koyfin); that is a later step.
- **Saved layouts: mostly closed.**
  - `save view NAME`, `view NAME`, `views` and `delete view NAME` all work
    from the command bar.
  - A view keeps the layout (split or single pane) and the state of the
    Dashboard, Scanner, Screener, Markets, Macro, News, Watchlist, Bonds,
    Futures, Calculators, ETFs and company pages.
  - `rename view OLD to NEW` renames one, and a save that would drop the
    oldest of ten warns first.
- **Search breadth: mostly closed.** Search reaches the glossary, saved
  views, economic-calendar events and Relationships nodes. Earnings and
  dividend dates are not searchable yet, and choosing an event opens
  Calendar but not at that event.
- **Live Australian prices.** None until a licensed provider is connected
  (a data licence, in the launch checklist Workstream 8 writes).

## Priorities for Workstream 2, from this benchmark

1. **The command bar as primary navigation.** Add glossary terms, saved views,
   calendar events and Relationships nodes to search, each with a preview of
   what Enter opens. Keep function codes per security as a later step.
2. **Saved views that keep module state,** reachable from the command bar
   ("save view NAME", "view NAME").
3. **A keyboard-driven Overview.** Number keys jump between panels, there is a
   key to open a panel's module, and a dense mode for more on one screen.
4. **Keep the provenance lead.** Every new surface shows class, source and date
   (the DATA button covers each module), and the glossary defines every label.

Live ASX prices are the largest gap. Closing it needs a data licence, which is
one of the items only Ben can do (the launch checklist, Workstream 8).
