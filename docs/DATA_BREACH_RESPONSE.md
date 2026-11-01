# Data breach response checklist

For any suspected unauthorised access to, disclosure of, or loss of personal
information Maddex holds (see the Privacy Policy's data inventory and
`docs/LEGAL_READINESS.md`). **DRAFT, pending legal review** — have the
financial services / privacy lawyer confirm whether Maddex is an "APP entity"
under the Privacy Act 1988 (Cth) and so bound by the Notifiable Data Breaches
(NDB) scheme. Small businesses under the turnover threshold can still be
covered (for example if they trade in personal information); until that is
confirmed, follow this checklist as if the scheme applies.

Keep a dated log of every step, decision and person involved from the first
minute. That log is the record the OAIC will ask for.

## 1. Contain (first hours)

- [ ] Record who noticed what, when, and how (time in AEST/AEDT).
- [ ] Stop the access: rotate the affected keys and secrets —
  - Supabase: anon key and **service key** (`SUPABASE_SERVICE_KEY`), and reset the database password if exposed.
  - Anthropic (`ANTHROPIC_API_KEY`), Resend (`RESEND_API_KEY`), ExchangeRate-API (`EXCHANGERATE_API_KEY`), any market-data keys.
  - Vercel: revoke tokens; check team members and deploy hooks.
- [ ] If a client bundle is suspected of carrying a secret: `npm run build && npm run check-secrets`.
- [ ] Revoke affected user sessions (Supabase → Authentication → sign out users) if accounts are involved.
- [ ] Preserve evidence: export Vercel function logs and Supabase logs for the period before they roll over. Do not delete anything.

## 2. Assess (within 30 days at the latest — aim for days)

Under the NDB scheme an entity that suspects an eligible breach must take
reasonable steps to complete an assessment within 30 days.

- [ ] What data: which tables or files (`profiles`, `portfolio_holdings`, `watchlist`, `price_alerts`, `ai_notes`, `ai_usage`, `ai_records`, `waitlist`, `shared_links`, auth users), which fields, how many people.
- [ ] Was it accessed or disclosed, or only at risk? Encrypted or not?
- [ ] Is serious harm likely? Consider: financial details (holdings, cost base), contact details usable for phishing, the people affected, whether the data is already in hostile hands.
- [ ] Can remedial action prevent serious harm (for example data recovered before use)? If so, the breach may not be notifiable — record the reasoning.
- [ ] Decide: notifiable or not. Record who decided and why.

## 3. Notify (as soon as practicable once notifiable)

- [ ] OAIC: lodge the Notifiable Data Breach statement (oaic.gov.au). It includes the entity's identity and contact details, a description of the breach, the kinds of information involved, and recommended steps for individuals.
- [ ] Affected individuals: tell each one directly (email from the account address) — the same content as the statement, in plain words, with what they should do (watch for phishing, change reused passwords). If direct notice is impracticable, publish the statement on the site and take reasonable steps to publicise it.
- [ ] Third parties: tell Supabase, Vercel, Anthropic or Resend if their systems were involved.
- [ ] If an overseas recipient was involved, check whether foreign notification rules apply.

## 4. Review (within a month of closing)

- [ ] Root cause, written up in `docs/` with the timeline.
- [ ] What would have caught it sooner; add a test or a check (for example a new pattern in `scripts/check-client-secrets.mjs`).
- [ ] Update the Privacy Policy if the data inventory or providers changed.

## Contacts to fill in before launch

| Role | Name | Contact |
|---|---|---|
| Breach lead (decides) | | |
| Technical lead (contains) | | |
| Lawyer | | |
| OAIC | Office of the Australian Information Commissioner | oaic.gov.au |
