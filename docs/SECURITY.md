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
