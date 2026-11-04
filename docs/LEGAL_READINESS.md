# Legal readiness

Where Maddex stands on the advice line, consumer law, privacy and data
licensing after the legal-risk hardening pass of 1 Nov 2026, what is still
open, and the questions to put to a financial services lawyer.

This is an engineering summary, not legal advice. Everything marked DRAFT is
for the lawyer to finalise.

## Done

| # | Item | What changed | Evidence |
|---|---|---|---|
| 1 | AI advice boundary | System prompt opens with THE ADVICE LINE (no buy/sell/hold, targets, forecasts, picks, "you should", suitability). Personalisation sends reading level and topics only — risk tolerance and time horizon never leave the device. Advice-seeking turns get a boundary reminder. Every reply is checked sentence by sentence and offending sentences are removed before display; mostly-advice replies become a standard decline. Blocks are logged. | `services/systemPrompt.js`, `services/adviceGuard.js`; `tests/adviceBoundary.test.mjs` (46 attacks across 10 framings) |
| 2 | Scores and signals | Every score card: "Descriptive measure · Not a recommendation · As at …", method and inputs one click away. Bullish/bearish wording replaced with descriptive tone words; no AI pattern directions or probabilities; holdings-aware features describe exposure only. | `components/ui/ScoreNote.jsx`, `data/methodology.js`; `tests/scores.test.mjs` |
| 3 | Newsletters and AI reports | Content rules in every generating prompt. Standard footer (data-as-at date, AI-assisted note, disclaimer, not licensed) on every export. Research-note "stance" (a rating) removed. Newsletter editions need a recorded, named human approval of the exact text before they can send. | `services/disclosures.js`, `services/newsletterEdition.js`, `scripts/newsletter.mjs`; `tests/reports.test.mjs` |
| 4 | Disclosures and terms | Persistent disclaimer footer; first-use acknowledgement (version and time recorded on device and account); Terms and Privacy accepted at sign-up with version and time, and asked once of any account without a record. Legal pages bannered DRAFT, PENDING LEGAL REVIEW. No claim of an ASIC licence or approval anywhere (tested). | `components/legal/LegalNotices.jsx`, `services/legalConsent.js`; `tests/legal.test.mjs` |
| 5 | Claims audit | Every factual claim listed with evidence and test. Corrected: FX "live" (it is the ECB's daily rate), welcome copy on live indices, absolute AI-figure claims, "every figure is labelled", "Priority support", "Early access", API access (beta, demo data). | `docs/CLAIMS_REGISTER.md`; `tests/claims.test.mjs` |
| 6 | Data sources and licences | Terms of every source read (49 of 53 found). Off in code because their terms bar our use or need a licence: DefiLlama, OpenSky, Open-Meteo, IMF, FRED (browsers), Esri tiles, FMP, Twelve Data, and 13 of 17 news publishers (on: RBA, BBC News, Yahoo Finance; ABC under review). Required credits shown beside the data (CoinGecko, alternative.me, ECB, Exchange Rate API, RBA, ABS, USGS, OpenStreetMap/CARTO) plus the RBA's free-data notice. Equity prices stay DEMO. | `docs/DATA_SOURCES.md`, `src/data/sourceLicence.js`, `src/data/credits.js`; `tests/dataSources.test.mjs` |
| 7 | Privacy and security | Data inventory in the Privacy Policy draft; Export my data and Delete account (including the login) for every user; AI usage retention 90 days; no prompts stored; third-party keys moved server-side; a bundle scan fails the gate if a secret reaches the client; breach checklist. | `services/accountData.js`, `api/account-delete.js`, `api/metals.js`, `scripts/check-client-secrets.mjs`, `docs/DATA_BREACH_RESPONSE.md`; `tests/privacy.test.mjs` |
| 8 | AI records | Every AI reply recorded server-side with model, prompt template version, input data date and output-check result; prompts not stored (a hash only); retained 2 years. | `api/_aiRecords.js`, migration 011; `tests/aiRecords.test.mjs` |
| 9 | Branding | Bloomberg removed from app and marketing copy, including the last two strings in the RBA card on 5 Nov; every third-party name listed with its basis. | `docs/TRADEMARKS.md`; `tests/trademarks.test.mjs` |

## Re-check against the master brief, Phase 4 (5 Nov 2026)

Each brief item checked against the code; gaps fixed, one commit each, full
gate green at each.

| Brief item | Status | Change on 5 Nov |
|---|---|---|
| 1. AI advice boundary: prompt, output check that blocks or rewrites and logs, ≥40 adversarial prompts | Done 1 Nov: 46 attacks across 10 framings (role-play, hypothetical, "ignore your rules"…), all pass offline; each block or rewrite logged in the browser (`[ADVICE GUARD]`, kept in production builds) and in the server AI record | None |
| 2. Every score labelled: descriptive measure, method, inputs, date, "Not a recommendation" | Gaps found and fixed | ScoreNote added to the scanner momentum score, portfolio recession rubric (was "AU risk score"), country-risk list, screener MATCH %, sector strength and macro regime. Sector strength no longer counts a fixed 50 as "volume conviction" (30%) or shows 50 for a missing quote. Removed the hand-set, undated six-month regime history and the 3D "MACRO SCORE" drawn from the hand-set gauge (`079b6e8`) |
| 3. Newsletters and reports: disclaimer, data-as-at, AI-assisted note, human approval before send | Done 1 Nov | None |
| 4. CLAIMS_REGISTER, DATA_SOURCES, TRADEMARKS, LEGAL_READINESS; FMP fails closed | Done 1 Nov; FMP: every request goes through one guarded function, tested with keys set | Resend row brought up to date; Bloomberg strings removed (`73c184c`) |
| 5. Privacy: inventory and recipients, AI prompt-log retention, no client secrets, breach checklist | Done 1 Nov: inventory and recipients in the Privacy Policy draft (checked against tables, browser keys and api/); prompts are never stored (hash only), no server code logs prompt text; usage 90 days, AI replies 2 years; bundle scan in the gate | None |
| 6. Persistent footer and first-use acknowledgement with all four points | The footer cut off after the second point on a laptop and left out past performance on a phone | Short form of all four, never cut off; browser check at 1440px and 390px (`2a40353`) |

Also on 5 Nov: the expired stats exceptions for the 3 Nov hike were removed
(`da8fa78`); Table A2 has the new rate.

## Open — needs Ben

1. **Apply migrations 010 (retention) and 011 (AI records)** in Supabase, and enable pg_cron for the purge jobs. Until 011 is applied, AI replies are not recorded (the server logs that).
2. **Set `SUPABASE_SERVICE_KEY` in Vercel** (server-only). Without it: AI records cannot be written, and Delete account removes the user's data but not their login (the user is told, and support must remove it).
3. **Rename `VITE_EXCHANGERATE_API_KEY` to `EXCHANGERATE_API_KEY`** in Vercel and `.env` (the server reads either; the `VITE_` name is a habit that leaks keys). Rotate that key: it was compiled into earlier client bundles.
4. ~~Confirm `RESEND_API_KEY`~~ — done another way on 3 Nov: email alerts are not offered (claims register P3). To turn them on, confirm a sender and flip `EMAIL_DELIVERY_AVAILABLE`. The Privacy Policy draft still says Resend delivers alert emails "if you turn them on": left for the lawyer pass with the rest of the text.
5. **Confirm migration 009 is applied** in production — the plan's AI limits are only enforced server-side once it is.
6. ~~The Bloomberg strings in the RBA panels~~ — removed 5 Nov.
6a. **`api/terminal-api.js` still answers** on production for any well-formed key, with demo data, though API access is offered nowhere (claims register P4). Decide whether to disable it.
7. **Lawyer review** of the Terms, Privacy Policy and Disclaimer drafts, then bump the versions in `data/legalVersions.js` so every account accepts the final text.
8. **CARTO API key by 30 Nov 2026** — CARTO's terms changed on 29 Sep 2026; keyless basemap requests may be watermarked. Needs an account, which I cannot create.
9. **CoinGecko capacity** — the free Demo plan allows 10,000 calls a month, and calls come from readers' browsers. Put crypto behind a cached server endpoint or buy a plan before launch.
10. **Decide on the sources now off** (`docs/DATA_SOURCES.md`): license them (DefiLlama Pro, Open-Meteo paid, IMF permission, news syndication from Nine, Guardian and others) or leave them off. The News module now carries five feeds.
11. **Ask about the REVIEW sources**: ABC (terms page unreachable), Binance (fallback crypto), Stooq, World Bank, mempool.space, PublicNode.
12. **ExchangeRate-API key has reached its quota** ("quota-reached"), so gold/silver in the tape are unavailable regardless of the move to the server.
13. Fill in the contacts table in `docs/DATA_BREACH_RESPONSE.md`.
14. Optional: `scripts/advice-eval.mjs --yes` runs the 46 attacks against the live model (billed, about 46 short calls) to measure how often the guard has to step in.

## Questions for a financial services lawyer

**The advice line**
1. Does Maddex, as built, stay within "factual information" and "general advice"? Specifically: (a) MaddenAI answering free-form questions about named securities; (b) the computed market sentiment score, recession and regime labels; (c) holdings-aware features that describe a user's exposure to an event (rate decision, commodity move) without suggesting action. Does describing a *user's own* exposure become personal advice under s 766B(3) Corporations Act because it considers their financial situation?
2. Is general advice being given at all (so that we need a general advice warning in the s 949A form, and an AFSL or authorised-representative arrangement), or can the product be structured so that it gives only factual information? Which features push it over?
3. Does the investor profile (risk tolerance, time horizon, stored on the device and never sent to the AI) create any exposure, given it changes nothing but tone and depth?
4. Are the adviceGuard rewrites (removing a sentence and showing a notice) an adequate control, or should advice-seeking questions be refused outright?
5. Is a rule-based "market sentiment" score with a published method, labelled "not a recommendation", at risk of being treated as a financial product recommendation or opinion?

**Disclosure and terms**
6. Is the disclaimer wording (footer, acknowledgement, export footer) sufficient, and is the first-use acknowledgement plus sign-up checkbox an adequate record of acceptance?
7. Terms of Use: limitation of liability against the Australian Consumer Law consumer guarantees (ss 54–64A); auto-renewing subscriptions and the unfair contract terms regime (penalties since Nov 2023); trial-to-paid conversion disclosure.
8. Do we need to say anything about the AI beyond "AI can make mistakes" (for example, that MaddenAI is a third-party model)?

**Consumer law and claims**
9. Review `docs/CLAIMS_REGISTER.md`: any claim that could be misleading or deceptive (s 18 ACL), especially around "live", "verified", demo data and the API.
10. Does showing DEMO equity prices — clearly labelled — create any risk if a user relies on them?

**Newsletters and reports**
11. Does a human-approved weekly newsletter that "describes and explains" markets need an AFSL or a general advice warning? Does the approver need any qualification?
12. Is attaching "Prepared with the assistance of AI" sufficient disclosure on research notes and exports?

**Privacy**
13. Is Maddex an APP entity under the Privacy Act (turnover, or other grounds)? If not, should it comply voluntarily, and does the NDB scheme apply?
14. Cross-border disclosure (APP 8) to Supabase, Vercel, Anthropic and Resend — is naming them and their US processing enough?
15. Retention: 2 years for AI reply records (complaint handling) and 90 days for usage records — appropriate? What record-keeping period applies if an AFSL or AR arrangement is needed later?
16. Holdings sent to the AI provider (by ticker and weight, never name or email): is that "personal information" requiring specific consent?

**Data licensing and marks**
17. The data-source terms flagged in `docs/DATA_SOURCES.md` — which require a commercial licence before charging subscribers?
18. FRED and BLS are used only by a maintainers' script that reconciles our hand-entered US figures — is that permitted "internal commercial use" under FRED's terms, or does it need the St. Louis Fed's consent?
19. Displaying news headlines, summaries and links from publisher RSS feeds in a paid product — permitted, or does each publisher need a licence?
20. Nominative use of index names (S&P/ASX 200, Nikkei 225, etc.) and showing *DEMO* index levels under those names — any trade mark or index-licensing exposure?
