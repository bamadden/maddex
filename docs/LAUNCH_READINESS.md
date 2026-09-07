# Launch readiness audit

**Run:** 7 September 2026 · commit `40c5a53` · build 2.6s, lint 32 problems

Everything below was measured or observed in a browser, not inferred from the
code. Where something could not be tested, it says so rather than passing by
default.

---

## 1. Auth flow

**Partially verified.** Tested against the production build (`vite preview`),
where `import.meta.env.DEV` is false and the real Supabase gate applies — the
dev server's bypass hides this path entirely, so testing there would have proved
nothing.

| Step | Status |
|---|---|
| Unauthenticated root shows AuthModal | ✅ verified |
| SIGN IN / CREATE ACCOUNT tabs | ✅ both render |
| Create-account fields (name, country, email, password ≥8, confirm) | ✅ verified |
| Terms + Privacy links on both tabs | ✅ now resolve (were dead — see §3) |
| Account creation → redirect → onboarding | ⚠️ **not tested** |
| Plan display after sign-up | ⚠️ **not tested** |
| Sign out → sign back in | ⚠️ **not tested** |

The untested three all require creating a real account and entering a password,
which I don't do. **Ben needs to run these himself** in an incognito window
against the deployed build. The code path is sound by inspection —
`AuthGate` → `AuthModal` → `OnboardingFlow` (gated on
`profile.onboarding_complete`) → `TrialExpiredModal` → `Terminal` — but
"looks right" is not "works".

---

## 2. Subscription gating

Checked every gate against what the pricing cards actually promise.

| Promised | Enforced at | Status |
|---|---|---|
| Rates/FX — Prime | `FXModule.jsx:928` | ✅ |
| Macro — Prime | `MacroModule.jsx:1590` | ✅ |
| Sector detail view — Prime | `SectorHeatmap.jsx:1354` | ✅ |
| Unlimited MaddenAI — Prime | `AIPanel.jsx:734`, limit 50 | ✅ matches copy |
| Watchlist 20 — Core | `WatchlistModule.jsx:371` | ✅ matches copy |
| Portfolio 10 — Core | `PortfolioModule.jsx:640` | ✅ matches copy |
| Research Notes — Apex | `ResearchNoteGenerator.jsx:149`, `AIPanel.jsx:1258` | ✅ |
| API access — Apex | `SettingsPanel.jsx:1834` | ✅ |
| Advanced screener — Prime | **was missing entirely** | ✅ fixed, `40c5a53` |

The screener had no subscription import at all: Core and Apex got a
byte-identical module. Now presets, filters, results and CSV stay open to every
plan; plain-English screening and saved screens are Prime, and the pricing copy
was updated to say so.

An expired trial correctly drops below Core (`useSubscription.js` puts `trial`
at hierarchy index 0), so it loses paid features rather than keeping them.

---

## 3. Legal pages

**Was a blocker. Fixed in `1f37f75`.**

All seven links in the app pointed at `https://maddex.com.au/terms`, `/privacy`
and `/disclaimer`. That host resolves to 202.124.241.178 and serves nothing —
`curl` returns 000. Even once the app is live there, `vercel.json` rewrites
every non-`/api` path to `index.html` and `App.jsx` 404s anything that is not
`/`, so those links would have landed on the app's own MODULE NOT FOUND page.

The sign-in screen said *"By continuing you agree to our Terms of Service ·
Privacy Policy"*. Both were dead.

Now served by the app at `/terms`, `/privacy`, `/disclaimer`, mounted **before**
the auth gate so someone without an account can read them. All three carry
Madden Group Holdings Pty Ltd, ben@maddex.com.au, and Queensland governing law;
the disclaimer states plainly that no AFSL is held and no financial product
advice is given, and warns that equity prices are demonstration data.

**Still needed:** a lawyer has not read them, and no ABN/ACN appears because
none is recorded anywhere in this codebase.

---

## 4. Error states

| Case | Result |
|---|---|
| Network disconnect mid-session | ✅ `⚠ NO INTERNET CONNECTION — showing cached data` banner; modules render cached data; **0 uncaught errors or rejections** across module switches with `fetch` rejecting |
| Cleared localStorage | ✅ clean cold start; welcome modal; terminal renders behind it; no errors |
| Unknown route | ✅ styled 404 with RETURN TO MARKETS |
| Rapid module switching | ✅ no uncaught errors; app stayed responsive and kept rendering |
| ErrorBoundary coverage | ✅ wraps main module, split view, and every workspace widget (`App.jsx:678,725,735,774`, `ModuleRenderer.jsx:35`) |

Found and fixed while testing: `index.css` pins `html, body, #root` to
`overflow: hidden` — correct for a fixed terminal layout, fatal for a standalone
document page. `/terms` would not scroll at all; only its first viewport was
reachable. The legal and shared-link pages now scroll themselves.

---

## 5. Performance baseline

Production build, clean `dist`:

- **Build time** 2.6s · **`dist` total** 7.1 MB · **80 JS chunks**
- **JS** 6.33 MB raw / **1.82 MB gzip**
- **First paint payload: 585 KB gzip** (entry + preloaded chunks + CSS)

Five largest chunks (raw / gzip):

| Chunk | Raw | Gzip |
|---|---|---|
| `index` (entry) | 1,550 KB | 449 KB |
| `maplibre-gl` | 1,006 KB | 263 KB |
| `shared3d` | 905 KB | 241 KB |
| `DeckGLMap` | 839 KB | 240 KB |
| `GlobalModule` | 460 KB | 129 KB |

The four heavy ones are all lazy — maplibre, three.js and deck.gl are not on the
first-paint path. **The entry chunk is the one worth attacking**: at 449 KB gzip
it is 77% of what a first-time visitor downloads before seeing anything.

Build warning: chunks over 500 KB (expected — the 3D and map modules).

---

## 6. Launch blockers

| # | Blocker | Severity | Status |
|---|---|---|---|
| 1 | **Payments not wired.** Three `alert()` placeholders stand in for Stripe: `SettingsPanel.jsx:1635` (manage billing), `:1752` (upgrade), `TrialExpiredModal.jsx:18` (post-trial). Nobody can pay. | 🔴 hard | open |
| 2 | **Equity prices are demonstration data.** Markets, Watchlist, Portfolio, Screener all read `mockData`. Labelled DEMO everywhere, and the disclaimer now says so — but the flagship module of an ASX terminal is not live. Needs a provider key (`VITE_POLYGON_KEY` unset). | 🔴 hard | open |
| 3 | Legal pages did not exist | 🔴 hard | ✅ fixed `1f37f75` |
| 4 | Legal pages not reviewed by a lawyer; no ABN/ACN | 🟠 must-do | open |
| 5 | Advanced screener ungated — Core got Apex value | 🟠 revenue | ✅ fixed `40c5a53` |
| 6 | **Auth flow's three write paths untested** (account creation, plan display, sign-out/in). Requires a real account. | 🟠 must-do | needs Ben |
| 7 | `maddex.com.au` serves nothing (connection fails). Domain must point at the deployment before launch. | 🟠 must-do | open |
| 8 | Entry chunk 449 KB gzip — 77% of first paint | 🟡 should | open |
| 9 | 20 lint errors: 11 `set-state-in-effect`, 7 `only-export-components`, 1 `no-useless-escape`, 1 `purity`. Concentrated in `SectorHeatmap.jsx` (7). None are known bugs; the `set-state-in-effect` ones are cascading-render risks. | 🟡 should | open |
| 10 | Email alert delivery advertised as "coming soon" in `AlertsModule.jsx:156` — alerts are in-app only | 🟢 minor | open |

**Verified clean:** no secrets in the client bundle (`ANTHROPIC_API_KEY` stays
server-side in `api/claude.js`; only the public Supabase anon key ships), `.env`
gitignored, zero console errors on a clean load, ErrorBoundary coverage
complete, 404 and offline states both handled.

### The two that actually gate launch

Everything else is work. **Payments and live equity data are the two that decide
whether this can be sold on the day it opens** — one because nobody can pay, the
other because the ASX prices in an ASX terminal are demonstration data.
