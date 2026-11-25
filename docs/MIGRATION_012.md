# Migration 012: who may add rows to the waitlist

File: `supabase/migrations/012_waitlist_insert_rules.sql`. Written 26 Nov
2026. **Not applied. Ben applies it.**

## What it changes, in plain English

The `waitlist` table holds three kinds of row, told apart by `source`:

| source | What it is | Who should be able to create it |
|---|---|---|
| `terminal` | Someone pressed JOIN WAITLIST for a paid plan in the terminal | The terminal, with the public key (as today) |
| `newsletter` | A confirmed subscriber to The Maddex Intelligence Brief | Only `/api/waitlist`, after the owner presses Confirm in the email |
| `launch-site` | A confirmed sign-up from the launch site's early-access form | Only `/api/waitlist`, after the owner presses Confirm in the email |

**Today:** one rule, "Anyone can join the waitlist", lets the public key (it
is in every visitor's browser, by design) insert any row at all. Anyone with
basic tools can therefore:
- add a `launch-site` or `newsletter` row for any address, which looks
  confirmed though its owner never agreed;
- attach a row to someone else's account (`user_id`);
- back-date a row (`created_at`).

**After 012:** the public key may insert only a `terminal` row, with no
account or the caller's own, dated now. `newsletter` and `launch-site` rows
can only be created by `/api/waitlist`. It uses the server-only service key,
which row-level security does not apply to, and writes a row only after the
owner confirms.

Nothing else changes. The public key still cannot read, change or delete any
row, as before.

## Does it touch existing data?

**No.** It replaces one access rule (a policy) with another. No row is added,
changed or deleted.

One thing to know about the data already there:
- Newsletter rows created before 26 Nov were inserted straight from the
  browser. They were never confirmed by email.
- Any `launch-site` row that exists now did not come from the endpoint
  (it answers 503 until it is configured), so it was inserted with the
  public key.

To see what is there (read-only):

```sql
SELECT source, count(*) AS rows, min(created_at) AS first, max(created_at) AS last
FROM public.waitlist GROUP BY source ORDER BY source;
```

Whether to keep the unconfirmed newsletter rows, or delete them and let
those people sign up again with confirmation, is your decision. The
migration leaves them alone.

## When to apply it

Apply it **after** the release that moves the terminal's newsletter sign-up
to `/api/waitlist` is live. That release went out on 26 Nov 2026, in the
same push as this file. Applied earlier, the old newsletter form would have
been refused.

The newsletter and launch-site sign-ups only *work* once `/api/waitlist` is
configured (`WAITLIST_TOKEN_SECRET`, `WAITLIST_ALLOWED_ORIGINS` and a sender:
see `docs/WAITLIST_API.md`). Until then the form says sign-up isn't open
and records nothing. That is true with or without 012.

## How to apply it (Supabase SQL Editor)

1. Open <https://supabase.com/dashboard/project/onzaybvpqkpqupzluapo> and
   choose **SQL Editor** in the left sidebar.
2. **Optional, to see the hole first:** click **New query**, paste the whole
   of `supabase/checks/012_verify.sql` and click **Run**. Expect an
   error that begins `RESULT:` and contains FAIL lines. That error is
   deliberate: it is what rolls the test rows back.
3. Click **New query**, paste the whole of
   `supabase/migrations/012_waitlist_insert_rules.sql` and click **Run**.
   Expect *Success. No rows returned*.
4. Verify (next section).

## How to verify it

**A. The rule itself.** Run:

```sql
SELECT policyname, cmd, roles, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waitlist';
```

Expect exactly one row:
- `policyname`: *The terminal may add a payments waitlist row*
- `cmd`: INSERT
- `roles`: {anon,authenticated}
- `with_check`: contains `source = 'terminal'`

"Anyone can join the waitlist" must be gone.

**B. What it lets through.** Run `supabase/checks/012_verify.sql` again (a
new query, paste, Run). It acts as the public key, tries five inserts, and
then rolls everything back, so nothing is kept. Expect an error reading:

```
RESULT: PASS launch-site refused | PASS newsletter refused | PASS back-dated row refused | PASS row for another account refused | PASS terminal row accepted (rolled back)
```

Any **FAIL** means the migration is not in force; tell me the line. A
**CHECK** line names an unexpected error code; send it to me.

**C. In the terminal.** Open a paid plan's upgrade button (JOIN … WAITLIST)
and join with your own address. It should still say you are on the list. That
is the one insert the browser still makes.

## How to undo it

```sql
DROP POLICY IF EXISTS "The terminal may add a payments waitlist row" ON public.waitlist;
CREATE POLICY "Anyone can join the waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated WITH CHECK (true);
```

This restores the old rule exactly, hole included.

## Tests

`tests/waitlist.test.mjs` checks:
- that the migration's rule admits the one insert the browser still makes
  (`PlanModals.jsx`, source `terminal`);
- that it refuses every source `/api/waitlist` owns;
- that it contains no statement that changes data;
- that it opens no read, update or delete.

The tests read the SQL and the source. They do not run Postgres:
- No local Postgres is installed.
- Adding PGlite (Postgres in WebAssembly) as a dev dependency was refused
  by this session's permission settings.
- `supabase/checks/012_verify.sql` is therefore the check against the real
  database.

If you allow PGlite, a test can run the real migrations, 012 included, and
the same five inserts as the anon role on every gate.
