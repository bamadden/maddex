# Smoke test

`scripts/smoke/sweep.mjs`, run by `.github/workflows/smoke.yml` after every
successful Production deploy (on the deployed commit), nightly at 20:30 UTC
(07:30 Sydney in daylight time), and by hand from the Actions tab. It is also
the last step of `npm run test:ui`, so every gate runs it.

| Stage | What it opens | Fails on |
|---|---|---|
| Production, signed out | The live site's sign-in screen and each API endpoint | A missing screen, a console error, an AI request, a missing security header, an endpoint not answering as designed |
| Every module, today's date | Every module on a dev server of the deployed commit (the dev build skips sign-in) | An error boundary, a console error, raw error text, an AI request, a control nested inside another, figures without a data badge, **any AI request when its cards and toggles are opened** |
| Every module, signed in | The same, on the live site, signed in as the test account | The same, plus a refused sign-in |

Opening cards: every expand toggle and clickable card in each module is opened.
AI controls (labelled AI / MaddenAI / ASK / GENERATE) and anything that
changes data (DELETE, REMOVE, CLEAR, SAVE, EXPORT, JOIN …) are never pressed.
Rule since 26 Nov 2026: AI runs only when the reader presses a control that
names it. Third-party outages (a CoinGecko rate limit, a feed that is down)
are warnings, because the app labels them STALE or unavailable.

Nothing in the smoke test can make an AI call: `/api/claude` and
anthropic.com are refused, and counted as failures, and `/api/ai-daily` is
answered with an empty mock.

## Setting up the test account (Ben, once)

The signed-in stage is skipped, with a notice in the run, until the two
secrets exist. The account must hold **no real data**: no holdings, no
watchlist and no personal details beyond a placeholder name.

1. **Choose an address you control**, used only for this. For example, a
   plus-address of your own mailbox (`you+maddex-smoke@…`, which arrives in
   your inbox) or a dedicated mailbox. Do not reuse a real customer's or a
   colleague's address.
2. **Make a password** with your password manager: random, 24 characters or
   more. It never needs to be typed again after step 6.
3. **Create the account**: open <https://maddex.vercel.app> in a private
   window, choose **CREATE ACCOUNT**, and enter:
   - first name `Smoke`, last name `Test`;
   - country Australia;
   - the address and password from steps 1 and 2.

   Confirm the email if Supabase sends a link.
4. **Sign in once in that private window** and get past the one-off screens,
   which the sweep cannot do for you:
   - accept the **Terms of Use**;
   - acknowledge the **disclaimer**;
   - skip the welcome and the tour.

   Add nothing: no holdings, no watchlist, no alerts. Sign out and close the
   window.
5. **Make the account Apex**, so no module is behind an upgrade screen (the
   trial ends after 7 days). In the Supabase dashboard, project
   `onzaybvpqkpqupzluapo`, choose **SQL Editor**, then **New query**. Paste
   this, with the address from step 1, and click **Run**:
   ```sql
   UPDATE public.profiles
   SET subscription_tier = 'apex', trial_ends_at = NULL
   WHERE email = 'the-address-from-step-1';
   ```
   Expect *Success. No rows returned* (it reports 1 row updated in the
   status line). The plan columns are protected from the browser, not from
   the SQL Editor.
6. **Add the two repository secrets**. On GitHub, open **bamadden/maddex** →
   **Settings** → **Secrets and variables** → **Actions** → **New repository
   secret**, and add:
   - name `MADDEX_TEST_EMAIL`, value: the address from step 1;
   - name `MADDEX_TEST_PASSWORD`, value: the password from step 2.

   Repository *secrets*, not variables: secrets are masked in every log.
7. **Run it once**: **Actions** → **smoke test** → **Run workflow** → **Run
   workflow**. Open the run when it finishes. The step **Every module, signed
   in as the test account** should end with *All smoke checks passed*. If it
   says the account has not accepted the Terms or the disclaimer, repeat
   step 4.

### Handling of the credentials

- The secrets are passed only to the signed-in step, as environment
  variables.
- The script types them into the sign-in form and scrubs the address, its
  local part and the password from every line it prints, so `[test account]`
  appears instead. GitHub also masks secret values in logs.
- They are never written to a file, an artifact or the repository.
- **To rotate:** change the password in Maddex (signed in as the test
  account), then update `MADDEX_TEST_PASSWORD` in step 6.
- **To stop the signed-in stage:** delete either secret. The stage then skips
  itself.
- **To remove the account:** sign in as it, then Settings → Data → Delete
  account.

### What the signed-in stage does to the account

It signs in and opens modules and cards. It presses no AI control and no
control that saves, deletes, exports or sends, so it writes nothing on
purpose. Signing in refreshes the session, and opening modules reads the
account's (empty) settings, watchlist and holdings.
