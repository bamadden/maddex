# Security

How Maddex is protected, what is still owed, and the steps that are Ben's.
Started 26 Nov 2026 (WS6). Findings and their ranking:
`docs/audit/security.md`.

## Response headers (vercel.json, every path)

| Header | Value | Why |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS only (Vercel sent this already; now stated) |
| `X-Frame-Options` | `DENY` | The terminal cannot be framed by another site (clickjacking). Nothing in the app frames itself (a test checks). |
| `X-Content-Type-Options` | `nosniff` | Browsers do not guess file types |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Other sites see only the origin, never the path or query |
| `Permissions-Policy` | camera, microphone, geolocation, payment, USB, serial, Bluetooth, HID, MIDI and motion sensors off; fullscreen and clipboard-write for this site only | The app uses none of the blocked features. The charts' fullscreen and copy buttons keep working. |
| `Content-Security-Policy-Report-Only` | see below | **Reports, does not block** |
| `Reporting-Endpoints` | `csp="/api/csp-report"` | Where reports go |

The pages served by `/api/waitlist` also set their own *enforcing* CSP
(`default-src 'none'`, no scripts). That has been in place since they were
written.

## Content-Security-Policy: report-only

**Status: report-only, since 26 Nov 2026.** Nothing is blocked. **Do not
enforce it until two things are done:**
1. a signed-in pass through every module has run with no violations in the
   log;
2. Ben has said to enforce it.

The policy allows:
- scripts from this site only (no inline script, no `eval`; the build has
  neither);
- styles from this site, inline styles (React sets `style=`), and Google Fonts;
- fonts from this site and Google Fonts;
- images from any https host, `data:` and `blob:`;
- network requests (`connect-src`) to `data:` URLs (a library reads inline
  data that way; this was the one violation in the 26 Nov signed-in pass),
  to this site's `/api/*`, and to the hosts the signed-in app was seen using
  on 26 Nov:
  - Supabase (project `onzaybvpqkpqupzluapo`)
  - CoinGecko and Binance
  - alternative.me and mempool.space
  - raw.githubusercontent.com
  - USGS
  - OpenFreeMap tiles;
- workers from this site and `blob:` (the map's workers);
- no plugins, no frames, and no framing of Maddex by anyone.

### Seeing violations

Every violation a browser reports is one line in the Vercel function log:

1. Open <https://vercel.com/dashboard>, choose the **maddex** project, then
   **Logs** in the top bar.
2. Type `[csp]` in the search box. Set the time range (for example, Last 24
   hours).
3. Each line reads, for example:
   `[csp] connect-src blocked https://api.open-meteo.com on /  (source: https://maddex.vercel.app/assets/index-….js)`.
   That means the page `/` fetched from api.open-meteo.com, which the policy
   does not list.

Only the directive, the blocked origin, the page's path and the script's file
are logged. A query string (which can hold a token), a user agent or an IP
never is. At most 120 lines a minute per instance are kept, so a flood
cannot fill the log.

A violation means one of two things. Either the host is one Maddex really
uses, and it is added to the policy in `vercel.json` (a test lists the core
hosts). Or it is not, and something unexpected tried to load. Look before
adding it.

### Enforcing it (only on Ben's word)

In `vercel.json`, rename the header key `Content-Security-Policy-Report-Only`
to `Content-Security-Policy` and change the test that requires report-only.
Keep the reporting, then run the full gate and the signed-in live check, and
push. To back out, rename it back.

## Endpoints

| Endpoint | Who may call it | Limits in the code |
|---|---|---|
| `/api/claude` | Signed in (Supabase token checked) | Per user per day, by plan, counted in `ai_usage` (shared across instances) |
| `/api/ai-daily` | Anyone may read; only the daily cron may generate (`?generate=all`: CRON_SECRET or Vercel's cron agent, else 401) | Fixed kinds, today's date only; one generation per type per Sydney day (checked against the stored records); a view only reads |
| `/api/waitlist` | The launch site's origins and the terminal | Per IP, per address and a send cap: **per instance** (below) |
| `/api/csp-report` | Browsers | 120 log lines a minute per instance; 64 KB body cap |
| `/api/rss` | Anyone | Allowlisted hosts only, redirects too (26 Nov); cached by the CDN for 15 minutes |
| `/api/account-export`, `/api/account-delete` | Signed in | None |
| `/api/alert-email` | Signed in | Answers 503 while email alerts are not offered (no sender key) |
| `/api/metals` | Anyone | Cached by the CDN for an hour |
| `/api/terminal-api` | Anyone | Answers 410 Gone |

## Rate limits: what the code can and cannot do

The waitlist and CSP-report limits are counted **in each serverless
instance's memory**. Vercel runs as many instances as traffic needs, and a
new one starts with empty counters. So:
- One script hitting the endpoint from one place is limited. Its requests
  mostly land on warm instances, and the per-address limit stops it
  re-sending to one inbox.
- A distributed attacker, spread across instances, can exceed the stated
  numbers several times over.
- A limit that holds across instances needs a shared counter. That means
  either the edge (Vercel Firewall, below: no code, a dashboard change) or a
  shared store (Upstash Redis or Vercel KV, which needs an account).
  `memoryStore()` in `api/_waitlist.js` is the place a shared store would
  plug in (`hit(key, windowSeconds)`).

The edge rules below are the recommended fix. They are Ben's to add,
because they need the Vercel dashboard.

## Vercel Firewall rules (step by step)

These limit requests per IP at Vercel's edge, before any function runs, across
every instance. The code's own limits stay as a second layer.

**Plans:** rate limiting is a Firewall feature whose availability and rule
count depend on the Vercel plan. If the **Rate Limit** action is missing or
greyed out in step 4, the plan does not include it. Use **Log**, or **Deny**
for clearly abusive paths, instead, or tell me and we will use a shared
store.

1. Open <https://vercel.com/dashboard> and choose the **maddex** project.
2. Choose **Firewall** in the top bar, then **Configure** (or **Rules**), then
   **New Rule** (or **+ Add Rule**).
3. Give the rule the name in the table. Under **If**, add the condition shown:
   **Request Path**, the operator, and the value. For the first rule, also
   add **Method** **equals** `POST` (AND).
4. Under **Then**, choose **Rate Limit**:
   - **Fixed window**, with the window and limit from the table;
   - **Key: IP Address**;
   - **Follow-up action: Deny** (it answers 429).

   To watch before blocking, choose **Log** first, leave it for a day, then
   edit the rule to **Rate Limit**.
5. **Save**. Add the rules in this order, the specific ones above the last
   (catch-all) rule. Then **Review Changes** and **Publish**. Firewall
   changes take effect without a deploy.

| # | Name | If Request Path | Window | Limit per IP | Why |
|---|---|---|---|---|---|
| 1 | Waitlist sign-ups | **equals** `/api/waitlist` (and Method **equals** `POST`) | 60 s | 10 | Each sign-up sends an email; the code allows 5 in 10 min per IP per instance |
| 2 | CSP reports | **equals** `/api/csp-report` | 60 s | 60 | Keeps a flood out of the log |
| 3 | Account export and delete | **starts with** `/api/account-` | 60 s | 10 | Signed-in only, and each one reads or deletes everything; no code limit |
| 4 | MaddenAI | **starts with** `/api/claude` | 60 s | 30 | The per-user daily limits stay; this stops bursts |
| 5 | Feed proxy | **starts with** `/api/rss` | 60 s | 120 | The News module loads about 12 feeds at once |
| 6 | All other API | **starts with** `/api/` | 60 s | 300 | The catch-all; the Frankfurter, RBA, FRED and IMF proxies live here |

**Checking a rule works** (rule 1, from your own machine). The address uses
the reserved `.invalid` domain, so no email can be delivered. Nothing is
stored, because nothing is confirmed:

```sh
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code} " -X POST \
    -H "Origin: https://maddex.vercel.app" -H "content-type: application/json" \
    -d '{"email":"firewall-test@example.invalid","consent":true}' \
    https://maddex.vercel.app/api/waitlist
done; echo
```

Before the rule, every answer is the endpoint's own (`503` until the waitlist
is configured). After it, the eleventh and twelfth answer `429` from the
edge. **Firewall → Overview** (or the rule's own view) lists the blocked
requests.

## Owed (as of 26 Nov 2026)

- ~~Migration 012~~: applied and verified 26 Nov (`docs/MIGRATION_012.md`).
- **CSP:** stays report-only until a few days of `[csp]` logs show nothing
  new and Ben says to enforce it.
- **Firewall rules:** Ben to add, as above.
- **Live check of the RLS policies** in the database itself (not only the
  migration files): needs the Supabase SQL Editor (`pg_policies`).
- **`ai_usage` token columns** can be edited by their own user. Limits count
  rows, so no limit is affected, but per-user cost figures are unreliable.
  Low; the fix is a server-side write.
