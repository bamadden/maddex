# Data platform

Started 16 Nov 2026 (Workstream 1). This is how a figure gets into Maddex, how
it is kept current, and how a reader can tell how current it is.

## The problem it removes

Most wrong or stale figures in Maddex came from the same root cause: a number
typed into a component or a data file, with no source, no date, and nothing
that noticed when it went out of date. Some examples: a 4.35% cash rate two
days after the RBA moved, Westpac and NAB survey readings copied wrongly, and
bond curves four months old.

## The one rule

Every figure about the world that Maddex shows, or sends to MaddenAI, belongs
to **one dataset in the registry** (`src/data/registry.js`). Anything that is
not in a dataset is removed.

Each dataset declares:

| Field | Meaning |
|---|---|
| `id`, `what` | A stable name, and what the figures are |
| `cls` | One of `official` (an agency or central bank), `market` (exchange, issuer or vendor), `derived` (computed by Maddex, or a Maddex method), `editorial` (a Maddex judgement or curated record) or `demo` (simulated, badged DEMO) |
| `source` | Who publishes it and where, as a name and URL. A null URL means each figure names its own page |
| `licence` | The terms under which Maddex shows it. Sources switched off for licence reasons (`src/data/sourceLicence.js`) cannot appear |
| `fetch` | How it arrives (`manual`, `fetcher`, `derived` or `demo`), and the command that checks it against the source, if there is one |
| `cadence` | How often the source publishes |
| `maxAgeDays` | How old the as-of date may be. It is set by the kind of figure: rate 45, price 30, statistic 60, schedule 30, editorial 45, history 45, reference and method 365 |
| `fallback` | What a reader sees when the figure cannot be shown fresh |
| `modules` | Which modules show it, for the DATA button in each module header |
| `asOf` | Where its as-of date lives: a constant in its own file, a dated table, or a `verifiedConstants` group's `lastVerified` |

The registry holds no figures and no dates. It only points at them, so it
cannot drift from the data.

## What enforces it

`tests/registry.test.mjs` runs in the gate. It replaces the freshness guard
(`src/data/freshness.js`, 15 Nov), which this folds in. The test fails when:

- a dataset is missing any of the fields above, or has an unknown class;
- a dataset names a source that is switched off for licence reasons;
- a verify command it names is not a package script;
- a `verifiedConstants` group is in no dataset;
- an as-of date is missing, malformed, or older than the dataset's maximum
  age, unless a dated flag covers it (`FLAGS`, none at present). A flag
  expires on its own date, and a flag for a problem that no longer exists
  also fails;
- a file in `src` holds typed tables and belongs to no dataset and is not
  exempt with a reason (`EXEMPT`);
- the table below differs from the registry.

Past its maximum age, a figure fails the build, so it cannot be deployed until
someone re-reads it from its source.

## Checks against the source

| Command | What it checks |
|---|---|
| `npm run data:fetch [source…]` | Fetches each source and writes a dated record to `data/records/<source>/<Sydney date>.json` (git-ignored). Each record holds the figures and the shape of every response, for the format check |
| `npm run data:verify [source…]` | Compares the constants with the newest record, fetching today's first. Prints match, drift, or a different period, and exits 1 on any drift |
| `npm run data:format-check` | The nightly format check, below |
| `npm run check-stats` | The RBA cash rate (table A2), ABS CPI, trimmed mean, unemployment and GDP, and US CPI, unemployment, GDP and the Fed target. It also checks the chart histories point by point, and the dated changes that have taken effect. Runs in the gate |
| `npm run check-rba` | The RBA decision record against the RBA's media releases |
| `npm run graph:verify` | Each relationship link against its cited quote |

### Fetchers

One file per source in `scripts/data/sources/`. Each exports `fetchRecord` and
`verify`. All of them are keyless.

| Source | Figures | Endpoint | Terms |
|---|---|---|---|
| `rba` | Cash rate target; 10-year government bond yield | RBA tables A2 and F2 (CSV) | Commercial use permitted with "Source: Reserve Bank of Australia" |
| `abs` | CPI, trimmed mean, unemployment, GDP (quarter and annual) | ABS Data API (SDMX CSV) | CC BY 4.0 |
| `bls` | US CPI and core CPI (12 months, not seasonally adjusted), unemployment rate | BLS public API v1 | Public domain. About 25 keyless queries a day; a run makes one |
| `ecb` | Deposit facility rate | ECB Data Portal (CSV) | Free use, citing the ECB |
| `boc` | Target for the overnight rate | Bank of Canada Valet API (JSON) | bankofcanada.ca/terms |
| `eia` | Brent and WTI spot prices, daily | US EIA history tables (HTML) | US government data, public domain |

Notes:

- A fetcher never changes the app. A person reads the drift and updates the
  constant with its new date. A figure that changes under half the screen at
  once is worse than one a day late, and the update needs a person to read
  the release.
- A figure for a different period than the constant is reported as such, not
  as a match or a drift. For example, ABS October CPI arrives while the
  constant still holds September.
- `check-stats` still reads its US history series through FRED. That is
  internal reconciliation only: FRED's terms bar showing its data to readers,
  so nothing from FRED reaches the app. The `bls` fetcher reads BLS directly.
- Commodity prices other than crude, and index closes, are not held at all
  (16 Nov 2026). There is no licensed keyless feed for them, and the values
  were read from news reports. Each screen says "not shown" instead.
- Not fetched yet, and still read by hand: the Fed target (the Fed publishes
  it in a download tool, not a keyless series), US GDP (BEA's API needs a
  key), and the BoE, BoJ, RBNZ, SNB, Riksbank and PBoC rates. Their pages are
  HTML, or behind bot checks (RBNZ returned 403 on 16 Nov).

## Nightly format check

`.github/workflows/data-format-check.yml` runs `npm run data:format-check`
at 21:00 UTC each night (08:00 Sydney in daylight time). It can also be run by
hand from the repository's Actions tab.

For each source, the check:

1. fetches every endpoint;
2. compares the shape of each response with the accepted shapes in
   `scripts/data/formats.json`: HTTP status, the CSV header and series-ID
   rows, and the JSON keys;
3. runs the verification.

The report goes to the run's summary and is kept as an artifact for 30 days.

The run fails when a source cannot be fetched or its format has changed.
GitHub sends a failed scheduled run to the repository owner, and that is the
alert. A figure that differs from its constant is listed in the report but
does not fail the run, because updating it needs a person to read the
release.

When a format changes:

1. check the parser in `scripts/data/sources/`;
2. run `npm run data:format-check -- --accept` to record the new shapes;
3. commit `formats.json`.

The workflow has read-only permissions, uses no secrets, and never commits,
so it never triggers a deploy.

## Data health in the app

Every module header has a **DATA** button (`src/components/ui/DataHealth.jsx`).
It shows how many of the module's datasets are within their maximum age.
They are counted on the reader's Sydney date, so a figure that passes its
maximum age between deploys shows as past it, even though the build that
contains it was current. The button turns amber, with a count, when a dataset
is past its maximum age or has no as-of date.

Opening it lists each dataset with:

- what it is and its class;
- its source, linked;
- its as-of date, and its age against its maximum;
- the fallback, for any dataset that needs attention.

The header loads only `src/data/registryHealth.js`, generated by `npm run
data:docs` and held to the registry by the tests: each dataset's modules,
date, maximum age and class. The full registry loads only when the panel
opens.

## Manually checked data

Some figures are read by a person from the issuer's own page, and no fetcher
checks them nightly. That covers:

- most central-bank rates outside the RBA, ECB and Bank of Canada;
- US GDP;
- the country statistics and policy rates on the Global panel;
- schedules;
- ETF and futures facts;
- company facts.

The rules for this data (Ben's decision, 16 Nov 2026):

- Each figure is kept only if it was verified from the issuer's own page by
  fetch. Anything that could not be verified was removed, for example RBNZ,
  index rebalance dates, and the ATO and AUSTRAC lines on Crypto.
- Each has a maximum age of 30 days (`MANUAL_MAX_DAYS`).
- Each shows the badge "manually checked, DATE".
- An exception needs a dated hold (`manualHold`) with its reason, and fails
  the build when the hold expires.

The list below is generated from the registry. The build fails on each
dataset's due date unless it is re-read first.

<!-- manual:start (generated by npm run data:docs; do not edit by hand) -->
| Dataset | Source | Last checked | Max age | Next check due | Note |
|---|---|---|---|---|---|
| `company-facts` Company facts (Relationships, Company) | Company annual reports and ASX filings | 2026-10-31 | 30 days | 2026-11-30 | — |
| `key-facts` Key facts (Relationships, Company) | Company filings, each fact cited | 2026-10-31 | 30 days | 2026-11-30 | — |
| `bond-curve` Sovereign bond curves (AU, US, UK, DE, JP) | RBA, US Treasury, UK DMO, Bundesbank, Japan MoF | 2026-11-11 | 30 days | 2026-12-11 | — |
| `vc:snb` SNB policy rate | Swiss National Bank | 2026-11-15 | 30 days | 2026-12-15 | — |
| `vc:riksbank` Riksbank policy rate | Sveriges Riksbank | 2026-11-15 | 30 days | 2026-12-15 | — |
| `policy-rates` Country policy rates (Global panel) | Each central bank's own announcement (docs/DATA_SOURCES.md) | 2026-11-15 | 30 days | 2026-12-15 | — |
| `country-stats` Country GDP growth and CPI (Global panel) | Each country's statistics agency (docs/DATA_SOURCES.md) | 2026-11-15 | 30 days | 2026-12-15 | — |
| `macro-series` Macro leading-indicator series (surveys, trade, spending) | ABS, Westpac-Melbourne Institute, NAB | 2026-11-15 | 30 days | 2026-12-15 | — |
| `cb-meetings` Central-bank meeting lists | Each central bank's published calendar | 2026-11-15 | 30 days | 2026-12-15 | — |
| `econ-schedule` Economic calendar (Dashboard, Calendar, alerts) | ABS, BLS and agency release calendars | 2026-11-15 | 30 days | 2026-12-15 | — |
| `vc:freight` Freightos Baltic Index | Freightos (FBX) | 2026-11-15 | 30 days | 2026-12-15 | — |
| `etf-data` ETF fees, indices and fund sizes | Each issuer's product page | 2026-11-15 | 30 days | 2026-12-15 | — |
| `futures-specs` Futures contract specifications | Each exchange's contract page | 2026-11-15 | 30 days | 2026-12-15 | — |
| `vc:boe` Bank of England Bank Rate | Bank of England | 2026-11-16 | 30 days | 2026-12-16 | — |
| `vc:boj` Bank of Japan policy rate | Bank of Japan | 2026-11-16 | 30 days | 2026-12-16 | — |
| `vc:pboc` PBoC loan prime rate | People's Bank of China | 2026-11-16 | 30 days | 2026-12-16 | — |
| `vc:centralBankOfficials` Central-bank governors and chairs | Each central bank's own site | 2026-11-16 | 30 days | 2026-12-16 | — |
| `vc:auTrade` Australian exports and imports by partner, 2024-25 | Australian Bureau of Statistics | 2026-11-16 | 30 days | 2026-12-16 | — |
| `rba-board` RBA Monetary Policy Board members | Reserve Bank of Australia | 2026-11-16 | 30 days | 2026-12-16 | — |
| `vc:rbaNextDecision` The RBA decision being prepared for; a market reading only when read from the issuer | RBA; ASX rate tracker for any market reading | 2026-11-16 | 30 days | 2026-12-16 | — |
| `cb-announce-times` Central-bank announcement times | Each central bank's published calendar | 2026-11-16 | 30 days | 2026-12-16 | — |
| `corporate-actions` Dividend, results and AGM dates | ASX company announcements | 2026-11-16 | 30 days | 2026-12-16 | — |
| `crypto-au-facts` Crypto in Australia: ownership survey and the Digital Assets Framework | Independent Reserve; legislation.gov.au; ASIC (named per fact) | 2026-11-16 | 30 days | 2026-12-16 | — |
| `us-circuit-breakers` US market-wide circuit-breaker thresholds | SEC (investor.gov); NYSE Rule 7.12 | 2026-11-16 | 30 days | 2026-12-16 | — |
| `country-db` Country reference (capitals, languages, currencies) | Natural Earth and national sources | 2026-06-30 | 365 days | 2027-06-30 | Held until 2026-11-30: Capitals, languages and currencies for about 40 countries, from no single issuer; not yet re-read. Awaiting Ben. |
| `tax-rates` Tax, super and duty rates; the CGT discount; the company rate for franking | ATO and state revenue offices | 2026-07-01 | 365 days | 2027-07-01 | Held until 2026-11-30: ato.gov.au returns HTTP 403 to fetch, so the rates cannot be re-read by fetch; removing them would remove the tax, super and CGT calculators. Awaiting Ben. |
<!-- manual:end -->

## Datasets

<!-- registry:start (generated by npm run data:docs; do not edit by hand) -->
| Dataset | Class | Source | Fetch | Cadence | Max age | Modules |
|---|---|---|---|---|---|---|
| `vc:rba` RBA cash rate and last decision | official | Reserve Bank of Australia | fetcher, checked by `npm run data:verify -- rba` | per meeting (8 a year) | 45 days | fx, macro, dashboard, brief, calculators |
| `vc:fed` US federal funds target range | official | Federal Reserve | manual, checked by `npm run check-stats` | per meeting (8 a year) | 45 days | fx, macro, dashboard, brief |
| `vc:ecb` ECB deposit facility rate | official | European Central Bank | fetcher, checked by `npm run data:verify -- ecb` | per meeting (8 a year) | 45 days | fx, macro, global |
| `vc:boe` Bank of England Bank Rate | official | Bank of England | manual | per meeting (8 a year) | 30 days | fx, global |
| `vc:boj` Bank of Japan policy rate | official | Bank of Japan | manual | per meeting (8 a year) | 30 days | fx, global |
| `vc:pboc` PBoC loan prime rate | official | People's Bank of China | manual | monthly (20th) | 30 days | fx, global |
| `vc:boc` Bank of Canada policy rate | official | Bank of Canada | fetcher, checked by `npm run data:verify -- boc` | per meeting (8 a year) | 45 days | fx, global |
| `vc:snb` SNB policy rate | official | Swiss National Bank | manual | quarterly | 30 days | fx, global |
| `vc:riksbank` Riksbank policy rate | official | Sveriges Riksbank | manual | per meeting (8 a year) | 30 days | fx, global |
| `vc:centralBankOfficials` Central-bank governors and chairs | official | Each central bank's own site | manual | on change | 30 days | fx, macro |
| `policy-rates` Country policy rates (Global panel) | official | Each central bank's own announcement (docs/DATA_SOURCES.md) | manual | per meeting | 30 days | global |
| `vc:au` Australian CPI, labour force, GDP and other headline statistics | official | Australian Bureau of Statistics | fetcher, checked by `npm run data:verify -- abs` | monthly and quarterly releases | 60 days | macro, dashboard, brief, fx, calculators |
| `vc:us` US CPI, unemployment and GDP | official | BLS and BEA | fetcher, checked by `npm run data:verify -- bls` | monthly and quarterly releases | 60 days | macro, dashboard, brief |
| `vc:auTrade` Australian exports and imports by partner, 2024-25 | official | Australian Bureau of Statistics | manual | annual | 30 days | global |
| `country-stats` Country GDP growth and CPI (Global panel) | official | Each country's statistics agency (docs/DATA_SOURCES.md) | manual | monthly and quarterly releases | 30 days | global, macro |
| `macro-series` Macro leading-indicator series (surveys, trade, spending) | official | ABS, Westpac-Melbourne Institute, NAB | manual | monthly | 30 days | macro |
| `tax-rates` Tax, super and duty rates; the CGT discount; the company rate for franking | official | ATO and state revenue offices | manual | each financial year | 365 days | calculators, portfolio |
| `country-db` Country reference (capitals, languages, currencies) | official | Natural Earth and national sources | manual | on change | 365 days | global |
| `rba-decisions` RBA decision record | official | Reserve Bank of Australia | manual, checked by `npm run check-rba` | per meeting | 45 days | fx, macro, replay |
| `rba-path` RBA cash-rate path since 2008 | official | Reserve Bank of Australia | manual, checked by `npm run check-stats` | per meeting | 45 days | fx, replay |
| `rba-board` RBA Monetary Policy Board members | official | Reserve Bank of Australia | manual | on change | 30 days | fx, macro |
| `vc:rbaNextDecision` The RBA decision being prepared for; a market reading only when read from the issuer | official | RBA; ASX rate tracker for any market reading | manual | per meeting | 30 days | fx, brief |
| `rba-f6` Average variable home-loan rate (RBA F6), the source of the mortgage margin | official | RBA table F6, housing lending rates (FLRHOOVA) | fetcher, checked by `npm run data:verify -- rba` | monthly | 30 days | calculators, fx |
| `cb-meetings` Central-bank meeting lists | official | Each central bank's published calendar | manual | yearly, with changes | 30 days | fx, macro, calendar, brief |
| `cb-announce-times` Central-bank announcement times | official | Each central bank's published calendar | manual | yearly, with changes | 30 days | fx, macro, calendar |
| `econ-schedule` Economic calendar (Dashboard, Calendar, alerts) | official | ABS, BLS and agency release calendars | manual | monthly | 30 days | calendar, dashboard, brief, macro, news, global |
| `corporate-actions` Dividend, results and AGM dates | official | ASX company announcements | manual | reporting seasons | 30 days | calendar, markets, portfolio |
| `vc:commodities` Brent and WTI crude oil spot prices (other commodities not shown: no licensed feed) | official | US Energy Information Administration | fetcher, checked by `npm run data:verify -- eia` | daily (weekly release) | 30 days | global, macro, markets, dashboard, futures |
| `vc:freight` Freightos Baltic Index | market | Freightos (FBX) | manual | weekly | 30 days | global |
| `vc:bonds` Australian and US 10-year yields | official | RBA table F2 (AU); US Treasury par curve (US) | fetcher, checked by `npm run data:verify -- rba` | daily | 30 days | bonds, fx, dashboard |
| `bond-curve` Sovereign bond curves (AU, US, UK, DE, JP) | official | RBA, US Treasury, UK DMO, Bundesbank, Japan MoF | manual | daily | 30 days | bonds, fx, macro, dashboard |
| `etf-data` ETF fees, indices and fund sizes | market | Each issuer's product page | manual | monthly | 30 days | etf, portfolio |
| `futures-specs` Futures contract specifications | market | Each exchange's contract page | manual | on change | 30 days | futures |
| `company-facts` Company facts (Relationships, Company) | official | Company annual reports and ASX filings | manual | each reporting season | 30 days | company, relationships |
| `key-facts` Key facts (Relationships, Company) | official | Company filings, each fact cited | manual | each reporting season | 30 days | company, relationships |
| `crypto-au-facts` Crypto in Australia: ownership survey and the Digital Assets Framework | official | Independent Reserve; legislation.gov.au; ASIC (named per fact) | manual | on change | 30 days | crypto |
| `us-circuit-breakers` US market-wide circuit-breaker thresholds | official | SEC (investor.gov); NYSE Rule 7.12 | manual | on rule change | 30 days | markets |
| `graph` Relationship graph (each link cited; links age on their own at 365 days) | editorial | Company filings, each link with its quote | manual, checked by `npm run graph:verify` | on approval | 365 days | relationships, company, global |
| `geo-risk` Country risk notes (descriptive) | editorial | Maddex, from cited reporting | manual | monthly review | 45 days | global |
| `chokepoint` Shipping route status | editorial | Maddex, from cited reporting (per route) | manual | on change | 45 days | global |
| `intel-map` Global map editorial content: disruptions, route notes and ratings, site notes | editorial | Maddex, from cited reporting | manual | on change | 45 days | global |
| `crypto-momentum` Crypto momentum weights | derived | Maddex method | derived | reviewed yearly | 365 days | crypto, markets |
| `brief-bands` Brief score bands | derived | Maddex method | derived | reviewed yearly | 365 days | brief, dashboard |
| `commodity-weights` Commodity exposure weights | derived | Maddex method, from company revenue mix | derived | reviewed yearly | 365 days | relationships |
| `recession-rubric` Recession-risk rubric | derived | Maddex method | derived | reviewed yearly | 365 days | macro, portfolio |
| `stress-betas` Stress-test sector betas | derived | Maddex method | derived | reviewed yearly | 365 days | portfolio |
| `demo-equities` Simulated equity and index prices | demo | Maddex simulation | demo | each session | 365 days | markets, watchlist, portfolio, screener, scanner, dashboard, replay |
| `demo-correlation` Correlation matrix (seeded) | demo | Maddex simulation | demo | each session | 365 days | markets |
<!-- registry:end -->

## Adding a figure

1. Put it in the data file of an existing dataset, or create a dataset: the
   file, a dated `*_AS_OF` / `*_CHECKED` constant, and a registry entry with
   every field.
2. Use a source that `docs/DATA_SOURCES.md` has cleared for commercial
   display, and attribute it as that doc says.
3. Run `npm run data:docs` and the tests.

Never type a figure into a component, a prompt or a fallback (`?? 3.6`). If
the figure is missing, the reader sees that it is missing, not a number.
