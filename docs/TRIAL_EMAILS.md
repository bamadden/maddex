# Trial email sequence — TODO until Resend is configured

**Status: not sending.** The copy lives in `src/services/emailTemplates.js`
(`welcomeEmail`, `midTrialEmail`, `lastDayEmail`). Nothing below has been run.

| # | When (Sydney) | Subject |
|---|---|---|
| 1 | Day 1, 7pm | Your Maddex terminal is ready |
| 2 | Day 4, 9am | 3 days left in your Maddex trial |
| 3 | Day 7, 9am | Your Maddex trial ends tomorrow |

## What has to exist first

1. `RESEND_API_KEY` in Vercel (Production), and a verified sending domain in
   Resend — the same key `api/alert-email.js` already reads.
2. A server-side sender, e.g. `api/trial-email.js`: given a user id and an
   email id, load the profile, build the template, send through Resend, and
   record the send. It must authenticate the caller with a shared secret
   (`TRIAL_EMAIL_SECRET`) — it is not a public endpoint.
3. Usage figures for email 2 and 3. Today the usage counters are per browser
   (`services/usageService.js`), so the server cannot see them. Until usage is
   written to Supabase, send emails 2 and 3 without the "you have used" list
   (the templates already handle an empty `used`).

## SQL (run in the Supabase SQL editor once 1–2 exist)

```sql
-- Which trial emails each account has been sent, so a re-run never repeats one.
create table if not exists public.trial_emails_sent (
  user_id uuid references auth.users(id) on delete cascade,
  email_id text not null check (email_id in ('welcome', 'mid', 'last')),
  sent_at timestamptz not null default now(),
  primary key (user_id, email_id)
);
alter table public.trial_emails_sent enable row level security;
-- No policies: only the service role reads or writes this table.

-- Accounts due an email now. Day N = N-1 whole days since created_at,
-- in Sydney time; the job runs hourly and sends at or after the hour set.
create or replace function public.trial_emails_due()
returns table (user_id uuid, email_id text)
language sql security definer set search_path = public as $$
  with t as (
    select p.id, p.created_at,
      (date_part('day', (now() at time zone 'Australia/Sydney') - (p.created_at at time zone 'Australia/Sydney')))::int + 1 as day,
      extract(hour from now() at time zone 'Australia/Sydney') as hour
    from public.profiles p
    where p.subscription_tier = 'trial' and p.trial_ends_at > now()
  ), due as (
    select id, 'welcome' as email_id from t where day = 1 and hour >= 19
    union all select id, 'mid' from t where day = 4 and hour >= 9
    union all select id, 'last' from t where day = 7 and hour >= 9
  )
  select d.id, d.email_id from due d
  where not exists (select 1 from public.trial_emails_sent s where s.user_id = d.id and s.email_id = d.email_id);
$$;

-- Hourly, via pg_cron + pg_net (both available on Supabase). Replace the URL
-- and secret; keep the secret out of the repo (Vault or a dashboard setting).
-- select cron.schedule('trial-emails', '7 * * * *', $$
--   select net.http_post(
--     url := 'https://maddex.vercel.app/api/trial-email',
--     headers := jsonb_build_object('content-type', 'application/json', 'x-trial-secret', '<TRIAL_EMAIL_SECRET>'),
--     body := jsonb_build_object('due', (select coalesce(jsonb_agg(row_to_json(d)), '[]'::jsonb) from public.trial_emails_due() d))
--   );
-- $$);
```

The sender inserts into `trial_emails_sent` after Resend accepts each email.
The `cron.schedule` call is commented out on purpose: enable it only after
the sender is deployed and has been tested against your own account.
