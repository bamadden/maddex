# Waitlist API (launch site early access, and the newsletter)

The endpoint the launch site's early-access form posts to. The terminal's
newsletter sign-up (Settings → About) uses it too, with `list:
"newsletter"`. Built 26 Nov 2026 (WS1). Code: `api/waitlist.js` (handler), `api/_waitlist.js` (checks, tokens,
limits, email and pages), `api/_mailer.js` (sender interface). Tests:
`tests/waitlist.test.mjs` (mocks only).

**Status: built and tested, not yet usable in production.** It answers
`503 not_configured` until the environment variables below are set in Vercel
and a sender is connected in `api/_mailer.js`. Both are Ben's to do.

## How it works

1. The form POSTs an email address and an explicit consent.
2. The endpoint emails a confirmation link. **Nothing is stored yet.** The
   link carries the address, encrypted and authenticated (AES-256-GCM) and
   expiring after 48 hours. Someone who sees the link, in a log or a
   forwarded email, cannot read the address from it. An address that is
   never confirmed is never stored.
3. The owner opens the link and presses **Confirm**. One row is written to
   `public.waitlist` with `source = 'launch-site'`.
4. Every email carries an unsubscribe link. Unsubscribing **deletes** the row.

The answer to a sign-up is the same whether or not the address is already on
the list. The endpoint never reads the list to answer a sign-up, so neither
the response nor its timing can tell anyone whether an address has joined.

## Base URL

`https://maddex.vercel.app/api/waitlist` (this project's production
deployment). Links in emails use `WAITLIST_PUBLIC_URL`.

## 1. Sign up

```
POST /api/waitlist
Origin: <one of WAITLIST_ALLOWED_ORIGINS>
Content-Type: application/json

{ "email": "pat@example.com", "consent": true, "website": "" }
```

The launch site needs no `list` field: it defaults to `"launch"`.

| Field | Required | Rule |
|---|---|---|
| `email` | yes | A single address of up to 254 characters. It is trimmed and lower-cased. A Unicode domain is stored in its ASCII (punycode) form, and the local part must be ASCII. Dots and `+tags` are kept. |
| `consent` | yes | The JSON value `true`. `"true"`, `1` or a missing field is refused. |
| `list` | no | `"launch"` (the default: the early-access list) or `"newsletter"` (The Maddex Intelligence Brief). Anything else → `400 unknown_list`. |
| `website` | no | **Honeypot.** Render it hidden from people (see below) and send it empty. If it is filled in, the endpoint answers as normal and sends nothing. |

Any other field is refused (`unexpected_field`), and so is a body over 2 KB.
Each list has its own consent wording, row source (`launch-site` or
`newsletter`) and unsubscribe: unsubscribing from one leaves the other.

### Responses

| Status | Body | Meaning |
|---|---|---|
| 202 | `{ "ok": true, "status": "pending", "message": "If that address can receive email, a confirmation link is on its way. It works for 48 hours." }` | Accepted. This is the **only** success answer, whatever the address's state. Show the message as given. |
| 400 | `{ "error": "invalid_email" }` | The address is not valid. |
| 400 | `{ "error": "consent_required" }` | `consent` was not `true`. |
| 400 | `{ "error": "unexpected_field" }` | A field other than the four above was sent. |
| 400 | `{ "error": "unknown_list" }` | `list` was not `launch` or `newsletter`. |
| 400 | `{ "error": "invalid_body" }` | The body was not a JSON object, or was malformed JSON. |
| 403 | `{ "error": "origin_not_allowed" }` | The `Origin` is missing, or is neither on the allowlist nor the terminal's own origin (`WAITLIST_PUBLIC_URL`). |
| 405 | `{ "error": "method_not_allowed" }` | Not a POST. |
| 413 | `{ "error": "too_large" }` | The body was over 2 KB. |
| 415 | `{ "error": "json_required" }` | The `Content-Type` was not `application/json`. |
| 429 | `{ "error": "rate_limited" }` + `Retry-After: 600` | Too many sign-ups from this IP (see Limits). |
| 502 | `{ "error": "send_failed" }` | The email sender refused the message. |
| 503 | `{ "error": "not_configured" }` | The sender, secret, database key or public URL is not set. |

Suggested wording on the site: 202 → the message; `invalid_email` → "Check the
email address."; `consent_required` → "Tick the box to agree to emails."; 429
→ "Too many attempts. Try again in a few minutes."; 5xx → "Sign-up isn't
available just now. Please try again later."

### CORS

Only the exact origins in `WAITLIST_ALLOWED_ORIGINS` are answered. The
response echoes the caller's origin in `Access-Control-Allow-Origin` with
`Vary: Origin`, and never sends `*`. A preflight (`OPTIONS`) from an allowed
origin gets 204 with `Access-Control-Allow-Methods: POST, OPTIONS`,
`Access-Control-Allow-Headers: content-type` and `Access-Control-Max-Age:
600`. Any other origin gets 403. Credentials are not used, so send no cookies.

```js
const r = await fetch('https://maddex.vercel.app/api/waitlist', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, consent: consentBox.checked, website: honeypot.value }),
})
const body = await r.json()
```

### The form

- **Consent box:** a checkbox that is **unticked by default**, labelled with exactly
  the current wording below. The site should also link its privacy policy
  next to it.
- **Honeypot:** an input named `website`, hidden from people without
  `type="hidden"` (bots skip those). For example, place it off-screen with
  `aria-hidden="true"`, `tabindex="-1"` and `autocomplete="off"`, inside a
  container that screen readers skip.

## 2. Consent wording

The site shows this text beside the box. A change of wording is a new version:
add a row here and change `CONSENT` in `api/_waitlist.js` in the same commit
(a test checks that this file holds the current wording). A row's consent is
the version in force when it was confirmed, which is its `created_at`.

| Version | In force | Wording |
|---|---|---|
| `waitlist-consent-2026-11-26` (list `launch`) | from 26 Nov 2026 | Email me about Maddex early access and its launch. I can unsubscribe at any time. |
| `newsletter-consent-2026-11-26` (list `newsletter`, shown in the terminal) | from 26 Nov 2026 | Email me The Maddex Intelligence Brief, a weekly newsletter. I can unsubscribe at any time. |

The confirmation token also carries the version. A link issued under earlier
wording is refused as `expired_token` (sign up again), so a row's date always
gives the wording its owner agreed to.

## 3. Confirm (the emailed link)

```
GET  /api/waitlist?action=confirm&token=<token>   → HTML page with a Confirm button
POST /api/waitlist?action=confirm&token=<token>   → confirms
```

Opening the link only shows a page. **The button press is what confirms**, so a
mail scanner that opens every link cannot confirm anyone. The page has no
scripts. Its headers: `Content-Security-Policy: default-src 'none';
style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none';
base-uri 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`
(the token is in the URL), `Cache-Control: no-store`.

The launch site can confirm instead, from its own page:

```
POST /api/waitlist?action=confirm
Origin: <allowed origin>
Content-Type: application/json

{ "token": "<token>" }
→ 200 { "ok": true, "status": "confirmed" }
```

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ "ok": true, "status": "confirmed" }` | On the list. Confirming again gives the same answer. |
| 400 | `{ "error": "expired_token" }` | More than 48 hours old, or issued under earlier consent wording: sign up again. |
| 400 | `{ "error": "invalid_token" }` | Altered, truncated, for another purpose, or missing. |
| 403 | `{ "error": "origin_not_allowed" }` | A POST from a page that is neither ours nor the launch site's. Our page's form sends `Origin: null` (its no-referrer policy) and is accepted. |
| 429 | `{ "error": "rate_limited" }` | Too many link uses from this IP. |
| 502 | `{ "error": "save_failed" }` | The database write failed. It is reported, never shown as success. |

## 4. Unsubscribe

```
GET  /api/waitlist?action=unsubscribe&token=<token>   → HTML page with an Unsubscribe button
POST /api/waitlist?action=unsubscribe&token=<token>   → unsubscribes
```

- The POST accepts the page's form, a JSON `{ "token" }` body from an allowed
  origin, and **RFC 8058 one-click**: every email sends
  `List-Unsubscribe: <…?action=unsubscribe&token=…>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and mail clients POST
  to that URL with no `Origin`.
- It deletes the address's row for the token's list (`launch-site` or
  `newsletter`). Rows from other sources are separate consents and are left
  alone.
- It answers `200 { "ok": true, "status": "unsubscribed" }` whether or not
  there was a row.
- Unsubscribe links do not expire.

Any email sent to the list later, such as the launch announcement, must carry
an unsubscribe link and the same two headers. Make the token with
`makeToken(secret, 'unsubscribe', email)` from `api/_waitlist.js`.

## Limits

| What | Limit | Over the limit |
|---|---|---|
| Sign-ups per IP | 5 in 10 minutes, 20 a day | 429 `rate_limited` |
| Sign-ups per address | 3 an hour, 5 a day | The normal 202 answer, but **no email is sent**, so the limit reveals nothing about the address |
| Emails sent | 300 an hour | 429 `rate_limited` |
| Confirm or unsubscribe per IP | 30 in 10 minutes | 429 `rate_limited` |

Rate-limit keys are HMAC hashes of the IP or address, so neither is held in
the clear, even in memory. An IPv6 caller is limited by its /64. When the
store is full it drops the oldest counters, never all of them, and the send
cap is a separate counter that nothing can reset. **The counters live in each serverless instance's
memory.** Vercel runs several instances, so the effective limit is per
instance. That is enough against a single script, not against a distributed
one. For a shared limit, connect a shared store (for example Upstash Redis or
Vercel KV; it would need an account) through the `hit(key, windowSeconds)`
interface in `memoryStore()`, or add a Vercel Firewall rate-limit rule on
`/api/waitlist`.

## Configuration (Vercel, server-only, never `VITE_`)

| Variable | Required | What |
|---|---|---|
| `WAITLIST_TOKEN_SECRET` | yes | 32 or more random characters. It encrypts the links and hashes rate-limit keys. **Changing it breaks every link already sent, including unsubscribe links**, so set it once. |
| `WAITLIST_ALLOWED_ORIGINS` | yes | The launch site's exact origins, comma-separated, e.g. `https://maddex.com.au,https://www.maddex.com.au`. A wildcard, a path or plain `http` is ignored (`http://localhost` is allowed, for development). |
| `WAITLIST_PUBLIC_URL` | no | This deployment's `https` origin, used for the links. When it is empty it defaults to `https://$VERCEL_PROJECT_PRODUCTION_URL`. The request's `Host` header is never used. |
| `WAITLIST_SITE_URL` | no | The launch site's origin, for the "Back to Maddex" link on the pages. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | yes | Already set for the account endpoints. Used to write and delete. |

**Sender:** `api/_mailer.js` holds the interface, `send({ to, subject, text,
html, headers })`, which must reject when a message is not accepted. In this
repository `configuredMailer()` returns `null`, so no email is ever sent. The
provider must pass the `List-Unsubscribe` headers through. It must also add
the sender's identity and contact details, which Australia's Spam Act 2003
requires.

## Data held

One row per confirmed address and list in `public.waitlist`: `email`,
`source` (`'launch-site'` or `'newsletter'`), `created_at` (when it was confirmed), `tier = null`,
`user_id = null`. No IP, name or tracking data is stored, and unconfirmed
sign-ups are not stored at all.

- **Export:** a person with a Maddex account gets their rows in *Export my
  data* (`api/account-export` reads `waitlist` by email, every source).
  Anyone else can ask through the Privacy Policy's contact. The row holds
  only what their confirmation email already showed them.
- **Delete:** unsubscribing deletes the row. Deleting a Maddex account deletes
  every `waitlist` row for its email (`api/account-delete`).
- **Coverage:** no table was added, so `tests/privacy.test.mjs` (every
  migration table in export and delete) is unchanged and passes.
- Retention follows the Privacy Policy draft: "until you unsubscribe or
  delete your account".
- **Logs:** the endpoint logs no address, IP or token, only the action and
  the HTTP status. Vercel's request logs keep the path and query, so they
  hold link tokens, but those are encrypted and do not show the address.
- **Only this endpoint can write these rows** once migration 012 is applied
  (`docs/MIGRATION_012.md`). Before it, the public key could insert a
  `launch-site` or `newsletter` row directly, bypassing confirmation.
  Newsletter rows created before 26 Nov were inserted straight from the
  browser, unconfirmed. The migration does not touch them; see that doc.
