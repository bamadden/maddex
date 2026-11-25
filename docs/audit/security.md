# Security audit (WS6), 26 Nov 2026

Read-only audit of the migrations' row-level security, the HTTP headers
production serves, the serverless endpoints and their limits. Ranked by
impact.

**Status, 26 Nov (Ben's decisions the same day):**
- **1:** migration 012 written, not applied (`docs/MIGRATION_012.md`).
- **2:** headers live; the CSP is report-only, with `/api/csp-report`.
- **3:** the newsletter is on double opt-in.
- **4:** documented, with the Firewall steps in `docs/SECURITY.md`.
- **5:** the redirect fix is live.
- **6 and 7:** open.

## High

### 1. Anyone can write any row into `waitlist`, bypassing double opt-in
`005_waitlist.sql`: `FOR INSERT TO anon, authenticated WITH CHECK (true)`.
The anon key ships in the browser bundle (by design), so anyone can POST
straight to `/rest/v1/waitlist`. They can insert:
- **`source = 'launch-site'` for any address.** That makes the new endpoint's
  double opt-in meaningless: the row looks confirmed.
- **Any `user_id`.** The column only defaults to `auth.uid()`, and nothing
  checks it.
- **Any number of rows.** It is unique only on (email, source), so the list
  fills with junk.

**Fix:** a migration 012 that replaces the policy with `WITH CHECK (source IN
('terminal', 'newsletter') AND (user_id IS NULL OR user_id = auth.uid()))`.
The terminal's two inserts (`PlanModals.jsx`, `newsletterService.js`) use
exactly those sources. You apply it, as with every migration.

### 2. No Content-Security-Policy, and no frame protection
Production sends `Strict-Transport-Security` (Vercel's default) and no other
security header. Missing: CSP, `X-Frame-Options`/`frame-ancestors` (the
terminal can be framed, so clickjacking is possible), `X-Content-Type-Options`,
`Referrer-Policy` and `Permissions-Policy`.

**Fix:**
1. Add the non-CSP headers in `vercel.json` (low risk).
2. Ship the CSP as **`Content-Security-Policy-Report-Only`** first. It never
   blocks anything, and violations show in the console.
3. Switch it to enforcing only after a signed-in pass through every module
   shows no violations.

Most of the ~135 hosts in the source are outbound links, not fetches. The
connect-src list has to come from the runtime fetches: Supabase, CoinGecko,
OpenFreeMap tiles, alternative.me, DefiLlama, USGS, Open-Meteo, Google Fonts,
plus the same-origin `/api/*` proxies. **Enforcing needs the signed-in check,
which is blocked while the Chrome extension is disconnected.**

## Medium

### 3. The newsletter sign-up has no double opt-in
`newsletterService.js` inserts the address straight from the browser. Anyone
can subscribe someone else. Nothing is sent today (no sender is configured),
but before the newsletter sends, it should go through the same confirm flow
as the launch site. The waitlist endpoint could take a `list` field for this.
That is a contract change, so it is your call.

### 4. Rate limits are per instance, or absent
- `/api/waitlist`: per instance (documented).
- `/api/claude`: per user, per day, through `ai_usage` (shared, good).
- `/api/rss`: allowlisted hosts and cached by the CDN, with no per-IP limit.
- `/api/account-export` and `/api/account-delete`: need a session, with no
  limit.

A Vercel Firewall rule on `/api/*` would cover them all at the edge. It needs
the Vercel dashboard, which is yours to do.

### 5. `/api/rss` follows redirects
It fetches allowlisted hosts with the default `redirect: 'follow'`. An open
redirect on a feed host would make it fetch an arbitrary URL (a limited SSRF:
responses are parsed as RSS). **Fix:** `redirect: 'manual'`, and follow one hop
only when the target host is also on the allowlist.

## Low

### 6. `ai_usage` token counts can be edited by their user
`GRANT UPDATE (input_tokens, output_tokens) … TO authenticated`. The limits
count rows, not tokens, so this changes no limit. It does make the
per-user cost figures unreliable. A server-side write with the service key
would close it.

### 7. RLS review: no other gaps found
- Every table created by a migration has RLS enabled.
- The user tables (`profiles`, `watchlist`, `portfolio_holdings`,
  `user_settings`, `price_alerts`, `ai_notes`) are scoped by `auth.uid()`.
  Plan columns are protected by trigger (008).
- `shared_links` is readable only through `get_shared_link` (an unguessable
  id plus kind).
- `ai_records` is read-own only, with writes by the service key.
- The `SECURITY DEFINER` functions set `search_path`.

A live check against the project's actual policies (not just the migration
files) needs the Supabase dashboard or SQL editor, which only you have.

## Build order proposed
1. Migration 012 (finding 1), with a test that the policy admits only the
   terminal's sources. You apply it.
2. The non-CSP headers plus a report-only CSP in `vercel.json`, checked
   headless on the sign-in page. Enforcement waits for the signed-in check.
3. `/api/rss` redirect handling (finding 5).
4. `docs/SECURITY.md`: the threat model, these controls, and what is still owed.
