# MaddenAI background calls — cost audit (31 Oct 2026)

Every MaddenAI call the terminal makes without being asked. User-initiated calls (the
chat panel, research notes, deep dives, RBA preview, "what this means" buttons) are not
listed: each is one request a person chose to make.

Measured by opening every module once in a fresh browser on a fresh day, with the AI
mocked, so the run itself cost nothing (`npm run test:ui` does the same).

## Before

All of these were cached in the reader's own browser (`localStorage`), so every reader
generated their own copy of content that was identical for everyone.

| Call | Where | Cache key | TTL | Core? | Logged out? |
|---|---|---|---|---|---|
| Market sentiment | dashboard load (TopBar, News, Brief) | `maddex_sentiment_<UTC date>_<hour>` | 1 hour | yes | request made, 401 in prod |
| Weekly review | app start + every 15 min after the Friday close | `maddex_weekly_review_<ISO week>` | 1 week | yes | 401 in prod |
| Macro regime | Macro | `maddex_ai_content_macro_regime_<day>` | 1 day | **401 in prod for everyone** — sent no sign-in token | same |
| Macro themes | Macro | `macro_themes_v2_<local date>` | 1 day | yes (capped at Core's token limit) | 401 in prod |
| News brief | News (even with its panel collapsed) | `maddex_news_brief_…<day>` | 1 day | yes | 401 in prod |
| Geopolitical risks | Global | `maddex_ai_content_geo_risks_<day>` | 1 day | 401 in prod (no token) | same |
| Shipping status | Global | `maddex_ai_content_shipping_status_<day>` | 1 day | 401 in prod (no token) | same |
| Intel ticker | Global | `maddex_ai_content_intel_ticker_<day>` | 1 day | 401 in prod (no token) | same |
| Policy bias | Rates, first card expanded | `maddex_ai_content_policy_bias_<day>` | 1 day | 401 in prod (no token) | same |

**8 per-user model calls** for a reader opening every module (dashboard 2, Macro 2,
News 1, Global 3), plus up to one sentiment call per hour of use.

The five `aiContentService` items called `/api/claude` without the sign-in token, so
since the auth guard shipped (27 Oct) they have been refused in production and every
reader saw the fallback content.

## After

| Call | Now | Shared? | Core | Logged out | Hidden tab |
|---|---|---|---|---|---|
| Market sentiment | `/api/ai-daily?kind=sentiment` | yes, per Sydney day | yes (free to serve) | yes | waits |
| Macro themes | `kind=macro-themes` | yes | yes | yes | waits |
| Macro regime, geo risks, shipping, intel ticker, policy bias | `kind=<key>` | yes | yes | yes | waits |
| Weekly review | per reader, weekly | no (built from browser-side data) | **on demand only** | not generated | skipped |
| News brief | per reader, daily | no (built from browser-side data) | **when the panel is opened** | 401 | — (user action) |

**0 per-user model calls for Core, 1 for Prime/Apex (the weekly review, once a week),
and 6 shared reads** served from the CDN.

How the shared items work (`api/ai-daily.js`, prompts in `src/services/aiDaily.js`):

- **Server-side prompts.** The server builds every prompt from the verified constants
  and, for sentiment, public news feeds. No reader can change what another reader sees.
- **Strict parameters.** Only `kind` (a fixed list) and `day` (must be today in Sydney)
  are accepted. Anything else gets a 400 before any model call, so the cache cannot be
  busted.
- **Caching.** The CDN caches until Sydney midnight (`s-maxage`). A warm instance keeps
  a copy in memory and merges simultaneous requests.
- **Safety cap.** No more than 40 generations per instance per day.

## Estimated cost per 1,000 users a day

Claude Sonnet 4.6 at US$3 per million input tokens and US$15 per million output tokens.
Token counts are estimated from each prompt's size and its typical reply. They are not
billed figures; the endpoint logs real usage (`[ai-daily]` in the Vercel logs) to check.

| Item | In / out tokens (est.) | US$ per call |
|---|---|---|
| Sentiment | 550 / 150 | 0.004 |
| Macro themes | 1,150 / 2,000 | 0.034 |
| Geo risks · shipping · intel ticker · regime · policy | ~400 / 300–700 each | 0.006–0.012 each |
| News brief | 1,500 / 700 | 0.015 |
| Weekly review | 2,000 / 1,500 | 0.029 |

**Before:** about **US$95 a day** per 1,000 readers, if every call succeeded.

- Assumes each reader opens the dashboard, Macro, News and Global once a day, with
  sentiment in two different hours, which is ≈ US$0.095 a reader.
- The real 27–31 Oct production cost was lower, because the five no-token calls were
  being refused.

**After:** about **US$5 a day** per 1,000 readers, ≈ 95% less.

- **Shared items:** US$0.08 for one generation of all seven. Allowing for up to three
  CDN regions that is US$0.08–0.24 a day, whatever the number of readers.
- **News brief:** assumes a quarter of readers open the panel, so 250 × US$0.015 ≈
  US$3.75.
- **Weekly review:** assumes about 30% of readers are paid or on trial, so
  300 × US$0.029 ÷ 7 ≈ US$1.25.

## Not changed

- **Morning brief (Brief module).** It is personal: it uses the reader's watchlist and
  holdings. It runs once a day per reader, and the briefs-per-month limits in
  `services/plans.js` apply.
- **Scanner pattern notes and earnings previews.** Both are generated only when a
  reader opens one.
