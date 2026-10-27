# Launch readiness audit

**Run:** Tuesday 27 October 2026, evening (Sydney) · deployed commit `455e420` + this audit's fixes
**Previous audit:** 7 September 2026 (`40c5a53`) — in git history; its open items are carried forward below.

Every ✅ below was measured or observed tonight. Where something could not be
tested, it is marked ⚠️ with the reason, not passed by default.

**What could not be tested, and why.** The live site puts every module behind
sign-in. I don't hold Ben's credentials and won't use them, so nothing was
tested *as a signed-in user on maddex.vercel.app*. Instead:
- the signed-out live site (auth screen, legal pages, 404, share pages) was
  tested directly on `https://maddex.vercel.app`;
- every AI feature was run through its real client code (the deployed commit,
  served locally) with **every `/api/claude` call relayed to the production
  endpoint** — so the production key, credits, model and serverless function
  were all exercised, by the same prompts users send;
- Supabase was probed read-only with the public anon key (no rows written).

---

## 🔴 Two security findings — fix before any public launch

### 1. `/api/claude` is an open, unauthenticated proxy to the Anthropic key
`api/claude.js` accepts any POST from any origin (`Access-Control-Allow-Origin: *`),
takes `model` and `max_tokens` from the request body, and calls Anthropic with
`ANTHROPIC_API_KEY`. Verified tonight: an anonymous `curl` to
`https://maddex.vercel.app/api/claude` got a model reply. Anyone who opens dev
tools can run unlimited queries on Ben's account, at any token size, on any
model the key can reach. The per-plan MaddenAI limits (Core 10/day, Prime
50/day) are enforced only in the browser (`usageService`, localStorage), so they
are advisory.

**Fix (½–1 day):** require the Supabase access token (`Authorization: Bearer`)
and verify it the way `api/alert-email.js` already does; pin `model` to an
allowlist and cap `max_tokens` server-side; add a per-user daily counter
(Supabase table or Vercel KV) keyed to the plan. Not changed tonight: the
signed-in path can only be verified with a real account on the live site, and a
mistake here takes MaddenAI down for every user. **Needs Ben's session to test.**

### 2. Any user can make themselves Apex
001's `"Users can update own profile"` policy covers every column, so a
signed-in user can run
`supabase.from('profiles').update({ subscription_tier: 'apex' })` from the
console and unlock every paid gate (or extend `trial_ends_at` indefinitely).
**Fix written tonight:** `supabase/migrations/008_protect_plan_columns.sql` — a
trigger that rejects changes to those two columns from the `anon`/
`authenticated` roles (the app only ever reads them; billing via the service role
and the SQL editor are unaffected). **Needs applying.**

---

## AI features — tested against production

| Feature | Result | Evidence |
|---|---|---|
| MaddenAI chat — "what is BHP" | ✅ | routed as the company-overview query; 2 calls, 200, reply began "BHP is the world's largest diversified miner…" |
| Morning Brief | ✅ | headline on tomorrow's CPI and the 3 Nov RBA; 5 sections; score 42; 37s |
| Research Note — BHP.AX | ✅ | stance BALANCED, 3 risks, 3 catalysts, 530 words; 24s |
| Macro Themes | ❌ → ✅ **fixed tonight** | was silently serving `FALLBACK_THEMES` on every load: the response hit `max_tokens` (1,024, then 3,000 on retry) and the truncated JSON failed to parse. Analysis capped at ~180 words, limit 6,000: now `source: live`, 3,291 tokens, `end_turn`. **Needs deploy.** |
| Intel Ticker | ✅ | 12 items, source `live` |
| Weekly Review | ✅ | exists for **19–23 October 2026**: "Energy commodities surge on Hormuz disruption while the AUD reclaims 0.70…"; 4 sections |
| Deep dive — CSL | ✅ | all 6 sections, 1,162 words, auto-saved to SAVED RESEARCH |
| Portfolio Strategy Session | ✅ | 2 calls, 200; SAVE AS NOTE offered |

All 17 production calls returned 200; no page errors. Model in production:
`claude-sonnet-4-6` (hard-coded in `api/claude.js` and `src/services/api.js`).

**Not measured:** the stock-detail "AI analysis" panel (`DetailModal.jsx:397`)
and the News brief (`NewsModule.jsx:1073`) also use the 1,024-token default.
They ask for shorter output, but are the next place to look if anything reads
as cut off.

---

## Subscription gating

| Check | Result |
|---|---|
| Gates in code match plans.js (`GATES`, `LIMITS`) | ✅ single source; Apex-only: unlimited MaddenAI, API access, watchlist sharing, snapshot sharing, export-all, refresh-all |
| Ben's Apex account has everything on the live site | ⚠️ **not tested** — needs Ben signed in. Quick check: Settings → Plan & Billing shows APEX; ↻ REFRESH ALL appears in the top bar; Settings → Data shows EXPORT ALL DATA without ⊘ |
| New sign-ups | ✅ by inspection: 7-day trial with full Apex access (auth screen says so; `handle_new_user` sets `trial`, `trial_ends_at = now + 7d`) |
| Gates can't be bypassed | ❌ client-side only, and see security findings 1 and 2 |
| Apex API access works | ❌ `profiles.api_key` column does not exist in production (migration 004 not applied) — GENERATE API KEY fails. `api/terminal-api.js` also accepts any well-formed key (validation is a TODO) |

---

## Checklist

### TECHNICAL
- ✅ **All 19 modules load without error** — 18 routed modules plus the Alert Centre overlay; no error boundaries, no page errors (dev build, Apex preview)
- ⚠️ **Zero console errors in production** — ✅ signed-out (auth screen, `/terms`, `/privacy`, `/disclaimer`, 404, share page: 0 errors). Signed-in: not testable without an account. Dev shows only aborted RSS on navigation and CoinGecko's rate-limit (a 429 that surfaces as a CORS error)
- ✅ **First paint under 280 KB gzip** — **275.3 KB** measured from the live `index.html` (16 files; entry 159.9 KB, Supabase 50.3 KB)
- ⚠️ **Auth flow works end-to-end** — sign-in/create-account UI ✅ on live; account creation → onboarding → plan display → sign-out/in still **untested since September** (needs a real account)
- ❌ **Supabase migrations all applied** — probed read-only:

  | Migration | Production |
  |---|---|
  | 001 initial schema | ✅ tables present |
  | 002 experience_level | ✅ |
  | 003 subscription_tier | ✅ |
  | 004 terminal api_key | ❌ column missing |
  | 005 waitlist | ✅ table present (the brief listed this as pending — it isn't) |
  | 006 newsletter unique (email, source) | ⚠️ can't be seen read-only — assume pending |
  | 007 shared_links | ❌ table and `get_shared_link` missing (404) |
  | 008 protect plan columns | ❌ written tonight |

- ⚠️ **All env vars set in Vercel** — ✅ `ANTHROPIC_API_KEY` (live call works), Supabase URL/anon key, ExchangeRate key. ❌ `RESEND_API_KEY` (`/api/alert-email` returns 503). Equity data key unset (DEMO by design, see Data)
- ⏳ **Custom domain maddex.com.au** — PENDING; `maddex.com.au` and `www.` both fail to connect
- ✅ **SSL** — Vercel certificate on maddex.vercel.app; will auto-issue for the custom domain

### DATA
- ✅ **RBA 4.60%** — hike 29 Sep 2026, effective 30 Sep; ABS/RBA check confirms
- ✅ **Central bank rates verified Oct 2026** — re-checked 27 Oct (PBOC held 20 Oct; ECB 29 Oct, BOJ 30 Oct, BoC/RBNZ 28 Oct still to meet; BOE next 5 Nov). SNB and Riksbank last verified 1 Oct
- ⚠️ **Calendar current through Nov 2026** — key AU events present (RBA 3 Nov, Labour Force 19 Nov, RBA 8 Dec) plus sourced bank results/dividends/AGMs and ASX floats; US data releases for November are sparse
- ✅ **Official stats checker 11/11** — plus all 10 history series match
- ✅ **AU unemployment 4.7% (Sep 2026)**
- ⏳ **Q3 CPI — UPDATE TOMORROW 28 Oct, 11:30 AEDT** — release banners and the NEW DATA DETECTED check are armed; constants to change are listed in the CPI panel and in memory
- ✅ **Index levels anchored to 27 Oct closes** — ASX 200 8,850.1 (demo stocks rescaled to it); US indices 26 Oct closes; others 30 Sep
- ✅ **No fabricated figures in any AI prompt** — every generator passes verified figures in and forbids others; spot-checked tonight's outputs
- ❌ **Live equity prices** — still DEMO everywhere (labelled). Not on the brief's list, but it was a hard blocker in September and still is for a paid ASX terminal

### AI FEATURES (require Anthropic credits)
- ✅ MaddenAI responding in production
- ✅ Morning Brief generating
- ✅ Research Notes generating
- ✅ Macro themes generating — **after tonight's fix is deployed** (production has been on fallback themes)
- ✅ Weekly review active (19–23 Oct)
- ✅ Deep dive working

### LEGAL + COMPLIANCE
- ✅ Terms of Service page exists (`/terms`, live)
- ✅ Privacy Policy page exists (`/privacy`, live)
- ✅ Disclaimer page exists (`/disclaimer`, live; states no AFSL is held)
- ✅ "General information only" on AI output — panel disclaimer bar, research notes, deep dives, briefs, PDF footer
- ✅ No fabricated figures — as above; DEMO, AI-ESTIMATE and INDICATIVE labels where data is not live
- ✅ AFSL disclaimer — on the disclaimer page and in every research note ("Madden Group Holdings Pty Ltd does not hold an AFSL")
- ⏳ AFSL authorised-representative arrangement — PENDING
- ⏳ ABN — PENDING (none recorded anywhere in the codebase)
- ⏳ Lawyer review of legal pages — PENDING

### COMMERCIAL
- ⏳ Stripe payments — PENDING (upgrade shows a "payments coming soon" waitlist)
- ⏳ Resend email alerts — PENDING (`RESEND_API_KEY` unset; 503)
- ⏳ maddex.com.au domain — PENDING
- ⚠️ Newsletter infrastructure — signup UI live; writes to `waitlist` (exists); **006 needed** or payments-waitlist members get a false "subscribed"; no sending platform or edition archive yet
- ✅ Supabase waitlist migration 005 — **applied** (table present)
- ⏳ Supabase newsletter migration 006 — PENDING (unverifiable read-only)
- ⏳ Supabase sharing migration 007 — PENDING (confirmed missing); until then every share link is browser-local and says so
- ⏳ (new) migrations 004 and 008 — PENDING

### QUALITY
- ⚠️ **All 19 modules rated 9+/10** — not scored numerically; every module loads cleanly and has been through the quality passes in Sep–Oct. A meaningful rating needs live equity data, which drives Markets, Watchlist, Portfolio, Screener and Scanner
- ✅ **Mobile responsive (390px)** — live auth screen and 8 core modules (Dashboard, Markets, Watchlist, Portfolio, News, Macro, Calendar, Brief): 0 px horizontal overflow
- ✅ **Lint: 0 errors** (9 warnings, all `exhaustive-deps` / `only-export-components`)
- ✅ **Build: clean** (one expected warning: map/3D chunks over 500 KB, all lazy)
- ⚠️ **No broken links** — in-app links and legal pages ✅; every `maddex.com.au` URL (newsletter, research-note footers, share "branded" URL) is dead until the domain is pointed
- ✅ **Empty states** — modules render without data (cleared storage, offline, no holdings) as verified in September; tonight's new sections (saved research, corporate actions, listings, newsletter edition) all have explicit empty states

---

## Honest assessment

### Ready now
- The terminal itself: 19 modules load cleanly, mobile works, first paint 275 KB, lint clean.
- Every AI feature works in production, with figures fed in from verified sources rather than invented (macro themes once tonight's fix deploys).
- Macro, rates, FX, crypto, calendar and official statistics are real and checked (11/11 against ABS/RBA/FRED). The CPI release flow is ready for tomorrow.
- Legal pages exist and say the right things for a general-information product; honesty labels (DEMO, AI-ESTIMATE, INDICATIVE) are consistent.

### Blocking launch
1. **`/api/claude` open proxy** — anyone can spend the Anthropic balance. Must fix before the URL is shared publicly.
2. **Self-service Apex** — apply migration 008.
3. **Payments** — no Stripe, so nobody can pay; and once Stripe exists, its webhook must be what sets `subscription_tier` (service role), which 008 now enforces.
4. **Live ASX equity data** — still DEMO. Acceptable for a free beta if labelled (it is); not for a paid ASX terminal.
5. **Legal**: lawyer review, ABN on the legal pages, and a decision on AFSL authorised-rep status before charging money.
6. **Domain**: maddex.com.au must point at Vercel — many in-app links and all shared material use it.
7. **Pending migrations** 004, 006, 007 — features that look finished (API keys, newsletter, share links) don't fully work without them.

### Time to launch, if blockers are worked this week
- **Free/soft launch (trial + Core, demo equities labelled): ~3–4 working days.**
  /api/claude auth + server-side limits (1 day incl. testing with a real account),
  apply 004/006/007/008 (1 hour), point the domain (1 hour + DNS propagation),
  Resend key and a sender domain (½ day), one signed-in end-to-end pass on the live site (½ day).
- **Paid launch: ~2–3 weeks**, gated by things outside the code: Stripe
  integration with webhooks and plan writes (3–5 days of build), a live equities
  provider and key (days, once a plan is chosen), and the lawyer review / ABN /
  AFSL decision (external — typically 1–3 weeks; an AR arrangement can take longer).

### After soft launch
- Live equity data provider; then re-rate Markets/Watchlist/Portfolio/Screener/Scanner.
- Newsletter sending platform and edition archive; maddex.com.au/newsletter.
- Terminal API: validate keys against `profiles.api_key`, real endpoints, rate limits.
- Upgrade the model from `claude-sonnet-4-6` to the current Sonnet after a quality/cost check.
- Server-side MaddenAI usage accounting per plan (pairs with the proxy fix).
- Refresh hand-entered data on its cadence: CPI tomorrow, RBA 3 Nov, bank results early Nov, ASX floats weekly, SNB/Riksbank re-verify.
