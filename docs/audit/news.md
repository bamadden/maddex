# Audit: News

Phase D, 16 Nov 2026. Files: `src/modules/news/*`, `newsIntelligence.js`,
`savedArticles.js`. Surveyed with a read-only agent; each finding checked in
the code before building.

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: legal | Prompts asked for "the likely market impact for ASX and AUD" and "what should I watch next" | `NewsModule.jsx:1365, 1201` | Done 16 Nov: describe what the story reports |
| 2 | High: judgement | Headline tone BULLISH / BEARISH coloured green / red, bars in up/down colours | `NewsModule.jsx:1069-1076` | Done: one colour, "positive / negative words" |
| 3 | Medium: honesty | Missing demo moves and prices became 0 | `NewsModule.jsx:350-351`, story asset | Done: null, row not shown |
| 4 | Medium: failure | Raw error text from the briefing call | `NewsModule.jsx:791` | Done: plain sentence, retry kept |
| 5 | Low: judgement | ENERGY and EARNINGS tags red, CRYPTO green | `NewsModule.jsx:59-60` | Done: neutral palette |
| — | — | Sydney day keys; DemoBadge on demo moves; saved stories say device only | — | Already in place |
